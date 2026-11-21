import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FounderProfileRow,
  InvestorProfileRow,
  PortfolioCompanyRow,
  ProfileRow,
} from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  updateOwnProfileSchema,
  upsertFounderProfileSchema,
  upsertInvestorProfileSchema,
  upsertPortfolioCompanySchema,
  uuidSchema,
} from '@shark/validation';
import type { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';
import { PROFILE_SELF_SELECT_COLUMNS } from './auth.repository';
import {
  clampPageLimit,
  parseRepositoryInput,
  requireAuthenticatedUser,
  requireEntityRow,
} from './helpers';

export const INVESTOR_PROFILE_SELECT_COLUMNS = [
  'id',
  'user_id',
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
  'is_accredited',
  'accreditation_verified_at',
  'is_featured',
  'is_public_listed',
  'portfolio_count',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const FOUNDER_PROFILE_SELECT_COLUMNS = [
  'id',
  'user_id',
  'job_title_ar',
  'job_title_en',
  'experience_years',
  'previous_exits_count',
  'founder_bio_ar',
  'founder_bio_en',
  'linkedin_url',
  'primary_sector_id',
  'is_public_listed',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const PORTFOLIO_COMPANY_SELECT_COLUMNS = [
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
  'is_public',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export type UpdateOwnProfileInput = z.input<typeof updateOwnProfileSchema>;
export type UpsertInvestorProfileInput = z.input<typeof upsertInvestorProfileSchema>;
export type UpsertFounderProfileInput = z.input<typeof upsertFounderProfileSchema>;
export type UpsertPortfolioCompanyInput = z.input<typeof upsertPortfolioCompanySchema>;

function buildSafeProfileUpdatePayload(
  valid: z.output<typeof updateOwnProfileSchema>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (valid.full_name !== undefined) payload.full_name = valid.full_name;
  if (valid.full_name_ar !== undefined) payload.full_name_ar = valid.full_name_ar;
  if (valid.full_name_en !== undefined) payload.full_name_en = valid.full_name_en;
  if (valid.headline_ar !== undefined) payload.headline_ar = valid.headline_ar;
  if (valid.headline_en !== undefined) payload.headline_en = valid.headline_en;
  if (valid.bio_ar !== undefined) payload.bio_ar = valid.bio_ar;
  if (valid.bio_en !== undefined) payload.bio_en = valid.bio_en;
  if (valid.phone !== undefined) payload.phone = valid.phone;
  if (valid.avatar_path !== undefined) payload.avatar_path = valid.avatar_path;
  if (valid.country_code !== undefined) payload.country_code = valid.country_code;
  if (valid.city_ar !== undefined) payload.city_ar = valid.city_ar;
  if (valid.city_en !== undefined) payload.city_en = valid.city_en;
  if (valid.preferred_language !== undefined) payload.preferred_language = valid.preferred_language;
  if (valid.interest_sector_ids !== undefined) {
    payload.interest_sector_ids = valid.interest_sector_ids;
  }
  if (valid.notification_preferences !== undefined) {
    payload.notification_preferences = valid.notification_preferences;
  }
  if (valid.analytics_opt_in !== undefined) payload.analytics_opt_in = valid.analytics_opt_in;

  return payload;
}

function buildSafePortfolioPayload(valid: z.output<typeof upsertPortfolioCompanySchema>) {
  return {
    company_id: valid.company_id ?? null,
    external_name_ar: valid.external_name_ar ?? null,
    external_name_en: valid.external_name_en ?? null,
    logo_path: valid.logo_path ?? null,
    sector_id: valid.sector_id ?? null,
    investment_stage: valid.investment_stage ?? null,
    investment_year: valid.investment_year ?? null,
    website_url: valid.website_url ?? null,
    summary_ar: valid.summary_ar ?? null,
    summary_en: valid.summary_en ?? null,
    is_exited: valid.is_exited,
    is_public: valid.is_public,
    sort_order: valid.sort_order,
  };
}

export interface MobileProfileRepository {
  readonly getOwnProfile: () => Promise<ProfileRow | null>;
  readonly updateOwnProfile: (input: UpdateOwnProfileInput) => Promise<ProfileRow>;
  readonly getOwnInvestorProfile: () => Promise<InvestorProfileRow | null>;
  readonly upsertInvestorProfile: (
    input: UpsertInvestorProfileInput,
  ) => Promise<InvestorProfileRow>;
  readonly getOwnFounderProfile: () => Promise<FounderProfileRow | null>;
  readonly getPublicFounderByUserId: (userId: string) => Promise<FounderProfileRow | null>;
  readonly upsertFounderProfile: (input: UpsertFounderProfileInput) => Promise<FounderProfileRow>;
  readonly listOwnPortfolioCompanies: (limit?: number) => Promise<readonly PortfolioCompanyRow[]>;
  readonly createPortfolioCompany: (
    input: UpsertPortfolioCompanyInput,
  ) => Promise<PortfolioCompanyRow>;
  readonly updatePortfolioCompany: (
    portfolioCompanyId: string,
    input: UpsertPortfolioCompanyInput,
  ) => Promise<PortfolioCompanyRow>;
  readonly deletePortfolioCompany: (portfolioCompanyId: string) => Promise<void>;
}

/**
 * Own profile, investor thesis/portfolio, and founder profile repository.
 * Enforces strict Zod payloads excluding all DB privilege columns; ownership relies on verified `auth.getUser()`.
 */
export function createProfileRepository(client: SupabaseClient): MobileProfileRepository {
  return {
    async getOwnProfile(): Promise<ProfileRow | null> {
      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('profiles')
          .select(PROFILE_SELF_SELECT_COLUMNS)
          .eq('id', user.id)
          .is('deleted_at', null)
          .maybeSingle<ProfileRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async updateOwnProfile(input: UpdateOwnProfileInput): Promise<ProfileRow> {
      const valid = parseRepositoryInput(updateOwnProfileSchema, input);
      const safePayload = buildSafeProfileUpdatePayload(valid);

      if (Object.keys(safePayload).length === 0) {
        throw new AppDomainError({
          code: 'VALIDATION_ERROR',
          messageKey: 'errors.validationFailed',
          statusCode: 400,
        });
      }

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('profiles')
          .update(safePayload)
          .eq('id', user.id)
          .is('deleted_at', null)
          .select(PROFILE_SELF_SELECT_COLUMNS)
          .maybeSingle<ProfileRow>();

        const updated = await assertSupabaseResult(result);
        return requireEntityRow(updated, 'errors.profileNotFound');
      });
    },

    async getOwnInvestorProfile(): Promise<InvestorProfileRow | null> {
      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('investors')
          .select(INVESTOR_PROFILE_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle<InvestorProfileRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async upsertInvestorProfile(input: UpsertInvestorProfileInput): Promise<InvestorProfileRow> {
      const valid = parseRepositoryInput(upsertInvestorProfileSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const safePayload = {
          user_id: user.id,
          investor_type: valid.investor_type,
          firm_name_ar: valid.firm_name_ar ?? null,
          firm_name_en: valid.firm_name_en ?? null,
          title_ar: valid.title_ar ?? null,
          title_en: valid.title_en ?? null,
          thesis_ar: valid.thesis_ar ?? null,
          thesis_en: valid.thesis_en ?? null,
          focus_sector_ids: valid.focus_sector_ids,
          preferred_stages: valid.preferred_stages,
          ticket_min_usd: valid.ticket_min_usd ?? null,
          ticket_max_usd: valid.ticket_max_usd ?? null,
          currency_code: valid.currency_code,
          geography_focus: valid.geography_focus,
          website_url: valid.website_url ?? null,
          linkedin_url: valid.linkedin_url ?? null,
          is_public_listed: valid.is_public_listed,
        };

        const result = await client
          .from('investors')
          .upsert(safePayload, { onConflict: 'user_id' })
          .select(INVESTOR_PROFILE_SELECT_COLUMNS)
          .single<InvestorProfileRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async getOwnFounderProfile(): Promise<FounderProfileRow | null> {
      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('founders')
          .select(FOUNDER_PROFILE_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle<FounderProfileRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async getPublicFounderByUserId(userId: string): Promise<FounderProfileRow | null> {
      const validUserId = parseRepositoryInput(uuidSchema, userId);

      return executeServiceCall(async () => {
        const result = await client
          .from('founders')
          .select(FOUNDER_PROFILE_SELECT_COLUMNS)
          .eq('user_id', validUserId)
          .eq('is_public_listed', true)
          .is('deleted_at', null)
          .maybeSingle<FounderProfileRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async upsertFounderProfile(input: UpsertFounderProfileInput): Promise<FounderProfileRow> {
      const valid = parseRepositoryInput(upsertFounderProfileSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const safePayload = {
          user_id: user.id,
          job_title_ar: valid.job_title_ar ?? null,
          job_title_en: valid.job_title_en ?? null,
          experience_years: valid.experience_years ?? null,
          previous_exits_count: valid.previous_exits_count,
          founder_bio_ar: valid.founder_bio_ar ?? null,
          founder_bio_en: valid.founder_bio_en ?? null,
          linkedin_url: valid.linkedin_url ?? null,
          primary_sector_id: valid.primary_sector_id ?? null,
          is_public_listed: valid.is_public_listed,
        };

        const result = await client
          .from('founders')
          .upsert(safePayload, { onConflict: 'user_id' })
          .select(FOUNDER_PROFILE_SELECT_COLUMNS)
          .single<FounderProfileRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async listOwnPortfolioCompanies(limit = 50): Promise<readonly PortfolioCompanyRow[]> {
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('portfolio_companies')
          .select(PORTFOLIO_COMPANY_SELECT_COLUMNS)
          .eq('investor_user_id', user.id)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as PortfolioCompanyRow[];
      });
    },

    async createPortfolioCompany(input: UpsertPortfolioCompanyInput): Promise<PortfolioCompanyRow> {
      const valid = parseRepositoryInput(upsertPortfolioCompanySchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('portfolio_companies')
          .insert({
            investor_user_id: user.id,
            ...buildSafePortfolioPayload(valid),
          })
          .select(PORTFOLIO_COMPANY_SELECT_COLUMNS)
          .single<PortfolioCompanyRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async updatePortfolioCompany(
      portfolioCompanyId: string,
      input: UpsertPortfolioCompanyInput,
    ): Promise<PortfolioCompanyRow> {
      const validId = parseRepositoryInput(uuidSchema, portfolioCompanyId);
      const valid = parseRepositoryInput(upsertPortfolioCompanySchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('portfolio_companies')
          .update(buildSafePortfolioPayload(valid))
          .eq('id', validId)
          .eq('investor_user_id', user.id)
          .is('deleted_at', null)
          .select(PORTFOLIO_COMPANY_SELECT_COLUMNS)
          .maybeSingle<PortfolioCompanyRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async deletePortfolioCompany(portfolioCompanyId: string): Promise<void> {
      const validId = parseRepositoryInput(uuidSchema, portfolioCompanyId);

      await executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        // Hard delete aligns with `portfolio_companies_delete_investor_or_admin` RLS
        // (investor UPDATE enforces `WITH CHECK (deleted_at IS NULL)`) and updates `investors.portfolio_count` trigger.
        const result = await client
          .from('portfolio_companies')
          .delete()
          .eq('id', validId)
          .eq('investor_user_id', user.id)
          .select('id')
          .maybeSingle<{ readonly id: string }>();

        requireEntityRow(await assertSupabaseResult(result));
      });
    },
  };
}
