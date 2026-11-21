import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CursorPageResponse,
  PublicCompanyDirectoryRow,
  PublicInvestorDirectoryRow,
  PublicPortfolioCompanyDirectoryRow,
  PublicSystemFlagRow,
  PublicSystemFlags,
  SectorRow,
} from '@shark/shared-types';
import { buildCursorPage, buildPostgrestSearchOrClause } from '@shark/utils';
import {
  companyDirectoryFilterSchema,
  investorDirectoryFilterSchema,
  paginationQuerySchema,
  slugSchema,
  uuidSchema,
} from '@shark/validation';
import type { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';
import {
  applyFeaturedTimestampCursorFilter,
  clampPageLimit,
  EPOCH_CURSOR_TS,
  parseRepositoryInput,
  resolveCursorOrThrow,
  resolvePublicAssetUrl,
} from './helpers';

export const PUBLIC_SECTOR_SELECT_COLUMNS = [
  'id',
  'slug',
  'name_ar',
  'name_en',
  'description_ar',
  'description_en',
  'icon_name',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

/**
 * Zero-PII explicit projection matching `public.public_investors_directory` (`0007`).
 * Excludes email, phone, is_accredited, rejection_reason, and suspension_reason.
 */
export const PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS = [
  'investor_id',
  'user_id',
  'full_name',
  'full_name_ar',
  'full_name_en',
  'headline_ar',
  'headline_en',
  'bio_ar',
  'bio_en',
  'avatar_path',
  'country_code',
  'city_ar',
  'city_en',
  'investor_type',
  'firm_name_ar',
  'firm_name_en',
  'title_ar',
  'title_en',
  'thesis_ar',
  'thesis_en',
  'focus_sector_ids',
  'preferred_stages',
  'ticket_min_usd',
  'ticket_max_usd',
  'currency_code',
  'geography_focus',
  'website_url',
  'linkedin_url',
  'is_featured',
  'portfolio_count',
  'approved_at',
].join(', ');

/**
 * Zero-PII explicit projection matching `public.public_companies_directory` (`0007`).
 * Excludes registration_number, owner_id, admin_feedback, and rejection_reason.
 */
export const PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS = [
  'id',
  'slug',
  'name_ar',
  'name_en',
  'tagline_ar',
  'tagline_en',
  'description_ar',
  'description_en',
  'logo_path',
  'banner_path',
  'sector_id',
  'secondary_sector_ids',
  'stage',
  'founded_year',
  'country_code',
  'city_ar',
  'city_en',
  'team_size_band',
  'website_url',
  'linkedin_url',
  'verification_status',
  'is_featured',
  'approved_at',
].join(', ');

export const PUBLIC_PORTFOLIO_DIRECTORY_SELECT_COLUMNS = [
  'id',
  'investor_user_id',
  'company_id',
  'external_name_ar',
  'external_name_en',
  'logo_path',
  'sector_id',
  'investment_stage',
  'investment_year',
  'website_url',
  'summary_ar',
  'summary_en',
  'is_exited',
  'sort_order',
].join(', ');

const INVESTOR_SEARCH_COLUMNS = [
  'full_name',
  'full_name_ar',
  'full_name_en',
  'headline_ar',
  'headline_en',
  'firm_name_ar',
  'firm_name_en',
  'title_ar',
  'title_en',
  'thesis_ar',
  'thesis_en',
] as const;

const COMPANY_SEARCH_COLUMNS = ['name_ar', 'name_en', 'tagline_ar', 'tagline_en'] as const;

export type InvestorDirectoryFilterInput = z.input<typeof investorDirectoryFilterSchema>;
export type CompanyDirectoryFilterInput = z.input<typeof companyDirectoryFilterSchema>;

export interface PublicDirectorySearchInput {
  readonly q: string;
  readonly sectorId?: string;
  readonly limit?: number;
}

export interface PublicDirectorySearchResult {
  readonly investors: CursorPageResponse<PublicInvestorDirectoryRow>;
  readonly companies: CursorPageResponse<PublicCompanyDirectoryRow>;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readBooleanFlag(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  const obj = asObjectRecord(value);
  if (obj && typeof obj.enabled === 'boolean') {
    return obj.enabled;
  }
  return fallback;
}

export function parsePublicSystemFlags(rows: readonly PublicSystemFlagRow[]): PublicSystemFlags {
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    if (typeof row.setting_key === 'string' && row.setting_key.length > 0) {
      raw[row.setting_key] = row.value;
    }
  }

  const registrationValue = raw['registration.enabled'] ?? raw.registration_open;
  const maintenanceValue = raw['maintenance.banner'] ?? raw.maintenance_mode;
  const maintenanceObj = asObjectRecord(maintenanceValue);

  return Object.freeze({
    registrationEnabled: readBooleanFlag(registrationValue, true),
    maintenanceBanner: Object.freeze({
      enabled: readBooleanFlag(maintenanceValue, false),
      messageAr: typeof maintenanceObj?.message_ar === 'string' ? maintenanceObj.message_ar : '',
      messageEn: typeof maintenanceObj?.message_en === 'string' ? maintenanceObj.message_en : '',
    }),
    raw: Object.freeze(raw),
  });
}

export interface MobileDirectoryRepository {
  readonly listActiveSectors: (limit?: number) => Promise<readonly SectorRow[]>;
  readonly getSectorBySlug: (slug: string) => Promise<SectorRow | null>;
  readonly getPublicSystemFlags: () => Promise<PublicSystemFlags>;
  readonly listPublicInvestors: (
    filters?: InvestorDirectoryFilterInput,
  ) => Promise<CursorPageResponse<PublicInvestorDirectoryRow>>;
  readonly getPublicInvestorById: (
    investorId: string,
  ) => Promise<PublicInvestorDirectoryRow | null>;
  readonly listPublicPortfolioCompanies: (
    investorUserId: string,
    limit?: number,
  ) => Promise<readonly PublicPortfolioCompanyDirectoryRow[]>;
  readonly listPublicCompanies: (
    filters?: CompanyDirectoryFilterInput,
  ) => Promise<CursorPageResponse<PublicCompanyDirectoryRow>>;
  readonly getPublicCompanyById: (companyId: string) => Promise<PublicCompanyDirectoryRow | null>;
  readonly getPublicCompanyBySlug: (slug: string) => Promise<PublicCompanyDirectoryRow | null>;
  readonly searchPublicDirectory: (
    input: PublicDirectorySearchInput,
  ) => Promise<PublicDirectorySearchResult>;
  readonly getPublicAssetUrl: (storagePath: string | null | undefined) => string | null;
}

/**
 * Public non-PII discovery & search repository for Guests, Pending, and Approved users.
 * Queries ONLY `sectors`, `get_public_system_flags()`, and `public_*_directory` views.
 */
export function createDirectoryRepository(client: SupabaseClient): MobileDirectoryRepository {
  const listActiveSectors = async (limit = 50): Promise<readonly SectorRow[]> => {
    const safeLimit = clampPageLimit(limit, 50);
    return executeServiceCall(async () => {
      const result = await client
        .from('sectors')
        .select(PUBLIC_SECTOR_SELECT_COLUMNS)
        .eq('is_active', true)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
        .limit(safeLimit);

      const rows = await assertSupabaseResult(result);
      return (rows ?? []) as unknown as SectorRow[];
    });
  };

  const getSectorBySlug = async (slug: string): Promise<SectorRow | null> => {
    const validSlug = parseRepositoryInput(slugSchema, slug);
    return executeServiceCall(async () => {
      const result = await client
        .from('sectors')
        .select(PUBLIC_SECTOR_SELECT_COLUMNS)
        .eq('slug', validSlug)
        .eq('is_active', true)
        .is('deleted_at', null)
        .maybeSingle<SectorRow>();

      return (await assertSupabaseResult(result)) ?? null;
    });
  };

  const getPublicSystemFlags = async (): Promise<PublicSystemFlags> => {
    return executeServiceCall(async () => {
      const result = await client.rpc('get_public_system_flags');
      const rows = await assertSupabaseResult(result);
      return parsePublicSystemFlags((rows ?? []) as PublicSystemFlagRow[]);
    });
  };

  const listPublicInvestors = async (
    filters?: InvestorDirectoryFilterInput,
  ): Promise<CursorPageResponse<PublicInvestorDirectoryRow>> => {
    const valid = parseRepositoryInput(investorDirectoryFilterSchema, filters ?? {});
    const decodedCursor = resolveCursorOrThrow(valid.cursor);
    const limit = clampPageLimit(valid.limit, 20);

    return executeServiceCall(async () => {
      let query = client
        .from('public_investors_directory')
        .select(PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS);

      if (valid.investorType) {
        query = query.eq('investor_type', valid.investorType);
      }
      if (valid.sectorId) {
        query = query.contains('focus_sector_ids', [valid.sectorId]);
      }
      if (valid.stage) {
        query = query.contains('preferred_stages', [valid.stage]);
      }
      if (valid.countryCode) {
        query = query.eq('country_code', valid.countryCode);
      }
      if (valid.minTicketUsd !== undefined) {
        query = query.or(
          `ticket_max_usd.gte.${valid.minTicketUsd},and(ticket_max_usd.is.null,ticket_min_usd.gte.${valid.minTicketUsd})`,
        );
      }
      if (valid.maxTicketUsd !== undefined) {
        query = query.or(
          `ticket_min_usd.lte.${valid.maxTicketUsd},and(ticket_min_usd.is.null,ticket_max_usd.lte.${valid.maxTicketUsd})`,
        );
      }
      if (valid.featuredOnly) {
        query = query.eq('is_featured', true);
      }

      const searchClause = buildPostgrestSearchOrClause(INVESTOR_SEARCH_COLUMNS, valid.q);
      if (searchClause) {
        query = query.or(searchClause);
      }

      query = applyFeaturedTimestampCursorFilter(query, decodedCursor, {
        idColumn: 'investor_id',
        featuredOnly: Boolean(valid.featuredOnly),
      });

      const result = await query
        .order('is_featured', { ascending: false })
        .order('approved_at', { ascending: false, nullsFirst: false })
        .order('investor_id', { ascending: false })
        .limit(limit + 1);

      const rows = (await assertSupabaseResult(result)) ?? [];
      return buildCursorPage(rows as unknown as PublicInvestorDirectoryRow[], limit, (item) => ({
        featured: item.is_featured,
        ts: item.approved_at ?? EPOCH_CURSOR_TS,
        id: item.investor_id,
      }));
    });
  };

  const getPublicInvestorById = async (
    investorId: string,
  ): Promise<PublicInvestorDirectoryRow | null> => {
    const validId = parseRepositoryInput(uuidSchema, investorId);
    return executeServiceCall(async () => {
      const result = await client
        .from('public_investors_directory')
        .select(PUBLIC_INVESTOR_DIRECTORY_SELECT_COLUMNS)
        .eq('investor_id', validId)
        .maybeSingle<PublicInvestorDirectoryRow>();

      return (await assertSupabaseResult(result)) ?? null;
    });
  };

  const listPublicPortfolioCompanies = async (
    investorUserId: string,
    limit = 50,
  ): Promise<readonly PublicPortfolioCompanyDirectoryRow[]> => {
    const validUserId = parseRepositoryInput(uuidSchema, investorUserId);
    const safeLimit = clampPageLimit(limit, 50);

    return executeServiceCall(async () => {
      const result = await client
        .from('public_portfolio_companies_directory')
        .select(PUBLIC_PORTFOLIO_DIRECTORY_SELECT_COLUMNS)
        .eq('investor_user_id', validUserId)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true })
        .limit(safeLimit);

      const rows = await assertSupabaseResult(result);
      return (rows ?? []) as unknown as PublicPortfolioCompanyDirectoryRow[];
    });
  };

  const listPublicCompanies = async (
    filters?: CompanyDirectoryFilterInput,
  ): Promise<CursorPageResponse<PublicCompanyDirectoryRow>> => {
    const valid = parseRepositoryInput(companyDirectoryFilterSchema, filters ?? {});
    const decodedCursor = resolveCursorOrThrow(valid.cursor);
    const limit = clampPageLimit(valid.limit, 20);

    return executeServiceCall(async () => {
      let query = client
        .from('public_companies_directory')
        .select(PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS);

      if (valid.sectorId) {
        query = query.or(
          `sector_id.eq.${valid.sectorId},secondary_sector_ids.cs.{${valid.sectorId}}`,
        );
      }
      if (valid.stage) {
        query = query.eq('stage', valid.stage);
      }
      if (valid.countryCode) {
        query = query.eq('country_code', valid.countryCode);
      }
      if (valid.verificationStatus) {
        query = query.eq('verification_status', valid.verificationStatus);
      }
      if (valid.featuredOnly) {
        query = query.eq('is_featured', true);
      }

      const searchClause = buildPostgrestSearchOrClause(COMPANY_SEARCH_COLUMNS, valid.q);
      if (searchClause) {
        query = query.or(searchClause);
      }

      query = applyFeaturedTimestampCursorFilter(query, decodedCursor, {
        idColumn: 'id',
        featuredOnly: Boolean(valid.featuredOnly),
      });

      const result = await query
        .order('is_featured', { ascending: false })
        .order('approved_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(limit + 1);

      const rows = (await assertSupabaseResult(result)) ?? [];
      return buildCursorPage(rows as unknown as PublicCompanyDirectoryRow[], limit, (item) => ({
        featured: item.is_featured,
        ts: item.approved_at ?? EPOCH_CURSOR_TS,
        id: item.id,
      }));
    });
  };

  const getPublicCompanyById = async (
    companyId: string,
  ): Promise<PublicCompanyDirectoryRow | null> => {
    const validId = parseRepositoryInput(uuidSchema, companyId);
    return executeServiceCall(async () => {
      const result = await client
        .from('public_companies_directory')
        .select(PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS)
        .eq('id', validId)
        .maybeSingle<PublicCompanyDirectoryRow>();

      return (await assertSupabaseResult(result)) ?? null;
    });
  };

  const getPublicCompanyBySlug = async (
    slug: string,
  ): Promise<PublicCompanyDirectoryRow | null> => {
    const validSlug = parseRepositoryInput(slugSchema, slug);
    return executeServiceCall(async () => {
      const result = await client
        .from('public_companies_directory')
        .select(PUBLIC_COMPANY_DIRECTORY_SELECT_COLUMNS)
        .eq('slug', validSlug)
        .maybeSingle<PublicCompanyDirectoryRow>();

      return (await assertSupabaseResult(result)) ?? null;
    });
  };

  const searchPublicDirectory = async (
    input: PublicDirectorySearchInput,
  ): Promise<PublicDirectorySearchResult> => {
    const { limit } = parseRepositoryInput(paginationQuerySchema, { limit: input.limit ?? 20 });
    const [investors, companies] = await Promise.all([
      listPublicInvestors({ q: input.q, sectorId: input.sectorId, limit }),
      listPublicCompanies({ q: input.q, sectorId: input.sectorId, limit }),
    ]);

    return { investors, companies };
  };

  return {
    listActiveSectors,
    getSectorBySlug,
    getPublicSystemFlags,
    listPublicInvestors,
    getPublicInvestorById,
    listPublicPortfolioCompanies,
    listPublicCompanies,
    getPublicCompanyById,
    getPublicCompanyBySlug,
    searchPublicDirectory,
    getPublicAssetUrl: (storagePath) => resolvePublicAssetUrl(client, storagePath),
  };
}
