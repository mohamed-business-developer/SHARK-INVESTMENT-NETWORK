import { describe, expect, it } from 'vitest';
import {
  ADMIN_ROLE_DEFAULT_PERMISSIONS,
  ADMIN_ROLE_NAMES,
  SIGNUP_SELECTABLE_ROLES,
  USER_ROLES,
} from '@shark/shared-types';
import {
  AppDomainError,
  buildCursorPage,
  decodeCursor,
  encodeCursor,
  normalizeErrorToEnvelope,
} from '@shark/utils';
import {
  adminReviewEntitySchema,
  adminUserActionSchema,
  createPitchDocumentSchema,
  investorDirectoryFilterSchema,
  registerSchema,
  selectAccountRoleSchema,
  updateOwnProfileSchema,
  upsertCompanySchema,
  upsertPitchSchema,
} from '@shark/validation';
import { assertNoPublicSecretKeys } from '@shark/validation/server-env';

const SAMPLE_UUID_1 = '11111111-1111-4111-8111-111111111101';
const SAMPLE_UUID_2 = '22222222-2222-4222-8222-222222222201';
const SAMPLE_UUID_3 = '33333333-3333-4333-8333-333333333301';

describe('Shared contracts & strict validation boundaries', () => {
  it('forbids self-selecting admin at registration or role selection', () => {
    expect(USER_ROLES).toContain('admin');
    expect(SIGNUP_SELECTABLE_ROLES).not.toContain('admin');

    const badSignup = registerSchema.safeParse({
      email: 'attacker@shark.test',
      password: 'StrongPassword1!',
      fullName: 'Privilege Escalator',
      intendedRole: 'admin',
    });
    expect(badSignup.success).toBe(false);

    const badOnboarding = selectAccountRoleSchema.safeParse({ role: 'admin' });
    expect(badOnboarding.success).toBe(false);

    const massAssignmentSignup = registerSchema.safeParse({
      email: 'user@shark.test',
      password: 'StrongPassword1!',
      fullName: 'Valid User',
      account_status: 'approved',
      role: 'admin',
    });
    expect(massAssignmentSignup.success).toBe(false);
  });

  it('enforces strong password complexity rules', () => {
    expect(
      registerSchema.safeParse({
        email: 'user@shark.test',
        password: 'short1A',
        fullName: 'Valid User',
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        email: 'user@shark.test',
        password: 'onlyletterspassword',
        fullName: 'Valid User',
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        email: 'USER@SHARK.TEST',
        password: 'ValidPassword99!',
        fullName: 'سارة المنصور',
      }).success,
    ).toBe(true);
  });

  it('rejects mass assignment of privilege columns on profile, company, and pitch mutations', () => {
    const profileWithPrivilege = updateOwnProfileSchema.safeParse({
      bio_ar: 'مستثمر في التقنية المالية',
      account_status: 'approved',
    });
    expect(profileWithPrivilege.success).toBe(false);

    const profileClean = updateOwnProfileSchema.safeParse({
      bio_ar: 'مستثمر\u0007 في التقنية المالية',
      phone: '+966500000001',
    });
    expect(profileClean.success).toBe(true);
    if (profileClean.success) {
      expect(profileClean.data.bio_ar).toBe('مستثمر في التقنية المالية');
    }

    const companyWithStatus = upsertCompanySchema.safeParse({
      slug: 'madar-fintech',
      name_en: 'Madar FinTech',
      sector_id: SAMPLE_UUID_1,
      country_code: 'SA',
      status: 'approved',
    });
    expect(companyWithStatus.success).toBe(false);

    const companyBadUrl = upsertCompanySchema.safeParse({
      slug: 'madar-fintech',
      name_en: 'Madar FinTech',
      sector_id: SAMPLE_UUID_1,
      country_code: 'SA',
      website_url: 'javascript:alert(1)',
    });
    expect(companyBadUrl.success).toBe(false);

    const pitchWithRestricted = upsertPitchSchema.safeParse({
      company_id: SAMPLE_UUID_1,
      sector_id: SAMPLE_UUID_2,
      title_en: 'Series A Round',
      funding_stage: 'series_a',
      target_amount_usd: 1_000_000,
      min_ticket_usd: 100_000,
      restricted_at: '2026-01-01T00:00:00Z',
    });
    expect(pitchWithRestricted.success).toBe(false);
  });

  it('validates canonical pitch document paths and blocks traversal or dangerous MIME types', () => {
    const validDoc = createPitchDocumentSchema.safeParse({
      pitch_id: SAMPLE_UUID_2,
      company_id: SAMPLE_UUID_1,
      category: 'pitch_deck',
      file_name: 'madar-deck.pdf',
      storage_path: `${SAMPLE_UUID_1}/${SAMPLE_UUID_2}/${SAMPLE_UUID_3}.pdf`,
      mime_type: 'application/pdf',
      file_size_bytes: 2_048_000,
    });
    expect(validDoc.success).toBe(true);

    const traversalPath = createPitchDocumentSchema.safeParse({
      pitch_id: SAMPLE_UUID_2,
      company_id: SAMPLE_UUID_1,
      category: 'pitch_deck',
      file_name: 'evil.pdf',
      storage_path: `../${SAMPLE_UUID_2}/${SAMPLE_UUID_3}.pdf`,
      mime_type: 'application/pdf',
      file_size_bytes: 1024,
    });
    expect(traversalPath.success).toBe(false);

    const svgSpoof = createPitchDocumentSchema.safeParse({
      pitch_id: SAMPLE_UUID_2,
      company_id: SAMPLE_UUID_1,
      category: 'pitch_deck',
      file_name: 'xss.svg',
      storage_path: `${SAMPLE_UUID_1}/${SAMPLE_UUID_2}/${SAMPLE_UUID_3}.png`,
      mime_type: 'image/svg+xml',
      file_size_bytes: 1024,
    });
    expect(svgSpoof.success).toBe(false);
  });

  it('enforces mandatory audit reasons on admin suspend/reject/restrict actions and maps RBAC permissions', () => {
    for (const roleName of ADMIN_ROLE_NAMES) {
      expect(ADMIN_ROLE_DEFAULT_PERMISSIONS[roleName].length).toBeGreaterThan(0);
    }

    expect(
      adminUserActionSchema.safeParse({
        action: 'suspend',
        targetUserId: SAMPLE_UUID_1,
        reason: 'too short',
      }).success,
    ).toBe(false);

    expect(
      adminUserActionSchema.safeParse({
        action: 'suspend',
        targetUserId: SAMPLE_UUID_1,
        reason: 'Repeated violation of platform confidentiality terms.',
      }).success,
    ).toBe(true);

    expect(
      adminReviewEntitySchema.safeParse({
        entityType: 'pitch_document',
        entityId: SAMPLE_UUID_3,
        decision: 'restricted',
      }).success,
    ).toBe(false);
  });

  it('caps query pagination limits at 50 and safely round-trips UTF-8 base64url cursors', () => {
    expect(investorDirectoryFilterSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(investorDirectoryFilterSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(investorDirectoryFilterSchema.safeParse({ limit: 20 }).success).toBe(true);

    const cursorPayload = {
      ts: '2026-11-20T10:00:00.000Z',
      id: SAMPLE_UUID_1,
      featured: true,
    };
    const encoded = encodeCursor(cursorPayload);
    expect(decodeCursor(encoded)).toEqual(cursorPayload);
    expect(decodeCursor('invalid!cursor')).toBeNull();

    const page = buildCursorPage(
      [
        { id: SAMPLE_UUID_1, createdAt: '2026-11-20T10:02:00.000Z' },
        { id: SAMPLE_UUID_2, createdAt: '2026-11-20T10:01:00.000Z' },
        { id: SAMPLE_UUID_3, createdAt: '2026-11-20T10:00:00.000Z' },
      ],
      2,
      (item) => ({ ts: item.createdAt, id: item.id }),
    );
    expect(page.hasNextPage).toBe(true);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).not.toBeNull();
  });

  it('normalizes database error codes cleanly and rejects leaked public secret prefixes', () => {
    const rlsNormalized = normalizeErrorToEnvelope(
      { code: '42501', message: 'raw pg error' },
      'req_1',
    );
    expect(rlsNormalized.statusCode).toBe(403);
    expect(rlsNormalized.envelope.error.messageKey).toBe('errors.forbidden');
    expect(JSON.stringify(rlsNormalized)).not.toContain('raw pg error');

    const domainErr = new AppDomainError({
      code: 'RATE_LIMITED',
      messageKey: 'errors.rateLimited',
      statusCode: 429,
      requestId: 'req_2',
    });
    expect(normalizeErrorToEnvelope(domainErr)).toEqual({
      statusCode: 429,
      envelope: {
        error: {
          code: 'RATE_LIMITED',
          messageKey: 'errors.rateLimited',
          requestId: 'req_2',
        },
      },
    });

    expect(() =>
      assertNoPublicSecretKeys(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY']),
    ).not.toThrow();
    expect(() => assertNoPublicSecretKeys(['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'])).toThrow(
      /Forbidden secret key/i,
    );
  });
});
