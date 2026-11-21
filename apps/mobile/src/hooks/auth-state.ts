import type { Session, User } from '@supabase/supabase-js';
import type { OnboardingStep, ProfileRow } from '@shark/shared-types';
import type { RevokedAccessReason } from '../services/service-client';

export type MobileAuthStatus =
  'loading' | 'guest' | 'pending' | 'approved' | 'rejected' | 'suspended';

export type AuthRecommendedRoute =
  | '/(tabs)/discovery'
  | '/(auth)/welcome'
  | '/(auth)/account-type'
  | '/(auth)/profile-setup'
  | '/(auth)/verification'
  | '/(auth)/pending-approval'
  | '/(auth)/rejected'
  | '/(auth)/suspended';

export interface MobileAuthState {
  readonly status: MobileAuthStatus;
  readonly session: Session | null;
  readonly user: User | null;
  readonly profile: ProfileRow | null;
  readonly isAuthenticated: boolean;
  readonly isApproved: boolean;
  readonly recommendedRoute: AuthRecommendedRoute;
  readonly revocationReasonKey: string | null;
  readonly rejectionReason: string | null;
  readonly suspensionReason: string | null;
}

export interface AuthStateTransitionOutcome {
  readonly nextState: MobileAuthState;
  readonly shouldClearProtectedCache: boolean;
  readonly shouldSignOutLocal: boolean;
}

function mapPendingStepToRoute(step: OnboardingStep): AuthRecommendedRoute {
  switch (step) {
    case 'account_type':
      return '/(auth)/account-type';
    case 'profile_setup':
      return '/(auth)/profile-setup';
    case 'verification':
      return '/(auth)/verification';
    case 'completed':
      return '/(auth)/pending-approval';
  }
}

export function createInitialGuestAuthState(
  overrides?: Partial<Pick<MobileAuthState, 'status' | 'revocationReasonKey' | 'recommendedRoute'>>,
): MobileAuthState {
  const status = overrides?.status ?? 'guest';
  return {
    status,
    session: null,
    user: null,
    profile: null,
    isAuthenticated: false,
    isApproved: false,
    recommendedRoute: overrides?.recommendedRoute ?? '/(auth)/welcome',
    revocationReasonKey: overrides?.revocationReasonKey ?? null,
    rejectionReason: null,
    suspensionReason: null,
  };
}

/**
 * Pure fail-closed state derivation enforcing live PostgreSQL `account_status` over stale client JWTs.
 */
export function deriveMobileAuthTransition(params: {
  readonly session: Session | null;
  readonly verifiedUser: User | null;
  readonly profile: ProfileRow | null;
  readonly priorStatus: MobileAuthStatus;
  readonly forcedRevocationReason?: RevokedAccessReason;
}): AuthStateTransitionOutcome {
  const { session, verifiedUser, profile, priorStatus, forcedRevocationReason } = params;

  if (forcedRevocationReason === 'suspended') {
    return {
      shouldClearProtectedCache: true,
      shouldSignOutLocal: true,
      nextState: createInitialGuestAuthState({
        status: 'suspended',
        recommendedRoute: '/(auth)/suspended',
        revocationReasonKey: 'errors.accountSuspended',
      }),
    };
  }

  if (forcedRevocationReason === 'unauthorized') {
    return {
      shouldClearProtectedCache: true,
      shouldSignOutLocal: true,
      nextState: createInitialGuestAuthState({
        status: 'guest',
        recommendedRoute: '/(auth)/welcome',
        revocationReasonKey: 'errors.unauthorized',
      }),
    };
  }

  if (!verifiedUser || !session) {
    return {
      shouldClearProtectedCache:
        Boolean(session) || (priorStatus !== 'guest' && priorStatus !== 'loading'),
      shouldSignOutLocal: Boolean(session),
      nextState: createInitialGuestAuthState({
        status: priorStatus === 'suspended' ? 'suspended' : 'guest',
        recommendedRoute: priorStatus === 'suspended' ? '/(auth)/suspended' : '/(auth)/welcome',
        revocationReasonKey: priorStatus === 'suspended' ? 'errors.accountSuspended' : null,
      }),
    };
  }

  // Under 0007 RLS, `is_not_suspended()` returns 0 rows (`profile === null`) once suspended/deleted.
  if (!profile) {
    return {
      shouldClearProtectedCache: true,
      shouldSignOutLocal: true,
      nextState: createInitialGuestAuthState({
        status: 'suspended',
        recommendedRoute: '/(auth)/suspended',
        revocationReasonKey: 'errors.accountSuspended',
      }),
    };
  }

  if (profile.account_status === 'suspended') {
    return {
      shouldClearProtectedCache: true,
      shouldSignOutLocal: true,
      nextState: {
        status: 'suspended',
        session: null,
        user: null,
        profile: null,
        isAuthenticated: false,
        isApproved: false,
        recommendedRoute: '/(auth)/suspended',
        revocationReasonKey: 'errors.accountSuspended',
        rejectionReason: null,
        suspensionReason: profile.suspension_reason,
      },
    };
  }

  if (profile.account_status === 'rejected') {
    return {
      shouldClearProtectedCache: true,
      shouldSignOutLocal: false,
      nextState: {
        status: 'rejected',
        session,
        user: verifiedUser,
        profile,
        isAuthenticated: true,
        isApproved: false,
        recommendedRoute: '/(auth)/rejected',
        revocationReasonKey: null,
        rejectionReason: profile.rejection_reason,
        suspensionReason: null,
      },
    };
  }

  if (profile.account_status === 'pending') {
    return {
      shouldClearProtectedCache: priorStatus === 'approved',
      shouldSignOutLocal: false,
      nextState: {
        status: 'pending',
        session,
        user: verifiedUser,
        profile,
        isAuthenticated: true,
        isApproved: false,
        recommendedRoute: mapPendingStepToRoute(profile.onboarding_step),
        revocationReasonKey: null,
        rejectionReason: null,
        suspensionReason: null,
      },
    };
  }

  return {
    shouldClearProtectedCache: false,
    shouldSignOutLocal: false,
    nextState: {
      status: 'approved',
      session,
      user: verifiedUser,
      profile,
      isAuthenticated: true,
      isApproved: true,
      recommendedRoute: '/(tabs)/discovery',
      revocationReasonKey: null,
      rejectionReason: null,
      suspensionReason: null,
    },
  };
}

export interface ReconcileAuthDependencies {
  readonly priorStatus: MobileAuthStatus;
  readonly getCurrentSession: () => Promise<Session | null>;
  readonly getVerifiedUser: () => Promise<User | null>;
  readonly fetchOwnProfile: (userId: string) => Promise<ProfileRow | null>;
  readonly clearProtectedCache: () => void;
  readonly localSignOut: () => Promise<void>;
  readonly onBeforeRevokedSignOut?: (nextState: MobileAuthState) => void;
  readonly forcedRevocationReason?: RevokedAccessReason;
}

/**
 * Verifies live JWT + PostgreSQL `profiles` status and enforces cache purge & sign-out on revocation.
 */
export async function reconcileLiveAuthSession(
  deps: ReconcileAuthDependencies,
): Promise<MobileAuthState> {
  if (deps.forcedRevocationReason) {
    const forced = deriveMobileAuthTransition({
      session: null,
      verifiedUser: null,
      profile: null,
      priorStatus: deps.priorStatus,
      forcedRevocationReason: deps.forcedRevocationReason,
    });
    if (forced.shouldClearProtectedCache) {
      deps.clearProtectedCache();
    }
    if (forced.shouldSignOutLocal) {
      deps.onBeforeRevokedSignOut?.(forced.nextState);
      await deps.localSignOut().catch(() => undefined);
    }
    return forced.nextState;
  }

  const [session, verifiedUser] = await Promise.all([
    deps.getCurrentSession(),
    deps.getVerifiedUser(),
  ]);

  let profile: ProfileRow | null = null;
  if (verifiedUser && session) {
    try {
      profile = await deps.fetchOwnProfile(verifiedUser.id);
    } catch {
      const revoked = deriveMobileAuthTransition({
        session: null,
        verifiedUser: null,
        profile: null,
        priorStatus: deps.priorStatus,
        forcedRevocationReason: 'suspended',
      });
      deps.clearProtectedCache();
      deps.onBeforeRevokedSignOut?.(revoked.nextState);
      await deps.localSignOut().catch(() => undefined);
      return revoked.nextState;
    }
  }

  const outcome = deriveMobileAuthTransition({
    session,
    verifiedUser,
    profile,
    priorStatus: deps.priorStatus,
  });

  if (outcome.shouldClearProtectedCache) {
    deps.clearProtectedCache();
  }
  if (outcome.shouldSignOutLocal) {
    deps.onBeforeRevokedSignOut?.(outcome.nextState);
    await deps.localSignOut().catch(() => undefined);
  }

  return outcome.nextState;
}
