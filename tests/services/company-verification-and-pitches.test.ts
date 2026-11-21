import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  PitchAccessGrantRow,
  PitchDocumentRow,
  PitchRow,
  SavedItemRow,
} from '@shark/shared-types';
import { encodeCursor } from '@shark/utils';
import {
  COMPANY_MEMBER_SELECT_COLUMNS,
  COMPANY_SELF_SELECT_COLUMNS,
  createCompanyRepository,
} from '../../apps/mobile/src/repositories/company.repository';
import {
  createPitchRepository,
  derivePitchAccessState,
  INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS,
  INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS,
  PITCH_ACCESS_GRANT_SELECT_COLUMNS,
  PITCH_DOCUMENT_SELECT_COLUMNS,
  PITCH_REVIEW_SELECT_COLUMNS,
  PITCH_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/pitch.repository';
import {
  applyOptimisticSavedItemPages,
  createSavedRepository,
  SAVED_ITEM_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/saved.repository';
import {
  createVerificationRepository,
  VERIFICATION_REQUEST_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/verification.repository';

type CompanySupabaseClient = Parameters<typeof createCompanyRepository>[0];
type VerificationSupabaseClient = Parameters<typeof createVerificationRepository>[0];
type PitchSupabaseClient = Parameters<typeof createPitchRepository>[0];
type SavedSupabaseClient = Parameters<typeof createSavedRepository>[0];

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const USER_ID = '11111111-1111-4111-8111-111111111105';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111103';
const SECTOR_ID = '55555555-5555-4555-8555-555555555501';
const COMPANY_ID = '22222222-2222-4222-8222-222222222201';
const MEMBER_ID = '22222222-2222-4222-8222-222222222299';
const PITCH_ID = '33333333-3333-4333-8333-333333333301';
const DOC_UUID = '44444444-4444-4444-8444-444444444401';
const DOC_RESTRICTED_UUID = '44444444-4444-4444-8444-444444444402';
const VERIF_DOC_ID = '88888888-8888-4888-8888-888888888801';
const INTEREST_ID = '99999999-9999-4999-8999-999999999901';
const VALID_SHA256 = 'a'.repeat(64);
const CANONICAL_PITCH_PATH = `${COMPANY_ID}/${PITCH_ID}/${DOC_UUID}.pdf`;

interface RecordedQuery {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  selectColumns?: string;
  payload?: unknown;
  filters: Array<{ op: string; args: unknown[] }>;
  orders: Array<{ column: string; options: unknown }>;
  limitValue?: number;
}

function createRecordingClient(config?: {
  authUserId?: string | null;
  authError?: boolean;
  responseByTable?: Record<string, unknown>;
  sequentialResponses?: Array<{ data: unknown; error?: unknown }>;
}) {
  const ops: RecordedQuery[] = [];
  let seqIndex = 0;

  const from = (table: string) => {
    const op: RecordedQuery = {
      table,
      action: 'select',
      filters: [],
      orders: [],
    };
    ops.push(op);

    const resolveResult = async () => {
      if (config?.sequentialResponses && seqIndex < config.sequentialResponses.length) {
        const entry = config.sequentialResponses[seqIndex++]!;
        return { data: entry.data, error: entry.error ?? null };
      }
      return {
        data:
          config?.responseByTable && table in config.responseByTable
            ? config.responseByTable[table]
            : null,
        error: null,
      };
    };

    const chain = {
      select(columns: string) {
        op.selectColumns = columns;
        return chain;
      },
      insert(payload: unknown) {
        op.action = 'insert';
        op.payload = payload;
        return chain;
      },
      update(payload: unknown) {
        op.action = 'update';
        op.payload = payload;
        return chain;
      },
      delete() {
        op.action = 'delete';
        return chain;
      },
      eq(col: string, val: unknown) {
        op.filters.push({ op: 'eq', args: [col, val] });
        return chain;
      },
      neq(col: string, val: unknown) {
        op.filters.push({ op: 'neq', args: [col, val] });
        return chain;
      },
      in(col: string, vals: unknown) {
        op.filters.push({ op: 'in', args: [col, vals] });
        return chain;
      },
      gte(col: string, val: unknown) {
        op.filters.push({ op: 'gte', args: [col, val] });
        return chain;
      },
      lte(col: string, val: unknown) {
        op.filters.push({ op: 'lte', args: [col, val] });
        return chain;
      },
      lt(col: string, val: unknown) {
        op.filters.push({ op: 'lt', args: [col, val] });
        return chain;
      },
      is(col: string, val: unknown) {
        op.filters.push({ op: 'is', args: [col, val] });
        return chain;
      },
      or(clause: string) {
        op.filters.push({ op: 'or', args: [clause] });
        return chain;
      },
      order(column: string, options: unknown) {
        op.orders.push({ column, options });
        return chain;
      },
      limit(count: number) {
        op.limitValue = count;
        return chain;
      },
      maybeSingle: resolveResult,
      single: resolveResult,
      then(
        onFulfilled?: (val: { data: unknown; error: unknown }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) {
        return resolveResult().then(onFulfilled, onRejected);
      },
    };

    return chain;
  };

  const client = {
    auth: {
      getUser: async () =>
        config?.authError || !config?.authUserId
          ? { data: { user: null }, error: { status: 401, message: 'Unauthorized' } }
          : { data: { user: { id: config.authUserId, email: 'founder@shark.test' } }, error: null },
    },
    from,
  };

  return {
    ops,
    companyClient: client as unknown as CompanySupabaseClient,
    verificationClient: client as unknown as VerificationSupabaseClient,
    pitchClient: client as unknown as PitchSupabaseClient,
    savedClient: client as unknown as SavedSupabaseClient,
  };
}

function buildPitchRow(overrides?: Partial<PitchRow>): PitchRow {
  return {
    id: PITCH_ID,
    company_id: COMPANY_ID,
    created_by: USER_ID,
    sector_id: SECTOR_ID,
    title_ar: 'جولة مدار المفتوحة',
    title_en: 'Madar Open Series A',
    summary_ar: 'توسيع طبقة المدفوعات',
    summary_en: 'Expanding payment settlement rails',
    problem_ar: null,
    problem_en: null,
    solution_ar: null,
    solution_en: null,
    market_opportunity_ar: null,
    market_opportunity_en: null,
    traction_metrics: {},
    use_of_funds_ar: null,
    use_of_funds_en: null,
    funding_stage: 'series_a',
    instrument: 'equity',
    target_amount_usd: 2500000,
    min_ticket_usd: 100000,
    pre_money_valuation_usd: 12000000,
    equity_offered_pct: 15,
    currency_code: 'USD',
    closing_date: '2027-06-30',
    status: 'approved',
    is_featured: true,
    rejection_reason: null,
    submitted_at: '2026-11-19T00:00:00.000Z',
    approved_at: '2026-11-20T00:00:00.000Z',
    approved_by: '11111111-1111-4111-8111-111111111101',
    closed_at: null,
    restricted_at: null,
    restricted_by: null,
    created_at: '2026-11-19T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function buildDocRow(overrides?: Partial<PitchDocumentRow>): PitchDocumentRow {
  return {
    id: DOC_UUID,
    pitch_id: PITCH_ID,
    company_id: COMPANY_ID,
    uploaded_by: USER_ID,
    category: 'pitch_deck',
    title_ar: 'العرض الاستثماري',
    title_en: 'Investor Deck',
    file_name: 'madar-deck.pdf',
    storage_bucket: 'pitch-documents',
    storage_path: CANONICAL_PITCH_PATH,
    mime_type: 'application/pdf',
    file_size_bytes: 1024000,
    checksum_sha256: VALID_SHA256,
    is_restricted: false,
    restriction_reason: null,
    restricted_at: null,
    restricted_by: null,
    scan_status: 'clean',
    is_active: true,
    sort_order: 0,
    created_at: '2026-11-19T00:00:00.000Z',
    updated_at: '2026-11-20T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('M5.3 Company, Members & Verification Repository (T5-11)', () => {
  it('enforces server-verified owner_id, safe company status transitions, and rejects privileged mass-assignment', async () => {
    const unauthMock = createRecordingClient({ authUserId: null, authError: true });
    const unauthCompanyRepo = createCompanyRepository(unauthMock.companyClient);

    await expect(
      unauthCompanyRepo.createCompany({
        slug: 'madar-fintech',
        name_ar: 'مدار',
        sector_id: SECTOR_ID,
        country_code: 'SA',
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
    expect(unauthMock.ops).toHaveLength(0);

    const mock = createRecordingClient({
      authUserId: USER_ID,
      sequentialResponses: [
        { data: { id: COMPANY_ID, owner_id: USER_ID, status: 'draft' } },
        { data: { id: COMPANY_ID, owner_id: USER_ID, status: 'pending' } },
        { data: [{ company_id: COMPANY_ID }] },
        { data: [{ id: COMPANY_ID, owner_id: OTHER_USER_ID }] },
      ],
    });
    const repo = createCompanyRepository(mock.companyClient);

    // Privilege escalation fields rejected synchronously before Supabase call
    await expect(
      repo.createCompany({
        slug: 'madar-evil',
        name_en: 'Madar',
        sector_id: SECTOR_ID,
        country_code: 'SA',
        status: 'approved',
        verification_status: 'verified',
      } as unknown as Parameters<typeof repo.createCompany>[0]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(mock.ops).toHaveLength(0);

    await repo.createCompany({
      slug: 'madar-fintech',
      name_ar: 'منظومة مدار',
      name_en: 'Madar FinTech',
      sector_id: SECTOR_ID,
      country_code: 'sa',
      registration_number: 'CR-1010999888',
    });

    const createOp = mock.ops[0]!;
    expect(createOp.table).toBe('companies');
    expect(createOp.action).toBe('insert');
    expect(createOp.selectColumns).toBe(COMPANY_SELF_SELECT_COLUMNS);
    expect(createOp.payload).toMatchObject({
      owner_id: USER_ID,
      status: 'draft',
      verification_status: 'unverified',
      is_featured: false,
      country_code: 'SA',
    });

    // Submit only allowed from draft/rejected -> pending
    await repo.submitCompanyForReview(COMPANY_ID);
    const submitOp = mock.ops[1]!;
    expect(submitOp.action).toBe('update');
    expect(submitOp.payload).toEqual({ status: 'pending' });
    expect(submitOp.filters).toContainEqual({ op: 'in', args: ['status', ['draft', 'rejected']] });

    // listMyOperatedCompanies scopes strictly to owner_id + active member company IDs
    const operated = await repo.listMyOperatedCompanies();
    expect(operated).toHaveLength(1);
    expect(mock.ops[2]?.table).toBe('company_members');
    expect(mock.ops[3]?.filters).toContainEqual({
      op: 'or',
      args: [`owner_id.eq.${USER_ID},id.in.(${COMPANY_ID})`],
    });
  });

  it('guards company_members self-invite, binds invited_by server-side, and verifies safe verification_requests submissions', async () => {
    const mock = createRecordingClient({
      authUserId: USER_ID,
      sequentialResponses: [
        { data: { id: MEMBER_ID, company_id: COMPANY_ID, user_id: OTHER_USER_ID } },
        { data: { id: MEMBER_ID } },
        {
          data: {
            id: VERIF_DOC_ID,
            user_id: USER_ID,
            company_id: null,
            subject_type: 'user_identity',
            status: 'pending',
          },
        },
      ],
    });
    const companyRepo = createCompanyRepository(mock.companyClient);
    const verifRepo = createVerificationRepository(mock.verificationClient);

    // Self-invite rejected synchronously
    await expect(
      companyRepo.inviteCompanyMember({
        company_id: COMPANY_ID,
        user_id: USER_ID,
        member_role: 'co_founder',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', messageKey: 'errors.cannotActOnSelf' });

    await expect(companyRepo.updateCompanyMember(MEMBER_ID, {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    await companyRepo.inviteCompanyMember({
      company_id: COMPANY_ID,
      user_id: OTHER_USER_ID,
      member_role: 'executive',
      can_manage_pitches: true,
    });
    expect(mock.ops[0]?.table).toBe('company_members');
    expect(mock.ops[0]?.selectColumns).toBe(COMPANY_MEMBER_SELECT_COLUMNS);
    expect(mock.ops[0]?.payload).toMatchObject({
      invited_by: USER_ID,
      status: 'invited',
      can_manage_pitches: true,
      can_manage_documents: false,
    });

    await companyRepo.removeCompanyMember(MEMBER_ID);
    expect(mock.ops[1]?.action).toBe('delete');
    expect(mock.ops[1]?.filters).toContainEqual({ op: 'neq', args: ['user_id', USER_ID] });

    // Reject .svg / traversal / >10 MiB / company_kyb without company_id synchronously
    await expect(
      verifRepo.submitVerificationRequest({
        subject_type: 'user_identity',
        document_paths: [
          {
            path: '../other/doc.pdf',
            file_name: 'doc.pdf',
            mime_type: 'application/pdf',
            file_size_bytes: 1024,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(
      verifRepo.submitVerificationRequest({
        subject_type: 'company_kyb',
        company_id: null,
        document_paths: [
          {
            path: `${USER_ID}/${VERIF_DOC_ID}/id.pdf`,
            file_name: 'id.pdf',
            mime_type: 'application/pdf',
            file_size_bytes: 2048,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.verification.companyIdMismatch',
    });

    // Valid pending user identity verification binds user_id + safe 14-col SELECT projection
    await verifRepo.submitVerificationRequest({
      subject_type: 'user_identity',
      document_paths: [
        {
          path: `${USER_ID}/${VERIF_DOC_ID}/passport.pdf`,
          file_name: 'passport.pdf',
          mime_type: 'application/pdf',
          file_size_bytes: 204800,
        },
      ],
      submission_notes: 'National ID front and back.',
    });
    const verifOp = mock.ops[2]!;
    expect(verifOp.table).toBe('verification_requests');
    expect(verifOp.selectColumns).toBe(VERIFICATION_REQUEST_SELECT_COLUMNS);
    expect(verifOp.payload).toMatchObject({
      user_id: USER_ID,
      company_id: null,
      subject_type: 'user_identity',
      status: 'pending',
      storage_bucket: 'verification-documents',
    });
  });
});

describe('M5.3 Pitch, Documents, Grants, Interests & Saved Repositories (T5-12)', () => {
  it('enforces founder pitch lifecycle without self-approval (P5-I03), strict doc checksums, and non-internal reviews', async () => {
    const mock = createRecordingClient({
      authUserId: USER_ID,
      sequentialResponses: [
        { data: buildPitchRow({ status: 'draft', approved_at: null, approved_by: null }) },
        { data: buildPitchRow({ status: 'closed', closed_at: '2026-11-21T00:00:00.000Z' }) },
        { data: { id: PITCH_ID } },
        { data: buildDocRow() },
        { data: [] },
      ],
    });
    const repo = createPitchRepository(mock.pitchClient);

    // Founder cannot jump status directly to approved or restricted (P5-I03)
    await expect(
      repo.transitionPitch({
        pitch_id: PITCH_ID,
        next_status: 'approved' as unknown as 'pending',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.pitch.invalidFounderTransition',
    });

    await expect(
      repo.createDraftPitch({
        company_id: COMPANY_ID,
        sector_id: SECTOR_ID,
        title_en: 'Self Approve Test',
        funding_stage: 'seed',
        target_amount_usd: 1000000,
        status: 'approved',
      } as unknown as Parameters<typeof repo.createDraftPitch>[0]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    // Reject .svg / non-canonical storage path / oversized pitch document / bad SHA-256 before DB call
    await expect(
      repo.createPitchDocument({
        pitch_id: PITCH_ID,
        company_id: COMPANY_ID,
        category: 'pitch_deck',
        file_name: 'xss.svg',
        storage_path: `${COMPANY_ID}/${PITCH_ID}/${DOC_UUID}.svg`,
        mime_type: 'image/svg+xml' as unknown as 'application/pdf',
        file_size_bytes: 1024,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(
      repo.createPitchDocument({
        pitch_id: PITCH_ID,
        company_id: COMPANY_ID,
        category: 'pitch_deck',
        file_name: 'deck.pdf',
        storage_path: CANONICAL_PITCH_PATH,
        mime_type: 'application/pdf',
        file_size_bytes: 25 * 1024 * 1024 + 1,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.document.maxSize25MB',
    });

    await expect(
      repo.createPitchDocument({
        pitch_id: PITCH_ID,
        company_id: COMPANY_ID,
        category: 'pitch_deck',
        file_name: 'deck.pdf',
        storage_path: CANONICAL_PITCH_PATH,
        mime_type: 'application/pdf',
        file_size_bytes: 1024,
        checksum_sha256: 'not-sha256',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.document.invalidChecksum',
    });

    // Valid draft pitch creation
    await repo.createDraftPitch({
      company_id: COMPANY_ID,
      sector_id: SECTOR_ID,
      title_ar: 'جولة مدار التأسيسية',
      title_en: 'Madar Seed',
      funding_stage: 'seed',
      target_amount_usd: 1500000,
      min_ticket_usd: 50000,
    });
    expect(mock.ops[0]?.table).toBe('pitches');
    expect(mock.ops[0]?.selectColumns).toBe(PITCH_SELECT_COLUMNS);
    expect(mock.ops[0]?.payload).toMatchObject({
      created_by: USER_ID,
      status: 'draft',
      is_featured: false,
    });

    // Closing an independently admin-approved pitch restricts prior status strictly to ['approved', 'restricted']
    await repo.transitionPitch({ pitch_id: PITCH_ID, next_status: 'closed' });
    expect(mock.ops[1]?.payload).toEqual({ status: 'closed' });
    expect(mock.ops[1]?.filters).toContainEqual({
      op: 'in',
      args: ['status', ['approved', 'restricted']],
    });

    // deleteDraftPitch executes DELETE strictly where status = 'draft'
    await repo.deleteDraftPitch(PITCH_ID);
    expect(mock.ops[2]?.action).toBe('delete');
    expect(mock.ops[2]?.filters).toContainEqual({ op: 'eq', args: ['status', 'draft'] });

    // Valid canonical pitch document creation
    await repo.createPitchDocument({
      pitch_id: PITCH_ID,
      company_id: COMPANY_ID,
      category: 'pitch_deck',
      file_name: 'madar-deck.pdf',
      storage_path: CANONICAL_PITCH_PATH,
      mime_type: 'application/pdf',
      file_size_bytes: 1024000,
      checksum_sha256: VALID_SHA256,
    });
    expect(mock.ops[3]?.table).toBe('pitch_documents');
    expect(mock.ops[3]?.selectColumns).toBe(PITCH_DOCUMENT_SELECT_COLUMNS);
    expect(mock.ops[3]?.payload).toMatchObject({
      uploaded_by: USER_ID,
      storage_bucket: 'pitch-documents',
      is_restricted: false,
      scan_status: 'pending',
      is_active: true,
    });

    // Non-internal pitch reviews only
    await repo.listNonInternalPitchReviews(PITCH_ID);
    expect(mock.ops[4]?.table).toBe('pitch_reviews');
    expect(mock.ops[4]?.selectColumns).toBe(PITCH_REVIEW_SELECT_COLUMNS);
    expect(mock.ops[4]?.filters).toContainEqual({ op: 'eq', args: ['is_internal', false] });
  });

  it('derives locked/unlocked pitch & document clearance accurately and protects investment_interests note boundaries', async () => {
    const restrictedPitch = buildPitchRow({ status: 'restricted' });
    const standardPitch = buildPitchRow({ status: 'approved' });
    const standardDoc = buildDocRow({ id: DOC_UUID, is_restricted: false, scan_status: 'clean' });
    const restrictedDoc = buildDocRow({
      id: DOC_RESTRICTED_UUID,
      is_restricted: true,
      scan_status: 'clean',
    });
    const quarantinedDoc = buildDocRow({
      id: '44444444-4444-4444-8444-444444444409',
      is_restricted: false,
      scan_status: 'quarantined',
    });

    const nowMs = Date.parse('2026-11-21T12:00:00.000Z');
    const activePitchGrant: PitchAccessGrantRow = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      pitch_id: PITCH_ID,
      pitch_document_id: null,
      user_id: OTHER_USER_ID,
      granted_by: USER_ID,
      reason: 'Diligence approved',
      expires_at: '2026-12-01T00:00:00.000Z',
      revoked_at: null,
      revoked_by: null,
      created_at: '2026-11-20T00:00:00.000Z',
      updated_at: '2026-11-20T00:00:00.000Z',
    };
    const expiredGrant: PitchAccessGrantRow = {
      ...activePitchGrant,
      expires_at: '2026-11-20T00:00:00.000Z',
    };
    const revokedGrant: PitchAccessGrantRow = {
      ...activePitchGrant,
      revoked_at: '2026-11-21T01:00:00.000Z',
    };

    expect(
      derivePitchAccessState({
        pitch: restrictedPitch,
        documents: [restrictedDoc],
        myGrants: [],
        nowMs,
      }),
    ).toMatchObject({
      accessMode: 'restricted_locked',
      hasActivePitchGrant: false,
      isLocked: true,
    });

    expect(
      derivePitchAccessState({
        pitch: restrictedPitch,
        documents: [restrictedDoc],
        myGrants: [expiredGrant, revokedGrant],
        nowMs,
      }),
    ).toMatchObject({
      accessMode: 'restricted_locked',
      hasActivePitchGrant: false,
      isLocked: true,
    });

    const grantedSummary = derivePitchAccessState({
      pitch: restrictedPitch,
      documents: [restrictedDoc, quarantinedDoc],
      myGrants: [activePitchGrant],
      nowMs,
    });
    expect(grantedSummary.accessMode).toBe('full');
    expect(grantedSummary.hasActivePitchGrant).toBe(true);
    expect(grantedSummary.unlockedDocumentIds.has(DOC_RESTRICTED_UUID)).toBe(true);
    expect(grantedSummary.unlockedDocumentIds.has(quarantinedDoc.id)).toBe(false);

    const mixedSummary = derivePitchAccessState({
      pitch: standardPitch,
      documents: [standardDoc, restrictedDoc],
      myGrants: [],
      nowMs,
    });
    expect(mixedSummary.accessMode).toBe('full');
    expect(mixedSummary.unlockedDocumentIds.has(DOC_UUID)).toBe(true);
    expect(mixedSummary.unlockedDocumentIds.has(DOC_RESTRICTED_UUID)).toBe(false);
    expect(mixedSummary.isLocked).toBe(true);

    // Investment interests investor vs founder note isolation + keyset pitch browsing
    const mock = createRecordingClient({
      authUserId: OTHER_USER_ID,
      sequentialResponses: [
        { data: [standardPitch] },
        {
          data: {
            id: INTEREST_ID,
            pitch_id: PITCH_ID,
            investor_id: OTHER_USER_ID,
            status: 'submitted',
          },
        },
        {
          data: {
            id: INTEREST_ID,
            pitch_id: PITCH_ID,
            investor_id: OTHER_USER_ID,
            status: 'withdrawn',
          },
        },
        {
          data: {
            id: INTEREST_ID,
            pitch_id: PITCH_ID,
            status: 'shortlisted',
            founder_notes: 'Strong fit',
          },
        },
      ],
    });
    const repo = createPitchRepository(mock.pitchClient);

    const cursor = encodeCursor({
      featured: true,
      ts: '2026-11-20T00:00:00.000Z',
      id: PITCH_ID,
    });
    const feed = await repo.listAccessiblePitches({ q: 'مدآر', cursor, limit: 10 });
    expect(feed.items).toHaveLength(1);
    expect(mock.ops[0]?.filters).toContainEqual({
      op: 'in',
      args: ['status', ['approved', 'restricted']],
    });

    await repo.submitInvestmentInterest({
      pitch_id: PITCH_ID,
      indicative_amount_usd: 150000,
      message: 'Interested in Series A allocation.',
    });
    expect(mock.ops[1]?.selectColumns).toBe(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS);
    expect(mock.ops[1]?.selectColumns).not.toContain('founder_notes');
    expect(mock.ops[1]?.payload).toMatchObject({
      pitch_id: PITCH_ID,
      investor_id: OTHER_USER_ID,
      status: 'submitted',
    });

    await repo.withdrawInvestmentInterest(INTEREST_ID);
    expect(mock.ops[2]?.selectColumns).toBe(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS);
    expect(mock.ops[2]?.filters).toContainEqual({ op: 'neq', args: ['status', 'withdrawn'] });

    await expect(
      repo.respondToInvestmentInterest({
        interest_id: INTEREST_ID,
        status: 'withdrawn',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await repo.respondToInvestmentInterest({
      interest_id: INTEREST_ID,
      status: 'shortlisted',
      founder_notes: 'Strong fit',
    });
    expect(mock.ops[3]?.selectColumns).toBe(INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS);
  });

  it('toggles saved_items via delete/insert without update and applies/rolls back optimistic cache pages', async () => {
    const savedRow: SavedItemRow = {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      user_id: USER_ID,
      entity_type: 'pitch',
      entity_id: PITCH_ID,
      notes: 'Watch round progress',
      created_at: '2026-11-21T10:00:00.000Z',
    };

    const mock = createRecordingClient({
      authUserId: USER_ID,
      sequentialResponses: [
        { data: null }, // delete finds no existing bookmark
        { data: savedRow }, // insert creates bookmark
        { data: savedRow }, // next toggle removes bookmark cleanly
      ],
    });
    const repo = createSavedRepository(mock.savedClient);

    const added = await repo.toggleSavedItem({
      entity_type: 'pitch',
      entity_id: PITCH_ID,
      notes: 'Watch round progress',
    });
    expect(added.saved).toBe(true);
    expect(added.item?.id).toBe(savedRow.id);
    expect(mock.ops[0]?.action).toBe('delete');
    expect(mock.ops[1]?.action).toBe('insert');
    expect(mock.ops[1]?.selectColumns).toBe(SAVED_ITEM_SELECT_COLUMNS);

    const removed = await repo.toggleSavedItem({ entity_type: 'pitch', entity_id: PITCH_ID });
    expect(removed.saved).toBe(false);
    expect(removed.item).toBeNull();
    expect(mock.ops[2]?.action).toBe('delete');

    const snapshot = {
      pages: [{ items: [] as readonly SavedItemRow[], nextCursor: null, hasNextPage: false }],
      pageParams: [null],
    };
    const optimisticOn = applyOptimisticSavedItemPages(snapshot, {
      userId: USER_ID,
      entityType: 'pitch',
      entityId: PITCH_ID,
      nextSaved: true,
    });
    expect(optimisticOn?.pages[0]?.items).toHaveLength(1);
    expect(optimisticOn?.pages[0]?.items[0]?.entity_id).toBe(PITCH_ID);

    const optimisticOff = applyOptimisticSavedItemPages(optimisticOn, {
      userId: USER_ID,
      entityType: 'pitch',
      entityId: PITCH_ID,
      nextSaved: false,
    });
    expect(optimisticOff?.pages[0]?.items).toHaveLength(0);
  });

  it('keeps M5.3 SELECT constants synchronized with 0002/0003/0004/0007 and enforces isApproved hook gating', () => {
    const migration0002 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0002_core_tables.sql'),
      'utf8',
    );
    const migration0003 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0003_deal_flow_and_governance_tables.sql'),
      'utf8',
    );
    const migration0004 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0004_ops_notifications_and_audit_tables.sql'),
      'utf8',
    );
    const migration0007 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0007_rls_helpers_views_and_policies.sql'),
      'utf8',
    );

    const splitCols = (s: string) => s.split(',').map((c) => c.trim());

    for (const col of splitCols(COMPANY_SELF_SELECT_COLUMNS)) {
      expect(migration0002).toContain(col);
    }
    for (const col of splitCols(COMPANY_MEMBER_SELECT_COLUMNS)) {
      expect(migration0002).toContain(col);
    }
    for (const col of splitCols(PITCH_SELECT_COLUMNS)) {
      expect(migration0003).toContain(col);
    }
    for (const col of splitCols(PITCH_DOCUMENT_SELECT_COLUMNS)) {
      expect(migration0003).toContain(col);
    }
    for (const col of splitCols(PITCH_ACCESS_GRANT_SELECT_COLUMNS)) {
      expect(migration0003).toContain(col);
    }
    for (const col of splitCols(INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS)) {
      expect(migration0003).toContain(col);
    }
    for (const col of splitCols(SAVED_ITEM_SELECT_COLUMNS)) {
      expect(migration0003).toContain(col);
    }

    // Verification request columns must match the 14 non-internal columns granted in 0007 lines 350-365
    const verifCols = splitCols(VERIFICATION_REQUEST_SELECT_COLUMNS);
    expect(verifCols).toHaveLength(14);
    for (const col of verifCols) {
      expect(migration0004).toContain(col);
      expect(migration0007).toContain(col);
    }

    const usePitchesSource = readFileSync(
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/usePitches.ts'),
      'utf8',
    );
    const useSavedSource = readFileSync(
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/useSavedItems.ts'),
      'utf8',
    );

    // Every query hook in usePitches & useSavedItems gates on isApproved
    expect(usePitchesSource.match(/enabled:\s*Boolean\(userId\)\s*&&\s*isApproved/g)?.length).toBe(
      9,
    );
    expect(useSavedSource.match(/enabled:\s*Boolean\(userId\)\s*&&\s*isApproved/g)?.length).toBe(2);
    expect(useSavedSource).toContain('errors.accountApprovalRequired');
  });
});
