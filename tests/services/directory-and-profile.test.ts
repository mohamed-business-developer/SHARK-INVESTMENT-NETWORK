import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  PublicCompanyDirectoryRow,
  PublicInvestorDirectoryRow,
  SectorRow,
} from '@shark/shared-types';
import {
  buildPostgrestSearchOrClause,
  encodeCursor,
  filterSectorsByQuery,
  normalizeArabicText,
  pickLocalizedText,
  sanitizeSearchQuery,
  type AppDomainError,
} from '@shark/utils';
import { PROFILE_SELF_SELECT_COLUMNS } from '../../apps/mobile/src/repositories/auth.repository';
import {
  createDirectoryRepository,
  parsePublicSystemFlags,
  PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS,
  PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS,
  PUBLIC_PORTFOLIO_DIRECTORY_SELECT_COLUMNS,
  PUBLIC_SECTOR_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/directory.repository';
import {
  createProfileRepository,
  FOUNDER_PROFILE_SELECT_COLUMNS,
  INVESTOR_PROFILE_SELECT_COLUMNS,
  PORTFOLIO_COMPANY_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/profile.repository';

type DirectorySupabaseClient = Parameters<typeof createDirectoryRepository>[0];
type ProfileSupabaseClient = Parameters<typeof createProfileRepository>[0];

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const USER_ID = '11111111-1111-4111-8111-111111111103';
const OTHER_USER_ID = '11111111-1111-4111-8111-111111111104';
const SECTOR_ID = '55555555-5555-4555-8555-555555555501';
const COMPANY_ID = '22222222-2222-4222-8222-222222222201';
const PORTFOLIO_ID = '66666666-6666-4666-8666-666666666601';

interface RecordedOp {
  table: string;
  action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  selectColumns?: string;
  payload?: unknown;
  upsertOptions?: unknown;
  filters: Array<{ op: string; args: unknown[] }>;
  orders: Array<{ column: string; options: unknown }>;
  limitValue?: number;
}

function createRecordingClient(config?: {
  authUserId?: string | null;
  authError?: boolean;
  responseData?: unknown;
  responseError?: unknown;
}) {
  const ops: RecordedOp[] = [];
  const publicUrlCalls: Array<{ bucket: string; path: string }> = [];

  const from = (table: string) => {
    const op: RecordedOp = {
      table,
      action: 'select',
      filters: [],
      orders: [],
    };
    ops.push(op);

    const resolveResult = async () => ({
      data: config?.responseData ?? null,
      error: config?.responseError ?? null,
    });

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
      upsert(payload: unknown, upsertOptions?: unknown) {
        op.action = 'upsert';
        op.payload = payload;
        op.upsertOptions = upsertOptions;
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
      is(col: string, val: unknown) {
        op.filters.push({ op: 'is', args: [col, val] });
        return chain;
      },
      lt(col: string, val: unknown) {
        op.filters.push({ op: 'lt', args: [col, val] });
        return chain;
      },
      contains(col: string, val: unknown) {
        op.filters.push({ op: 'contains', args: [col, val] });
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
          : { data: { user: { id: config.authUserId, email: 'user@shark.test' } }, error: null },
    },
    from,
    rpc: async (fnName: string) => {
      ops.push({ table: fnName, action: 'rpc', filters: [], orders: [] });
      return {
        data: config?.responseData ?? [],
        error: config?.responseError ?? null,
      };
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => {
          publicUrlCalls.push({ bucket, path });
          return {
            data: {
              publicUrl: `http://127.0.0.1:54321/storage/v1/object/public/${bucket}/${path}`,
            },
          };
        },
      }),
    },
  };

  return {
    ops,
    publicUrlCalls,
    directoryClient: client as unknown as DirectorySupabaseClient,
    profileClient: client as unknown as ProfileSupabaseClient,
  };
}

function buildInvestorDirectorySample(
  overrides?: Partial<PublicInvestorDirectoryRow>,
): PublicInvestorDirectoryRow {
  return {
    investor_id: '77777777-7777-4777-8777-777777777701',
    user_id: USER_ID,
    full_name: 'Noura Al-Qasimi',
    full_name_ar: 'نورة القاسمي',
    full_name_en: 'Noura Al-Qasimi',
    headline_ar: 'شريك إداري • صندوق آفاق',
    headline_en: 'Managing Partner • Horizon Ventures',
    bio_ar: null,
    bio_en: null,
    avatar_path: null,
    country_code: 'SA',
    city_ar: 'الرياض',
    city_en: 'Riyadh',
    investor_type: 'vc_fund',
    firm_name_ar: 'صندوق آفاق',
    firm_name_en: 'Horizon Ventures',
    title_ar: 'شريك إداري',
    title_en: 'Managing Partner',
    thesis_ar: 'التقنية المالية',
    thesis_en: 'FinTech & Enterprise',
    focus_sector_ids: [SECTOR_ID],
    preferred_stages: ['seed', 'series_a'],
    ticket_min_usd: 250000,
    ticket_max_usd: 1000000,
    currency_code: 'USD',
    geography_focus: ['SA', 'AE'],
    website_url: 'https://horizon.example',
    linkedin_url: null,
    is_featured: true,
    portfolio_count: 4,
    approved_at: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

function buildCompanyDirectorySample(
  overrides?: Partial<PublicCompanyDirectoryRow>,
): PublicCompanyDirectoryRow {
  return {
    id: COMPANY_ID,
    slug: 'madar-fintech-fixture',
    name_ar: 'منظومة مدار',
    name_en: 'Madar FinTech Fixture',
    tagline_ar: 'بنية المدفوعات الفورية',
    tagline_en: 'Instant B2B settlement infrastructure',
    description_ar: null,
    description_en: null,
    logo_path: null,
    banner_path: null,
    sector_id: SECTOR_ID,
    secondary_sector_ids: [],
    stage: 'series_a',
    founded_year: 2023,
    country_code: 'SA',
    city_ar: 'الرياض',
    city_en: 'Riyadh',
    team_size_band: '11-50',
    website_url: 'https://madar.example',
    linkedin_url: null,
    verification_status: 'verified',
    is_featured: true,
    approved_at: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

describe('M5.2 Public Discovery, Bilingual Search & Keyset Directory Repository (T5-09)', () => {
  it('mirrors PostgreSQL Arabic normalization and builds safe PostgREST search filters', () => {
    expect(normalizeArabicText('مَدَارْ')).toBe('مدار');
    expect(normalizeArabicText('مدآر')).toBe('مدار');
    expect(normalizeArabicText('شركة آفاق')).toBe('شركه افاق');
    expect(normalizeArabicText('  Horizon   Ventures  ')).toBe('horizon ventures');

    expect(sanitizeSearchQuery('(),;"\'')).toBeNull();

    const arabicOr = buildPostgrestSearchOrClause(['name_ar', 'name_en'], 'مدآر');
    expect(arabicOr).toBeTruthy();
    expect(arabicOr).toContain('name_ar.imatch.');
    expect(arabicOr).toContain('[اأإآ]');
    // Validate the generated regex matches real seed strings regardless of Alef/diacritics
    const regexStr = arabicOr!.split(',')[0]!.replace('name_ar.imatch.', '');
    const compiled = new RegExp(regexStr, 'i');
    expect(compiled.test('منظومة مدار')).toBe(true);
    expect(compiled.test('مَدَار')).toBe(true);
    expect(compiled.test('مدآر')).toBe(true);

    const afaqOr = buildPostgrestSearchOrClause(['firm_name_ar'], 'افاق');
    const afaqRegex = new RegExp(afaqOr!.replace('firm_name_ar.imatch.', ''), 'i');
    expect(afaqRegex.test('صندوق آفاق')).toBe(true);

    const englishOr = buildPostgrestSearchOrClause(['name_en'], 'Madar_50% (Inc)');
    expect(englishOr).toBe('name_en.ilike.*madar\\_50\\% inc*');

    const sectors: SectorRow[] = [
      {
        id: SECTOR_ID,
        slug: 'fintech',
        name_ar: 'التقنية المالية',
        name_en: 'FinTech',
        description_ar: 'المدفوعات الرقمية',
        description_en: 'Digital payments',
        icon_name: 'landmark',
        sort_order: 1,
        is_active: true,
        created_at: '2026-11-20T00:00:00.000Z',
        updated_at: '2026-11-20T00:00:00.000Z',
        deleted_at: null,
      },
    ];
    expect(filterSectorsByQuery(sectors, 'التقنيه الماليه')).toHaveLength(1);
    expect(filterSectorsByQuery(sectors, 'fintech')).toHaveLength(1);
    expect(pickLocalizedText('ar', 'عربي', 'English')).toBe('عربي');
    expect(pickLocalizedText('en', 'عربي', '')).toBe('عربي');
  });

  it('parses get_public_system_flags() cleanly and limits public assets to public-assets bucket', async () => {
    const flags = parsePublicSystemFlags([
      { setting_key: 'registration.enabled', value: { enabled: true } },
      {
        setting_key: 'maintenance.banner',
        value: { enabled: true, message_ar: 'صيانة مجدولة', message_en: 'Scheduled maintenance' },
      },
    ]);
    expect(flags.registrationEnabled).toBe(true);
    expect(flags.maintenanceBanner).toEqual({
      enabled: true,
      messageAr: 'صيانة مجدولة',
      messageEn: 'Scheduled maintenance',
    });

    const mock = createRecordingClient({
      responseData: [{ setting_key: 'registration.enabled', value: { enabled: false } }],
    });
    const repo = createDirectoryRepository(mock.directoryClient);
    const liveFlags = await repo.getPublicSystemFlags();
    expect(liveFlags.registrationEnabled).toBe(false);
    expect(mock.ops[0]?.action).toBe('rpc');
    expect(mock.ops[0]?.table).toBe('get_public_system_flags');

    expect(repo.getPublicAssetUrl(`avatars/${USER_ID}/${PORTFOLIO_ID}.png`)).toContain(
      '/storage/v1/object/public/public-assets/',
    );
    expect(repo.getPublicAssetUrl('../../verification-documents/secret.pdf')).toBeNull();
    expect(mock.publicUrlCalls).toHaveLength(1);
    expect(mock.publicUrlCalls[0]?.bucket).toBe('public-assets');
  });

  it('queries public_investors_directory using investor_id keyset pagination, explicit non-PII columns, and strict filter validation', async () => {
    const row1 = buildInvestorDirectorySample({
      investor_id: '77777777-7777-4777-8777-777777777702',
      is_featured: true,
    });
    const row2 = buildInvestorDirectorySample({
      investor_id: '77777777-7777-4777-8777-777777777701',
      is_featured: false,
    });

    const mock = createRecordingClient({ responseData: [row1, row2] });
    const repo = createDirectoryRepository(mock.directoryClient);

    const page = await repo.listPublicInvestors({
      q: 'افاق',
      investorType: 'vc_fund',
      sectorId: SECTOR_ID,
      stage: 'series_a',
      countryCode: 'sa',
      minTicketUsd: 100000,
      maxTicketUsd: 500000,
      limit: 1,
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.investor_id).toBe(row1.investor_id);
    expect(page.hasNextPage).toBe(true);
    expect(page.nextCursor).toBeTruthy();

    const op = mock.ops[0]!;
    expect(op.table).toBe('public_investors_directory');
    expect(op.selectColumns).toBe(PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS);
    expect(op.limitValue).toBe(2);
    expect(op.orders.map((o) => o.column)).toEqual(['is_featured', 'approved_at', 'investor_id']);

    // Page 2 with valid cursor applies exact keyset predicate
    const mockPage2 = createRecordingClient({ responseData: [row2] });
    const repo2 = createDirectoryRepository(mockPage2.directoryClient);
    const page2 = await repo2.listPublicInvestors({ cursor: page.nextCursor, limit: 1 });
    expect(page2.hasNextPage).toBe(false);
    expect(page2.nextCursor).toBeNull();
    const orClause = mockPage2.ops[0]?.filters.find((f) => f.op === 'or')?.args[0] as string;
    expect(orClause).toContain(`is_featured.eq.false`);
    expect(orClause).toContain(`investor_id.lt.${row1.investor_id}`);

    // Reject forged or malformed cursors fail-closed before touching Supabase
    await expect(
      repo.listPublicInvestors({ cursor: 'not-valid-base64url!!' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    const injectionCursor = encodeCursor({
      featured: true,
      ts: '2026-01-01T00:00:00Z,id.gt.0',
      id: USER_ID,
    });
    await expect(repo.listPublicInvestors({ cursor: injectionCursor })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    // Reject oversized limit (> 50) fail-closed
    await expect(repo.listPublicInvestors({ limit: 51 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('queries public_companies_directory and public_portfolio_companies_directory cleanly without PII', async () => {
    const company = buildCompanyDirectorySample();
    const mock = createRecordingClient({ responseData: [company] });
    const repo = createDirectoryRepository(mock.directoryClient);

    const companiesPage = await repo.listPublicCompanies({
      q: 'مدآر',
      sectorId: SECTOR_ID,
      verificationStatus: 'verified',
      featuredOnly: true,
      limit: 10,
    });

    expect(companiesPage.items).toHaveLength(1);
    expect(companiesPage.items[0]?.slug).toBe('madar-fintech-fixture');
    const op = mock.ops[0]!;
    expect(op.table).toBe('public_companies_directory');
    expect(op.selectColumns).toBe(PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS);
    expect(op.orders.map((o) => o.column)).toEqual(['is_featured', 'approved_at', 'id']);

    // Investor detail queries strictly on `investor_id`, never `id`
    await repo.getPublicInvestorById(USER_ID);
    const invDetailOp = mock.ops[1]!;
    expect(invDetailOp.table).toBe('public_investors_directory');
    expect(invDetailOp.filters).toContainEqual({ op: 'eq', args: ['investor_id', USER_ID] });
  });
});

describe('M5.2 Profile, Investor & Founder Repositories + RLS Alignment (T5-10)', () => {
  it('enforces authenticated identity and rejects privilege mass assignment before DB calls', async () => {
    const unauthMock = createRecordingClient({ authUserId: null, authError: true });
    const unauthRepo = createProfileRepository(unauthMock.profileClient);

    await expect(unauthRepo.getOwnProfile()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
    expect(unauthMock.ops).toHaveLength(0);

    const authMock = createRecordingClient({ authUserId: USER_ID });
    const repo = createProfileRepository(authMock.profileClient);

    await expect(
      repo.updateOwnProfile({
        full_name: 'Attacker',
        role: 'admin',
      } as unknown as Parameters<typeof repo.updateOwnProfile>[0]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(
      repo.updateOwnProfile({
        account_status: 'approved',
      } as unknown as Parameters<typeof repo.updateOwnProfile>[0]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(repo.updateOwnProfile({})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });

    await expect(
      repo.upsertInvestorProfile({
        investor_type: 'vc_fund',
        is_accredited: true,
        is_featured: true,
        portfolio_count: 99,
      } as unknown as Parameters<typeof repo.upsertInvestorProfile>[0]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });

    await expect(
      repo.upsertInvestorProfile({
        investor_type: 'vc_fund',
        ticket_min_usd: 500000,
        ticket_max_usd: 100000,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.ticket.maxBelowMin',
    });

    await expect(
      repo.createPortfolioCompany({
        external_name_ar: null,
        external_name_en: null,
        company_id: null,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      messageKey: 'validation.portfolio.nameOrCompanyRequired',
    });

    // ZERO Supabase queries made after all synchronous validation rejections
    expect(authMock.ops).toHaveLength(0);
  });

  it('derives ownership from verified auth.uid() across profile, investor, founder & portfolio CRUD', async () => {
    const profileRow = { id: USER_ID, full_name: 'Noura Al-Qasimi' };
    const profileMock = createRecordingClient({ authUserId: USER_ID, responseData: profileRow });
    const profileRepo = createProfileRepository(profileMock.profileClient);

    await profileRepo.updateOwnProfile({
      full_name_ar: 'نورة القاسمي',
      preferred_language: 'ar',
      analytics_opt_in: false,
    });
    const updOp = profileMock.ops[0]!;
    expect(updOp.table).toBe('profiles');
    expect(updOp.action).toBe('update');
    expect(updOp.selectColumns).toBe(PROFILE_SELF_SELECT_COLUMNS);
    expect(updOp.filters).toContainEqual({ op: 'eq', args: ['id', USER_ID] });

    const investorMock = createRecordingClient({
      authUserId: USER_ID,
      responseData: { id: PORTFOLIO_ID, user_id: USER_ID, investor_type: 'angel' },
    });
    const invRepo = createProfileRepository(investorMock.profileClient);
    await invRepo.upsertInvestorProfile({
      investor_type: 'angel',
      firm_name_ar: 'آفاق',
      ticket_min_usd: 50000,
      ticket_max_usd: 250000,
    });
    const invOp = investorMock.ops[0]!;
    expect(invOp.table).toBe('investors');
    expect(invOp.action).toBe('upsert');
    expect(invOp.upsertOptions).toEqual({ onConflict: 'user_id' });
    expect(invOp.selectColumns).toBe(INVESTOR_PROFILE_SELECT_COLUMNS);
    const invPayload = invOp.payload as Record<string, unknown>;
    expect(invPayload.user_id).toBe(USER_ID);
    expect(invPayload).not.toHaveProperty('is_accredited');
    expect(invPayload).not.toHaveProperty('is_featured');
    expect(invPayload).not.toHaveProperty('portfolio_count');

    const founderMock = createRecordingClient({
      authUserId: USER_ID,
      responseData: { id: PORTFOLIO_ID, user_id: USER_ID },
    });
    await createProfileRepository(founderMock.profileClient).upsertFounderProfile({
      job_title_en: 'Co-Founder & CEO',
      experience_years: 8,
      previous_exits_count: 1,
      primary_sector_id: SECTOR_ID,
    });
    expect(founderMock.ops[0]?.table).toBe('founders');
    expect(founderMock.ops[0]?.selectColumns).toBe(FOUNDER_PROFILE_SELECT_COLUMNS);
    expect((founderMock.ops[0]?.payload as Record<string, unknown>).user_id).toBe(USER_ID);

    // Portfolio create, update (not-found guard), and hard delete (aligned with RLS)
    const portfolioMock = createRecordingClient({
      authUserId: USER_ID,
      responseData: { id: PORTFOLIO_ID, investor_user_id: USER_ID },
    });
    const portRepo = createProfileRepository(portfolioMock.profileClient);

    await portRepo.createPortfolioCompany({
      external_name_ar: 'شركة سحاب',
      sector_id: SECTOR_ID,
      investment_stage: 'seed',
    });
    expect(portfolioMock.ops[0]?.table).toBe('portfolio_companies');
    expect(portfolioMock.ops[0]?.action).toBe('insert');
    expect(portfolioMock.ops[0]?.selectColumns).toBe(PORTFOLIO_COMPANY_SELECT_COLUMNS);
    expect((portfolioMock.ops[0]?.payload as Record<string, unknown>).investor_user_id).toBe(
      USER_ID,
    );

    await portRepo.deletePortfolioCompany(PORTFOLIO_ID);
    const delOp = portfolioMock.ops[1]!;
    expect(delOp.table).toBe('portfolio_companies');
    expect(delOp.action).toBe('delete');
    expect(delOp.filters).toContainEqual({ op: 'eq', args: ['id', PORTFOLIO_ID] });
    expect(delOp.filters).toContainEqual({ op: 'eq', args: ['investor_user_id', USER_ID] });

    // Cross-tenant/missing portfolio item returns 404 cleanly
    const notFoundMock = createRecordingClient({ authUserId: OTHER_USER_ID, responseData: null });
    await expect(
      createProfileRepository(notFoundMock.profileClient).updatePortfolioCompany(PORTFOLIO_ID, {
        external_name_en: 'Hijack',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });

    const onDeleteNotFound = vi.fn();
    await expect(
      createProfileRepository(notFoundMock.profileClient)
        .deletePortfolioCompany(PORTFOLIO_ID)
        .catch((err) => {
          onDeleteNotFound(err);
          throw err;
        }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    expect(onDeleteNotFound).toHaveBeenCalledTimes(1);
    expect((onDeleteNotFound.mock.calls[0]?.[0] as AppDomainError).messageKey).toBe(
      'errors.entityNotFound',
    );
  });

  it('keeps repository SELECT projections strictly synchronized with Phase 4 views and tables (zero PII drift)', () => {
    const migration0007 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0007_rls_helpers_views_and_policies.sql'),
      'utf8',
    );
    const migration0002 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0002_core_tables.sql'),
      'utf8',
    );
    const migration0003 = readFileSync(
      resolve(REPO_ROOT, 'supabase/migrations/0003_deal_flow_and_governance_tables.sql'),
      'utf8',
    );

    const investorCols = PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS.split(',').map((s) => s.trim());
    for (const forbiddenPii of [
      'email',
      'phone',
      'is_accredited',
      'rejection_reason',
      'suspension_reason',
      'search_text',
    ]) {
      expect(investorCols).not.toContain(forbiddenPii);
    }
    expect(migration0007).toContain('CREATE OR REPLACE VIEW public.public_investors_directory');
    expect(investorCols).toContain('investor_id');

    const companyCols = PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS.split(',').map((s) => s.trim());
    for (const forbiddenSensitive of [
      'registration_number',
      'owner_id',
      'admin_feedback',
      'rejection_reason',
      'search_text',
    ]) {
      expect(companyCols).not.toContain(forbiddenSensitive);
    }
    expect(migration0007).toContain('CREATE OR REPLACE VIEW public.public_companies_directory');

    const portfolioDirCols = PUBLIC_PORTFOLIO_DIRECTORY_SELECT_COLUMNS.split(',').map((s) =>
      s.trim(),
    );
    expect(portfolioDirCols).not.toContain('deleted_at');
    expect(migration0007).toContain(
      'CREATE OR REPLACE VIEW public.public_portfolio_companies_directory',
    );

    for (const col of PUBLIC_SECTOR_SELECT_COLUMNS.split(',').map((s) => s.trim())) {
      expect(migration0002).toContain(col);
    }
    for (const col of PORTFOLIO_COMPANY_SELECT_COLUMNS.split(',').map((s) => s.trim())) {
      expect(migration0003).toContain(col);
    }
    for (const col of FOUNDER_PROFILE_SELECT_COLUMNS.split(',').map((s) => s.trim())) {
      expect(migration0002).toContain(col);
    }
  });
});
