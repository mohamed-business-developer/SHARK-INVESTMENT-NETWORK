import { describe, expect, it, vi } from 'vitest';
import type { ProfileRow } from '@shark/shared-types';
import {
  deriveMobileAuthTransition,
  reconcileLiveAuthSession,
} from '../../apps/mobile/src/hooks/auth-state';
import {
  createAuthRepository,
  PROFILE_SELF_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/auth.repository';
import {
  assertSupabaseResult,
  registerRevokedAccessHandler,
} from '../../apps/mobile/src/services/service-client';

type RepoSupabaseClient = Parameters<typeof createAuthRepository>[0];
type AuthSession = NonNullable<Parameters<typeof deriveMobileAuthTransition>[0]['session']>;
type AuthUser = NonNullable<Parameters<typeof deriveMobileAuthTransition>[0]['verifiedUser']>;

const USER_ID = '11111111-1111-4111-8111-111111111101';

function buildProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: USER_ID,
    email: 'user@shark.test',
    phone: null,
    full_name: 'Noura Al-Qasimi',
    full_name_ar: 'نورة القاسمي',
    full_name_en: 'Noura Al-Qasimi',
    headline_ar: null,
    headline_en: null,
    bio_ar: null,
    bio_en: null,
    avatar_path: null,
    country_code: 'AE',
    city_ar: null,
    city_en: null,
    preferred_language: 'ar',
    role: 'investor',
    account_status: 'approved',
    onboarding_completed: true,
    onboarding_step: 'completed',
    interest_sector_ids: [],
    notification_preferences: { push: true, email: true, announcements: true },
    analytics_opt_in: false,
    rejection_reason: null,
    suspension_reason: null,
    approved_at: '2026-11-20T00:00:00.000Z',
    approved_by: null,
    rejected_at: null,
    rejected_by: null,
    suspended_at: null,
    suspended_by: null,
    last_active_at: null,
    created_at: '2026-11-20T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

const FAKE_USER = { id: USER_ID, email: 'user@shark.test' } as unknown as AuthUser;
const FAKE_SESSION = { access_token: 'stale-valid-jwt', user: FAKE_USER } as unknown as AuthSession;

describe('Mobile Auth repository & status/stale-session enforcement (T5-05 / T5-06)', () => {
  it('blocks admin self-selection on signUp & selectAccountRole without making backend calls', async () => {
    const signUpMock = vi.fn();
    const fromMock = vi.fn();
    const fakeClient = {
      auth: { signUp: signUpMock, getUser: vi.fn() },
      from: fromMock,
      functions: { invoke: vi.fn() },
    } as unknown as RepoSupabaseClient;

    const repo = createAuthRepository(fakeClient);

    await expect(
      repo.signUp({
        email: 'escalate@shark.test',
        password: 'StrongPassword1!',
        fullName: 'Privilege Tester',
        preferredLanguage: 'ar',
        intendedRole: 'admin' as unknown as 'investor',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.auth.invalidSignupRole',
    });

    await expect(
      repo.selectAccountRole({ role: 'admin' as unknown as 'investor' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.auth.invalidSignupRole',
    });

    expect(signUpMock).not.toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
    expect(PROFILE_SELF_SELECT_COLUMNS).not.toContain('*');
  });

  it('transitions Pending, Approved, Rejected, and Suspended states cleanly with stale JWT detection', async () => {
    const pendingOutcome = deriveMobileAuthTransition({
      session: FAKE_SESSION,
      verifiedUser: FAKE_USER,
      profile: buildProfile({ account_status: 'pending', onboarding_step: 'verification' }),
      priorStatus: 'guest',
    });
    expect(pendingOutcome.nextState.status).toBe('pending');
    expect(pendingOutcome.nextState.isApproved).toBe(false);
    expect(pendingOutcome.nextState.recommendedRoute).toBe('/(auth)/verification');

    const approvedOutcome = deriveMobileAuthTransition({
      session: FAKE_SESSION,
      verifiedUser: FAKE_USER,
      profile: buildProfile({ account_status: 'approved', onboarding_step: 'completed' }),
      priorStatus: 'pending',
    });
    expect(approvedOutcome.nextState.status).toBe('approved');
    expect(approvedOutcome.nextState.isApproved).toBe(true);
    expect(approvedOutcome.nextState.recommendedRoute).toBe('/(tabs)/discovery');

    const rejectedOutcome = deriveMobileAuthTransition({
      session: FAKE_SESSION,
      verifiedUser: FAKE_USER,
      profile: buildProfile({
        account_status: 'rejected',
        rejection_reason: 'Incomplete KYB registration certificate.',
      }),
      priorStatus: 'approved',
    });
    expect(rejectedOutcome.shouldClearProtectedCache).toBe(true);
    expect(rejectedOutcome.shouldSignOutLocal).toBe(false);
    expect(rejectedOutcome.nextState.status).toBe('rejected');
    expect(rejectedOutcome.nextState.isApproved).toBe(false);
    expect(rejectedOutcome.nextState.rejectionReason).toBe(
      'Incomplete KYB registration certificate.',
    );

    const suspendedOutcome = deriveMobileAuthTransition({
      session: FAKE_SESSION,
      verifiedUser: FAKE_USER,
      profile: buildProfile({
        account_status: 'suspended',
        suspension_reason: 'Policy review lock',
      }),
      priorStatus: 'approved',
    });
    expect(suspendedOutcome.shouldClearProtectedCache).toBe(true);
    expect(suspendedOutcome.shouldSignOutLocal).toBe(true);
    expect(suspendedOutcome.nextState.status).toBe('suspended');
    expect(suspendedOutcome.nextState.isAuthenticated).toBe(false);
    expect(suspendedOutcome.nextState.isApproved).toBe(false);
  });

  it('clears protected caches and signs out fail-closed when RLS returns null profile on suspended stale JWT', async () => {
    const clearProtectedCache = vi.fn();
    const localSignOut = vi.fn().mockResolvedValue(undefined);

    const state = await reconcileLiveAuthSession({
      priorStatus: 'approved',
      getCurrentSession: async () => FAKE_SESSION,
      getVerifiedUser: async () => FAKE_USER,
      fetchOwnProfile: async () => null,
      clearProtectedCache,
      localSignOut,
    });

    expect(clearProtectedCache).toHaveBeenCalledTimes(1);
    expect(localSignOut).toHaveBeenCalledTimes(1);
    expect(state.status).toBe('suspended');
    expect(state.isAuthenticated).toBe(false);
    expect(state.isApproved).toBe(false);
    expect(state.recommendedRoute).toBe('/(auth)/suspended');
    expect(state.revocationReasonKey).toBe('errors.accountSuspended');
  });

  it('invokes revocation callback on ACCOUNT_SUSPENDED/401 API errors but not bad login passwords', async () => {
    const revokedHandler = vi.fn();
    const unregister = registerRevokedAccessHandler(revokedHandler);

    try {
      await expect(
        assertSupabaseResult({
          data: null,
          error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' },
        }),
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        messageKey: 'errors.invalidCredentials',
      });
      expect(revokedHandler).not.toHaveBeenCalled();

      await expect(
        assertSupabaseResult({
          data: null,
          error: { status: 403, code: 'ACCOUNT_SUSPENDED', messageKey: 'errors.accountSuspended' },
        }),
      ).rejects.toMatchObject({
        code: 'ACCOUNT_SUSPENDED',
        messageKey: 'errors.accountSuspended',
      });
      expect(revokedHandler).toHaveBeenCalledWith('suspended');
    } finally {
      unregister();
    }
  });
});
