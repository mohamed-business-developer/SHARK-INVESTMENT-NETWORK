import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COMPANY_MEMBER_ROLES,
  COMPANY_MEMBER_STATUSES,
  type CompanyMemberRow,
  type CompanyRow,
} from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  boundedTextSchema,
  inviteCompanyMemberSchema,
  upsertCompanySchema,
  uuidSchema,
} from '@shark/validation';
import { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';
import {
  clampPageLimit,
  parseRepositoryInput,
  requireAuthenticatedUser,
  requireEntityRow,
} from './helpers';

export const COMPANY_SELF_SELECT_COLUMNS = [
  'id',
  'owner_id',
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
  'registration_number',
  'status',
  'verification_status',
  'is_featured',
  'rejection_reason',
  'admin_feedback',
  'approved_at',
  'approved_by',
  'verified_at',
  'verified_by',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const COMPANY_MEMBER_SELECT_COLUMNS = [
  'id',
  'company_id',
  'user_id',
  'member_role',
  'title_ar',
  'title_en',
  'status',
  'can_manage_pitches',
  'can_manage_documents',
  'invited_by',
  'joined_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const updateCompanyMemberSchema = z
  .object({
    member_role: z.enum(COMPANY_MEMBER_ROLES).optional(),
    title_ar: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    title_en: boundedTextSchema(1, 100, 'validation.jobTitle').nullable().optional(),
    status: z.enum(COMPANY_MEMBER_STATUSES).optional(),
    can_manage_pitches: z.boolean().optional(),
    can_manage_documents: z.boolean().optional(),
  })
  .strict();

export type UpsertCompanyInput = z.input<typeof upsertCompanySchema>;
export type InviteCompanyMemberInput = z.input<typeof inviteCompanyMemberSchema>;
export type UpdateCompanyMemberInput = z.input<typeof updateCompanyMemberSchema>;

function buildSafeCompanyWritePayload(valid: z.output<typeof upsertCompanySchema>) {
  return {
    slug: valid.slug,
    name_ar: valid.name_ar ?? null,
    name_en: valid.name_en ?? null,
    tagline_ar: valid.tagline_ar ?? null,
    tagline_en: valid.tagline_en ?? null,
    description_ar: valid.description_ar ?? null,
    description_en: valid.description_en ?? null,
    logo_path: valid.logo_path ?? null,
    banner_path: valid.banner_path ?? null,
    sector_id: valid.sector_id,
    secondary_sector_ids: valid.secondary_sector_ids,
    stage: valid.stage,
    founded_year: valid.founded_year ?? null,
    country_code: valid.country_code,
    city_ar: valid.city_ar ?? null,
    city_en: valid.city_en ?? null,
    team_size_band: valid.team_size_band ?? null,
    website_url: valid.website_url ?? null,
    linkedin_url: valid.linkedin_url ?? null,
    registration_number: valid.registration_number ?? null,
  };
}

function buildSafeMemberUpdatePayload(
  valid: z.output<typeof updateCompanyMemberSchema>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (valid.member_role !== undefined) payload.member_role = valid.member_role;
  if (valid.title_ar !== undefined) payload.title_ar = valid.title_ar;
  if (valid.title_en !== undefined) payload.title_en = valid.title_en;
  if (valid.can_manage_pitches !== undefined) {
    payload.can_manage_pitches = valid.can_manage_pitches;
  }
  if (valid.can_manage_documents !== undefined) {
    payload.can_manage_documents = valid.can_manage_documents;
  }
  if (valid.status !== undefined) {
    payload.status = valid.status;
    if (valid.status === 'active') {
      payload.joined_at = new Date().toISOString();
    }
  }

  return payload;
}

export interface MobileCompanyRepository {
  readonly listMyOperatedCompanies: (limit?: number) => Promise<readonly CompanyRow[]>;
  readonly getOperatedCompanyById: (companyId: string) => Promise<CompanyRow | null>;
  readonly createCompany: (input: UpsertCompanyInput) => Promise<CompanyRow>;
  readonly updateCompany: (companyId: string, input: UpsertCompanyInput) => Promise<CompanyRow>;
  readonly submitCompanyForReview: (companyId: string) => Promise<CompanyRow>;
  readonly listCompanyMembers: (
    companyId: string,
    limit?: number,
  ) => Promise<readonly CompanyMemberRow[]>;
  readonly inviteCompanyMember: (input: InviteCompanyMemberInput) => Promise<CompanyMemberRow>;
  readonly updateCompanyMember: (
    memberId: string,
    input: UpdateCompanyMemberInput,
  ) => Promise<CompanyMemberRow>;
  readonly removeCompanyMember: (memberId: string) => Promise<void>;
}

/**
 * Founder/company-operator CRUD, review submission, and team membership repository.
 * Enforces verified `auth.uid()` ownership and strict Zod schemas excluding status/verification privileges.
 */
export function createCompanyRepository(client: SupabaseClient): MobileCompanyRepository {
  return {
    async listMyOperatedCompanies(limit = 50): Promise<readonly CompanyRow[]> {
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);

        const membershipResult = await client
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .limit(50);

        const memberships = (await assertSupabaseResult(membershipResult)) ?? [];
        const memberCompanyIds = Array.from(
          new Set(
            memberships
              .map((row) => (row as { readonly company_id?: unknown }).company_id)
              .filter((id): id is string => uuidSchema.safeParse(id).success),
          ),
        );

        let query = client
          .from('companies')
          .select(COMPANY_SELF_SELECT_COLUMNS)
          .is('deleted_at', null);

        if (memberCompanyIds.length > 0) {
          query = query.or(`owner_id.eq.${user.id},id.in.(${memberCompanyIds.join(',')})`);
        } else {
          query = query.eq('owner_id', user.id);
        }

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as CompanyRow[];
      });
    },

    async getOperatedCompanyById(companyId: string): Promise<CompanyRow | null> {
      const validId = parseRepositoryInput(uuidSchema, companyId);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('companies')
          .select(COMPANY_SELF_SELECT_COLUMNS)
          .eq('id', validId)
          .is('deleted_at', null)
          .maybeSingle<CompanyRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async createCompany(input: UpsertCompanyInput): Promise<CompanyRow> {
      const valid = parseRepositoryInput(upsertCompanySchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('companies')
          .insert({
            owner_id: user.id,
            status: 'draft',
            verification_status: 'unverified',
            is_featured: false,
            ...buildSafeCompanyWritePayload(valid),
          })
          .select(COMPANY_SELF_SELECT_COLUMNS)
          .single<CompanyRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async updateCompany(companyId: string, input: UpsertCompanyInput): Promise<CompanyRow> {
      const validId = parseRepositoryInput(uuidSchema, companyId);
      const valid = parseRepositoryInput(upsertCompanySchema, input);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('companies')
          .update(buildSafeCompanyWritePayload(valid))
          .eq('id', validId)
          .is('deleted_at', null)
          .select(COMPANY_SELF_SELECT_COLUMNS)
          .maybeSingle<CompanyRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async submitCompanyForReview(companyId: string): Promise<CompanyRow> {
      const validId = parseRepositoryInput(uuidSchema, companyId);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('companies')
          .update({ status: 'pending' })
          .eq('id', validId)
          .in('status', ['draft', 'rejected'])
          .is('deleted_at', null)
          .select(COMPANY_SELF_SELECT_COLUMNS)
          .maybeSingle<CompanyRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async listCompanyMembers(companyId: string, limit = 50): Promise<readonly CompanyMemberRow[]> {
      const validCompanyId = parseRepositoryInput(uuidSchema, companyId);
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('company_members')
          .select(COMPANY_MEMBER_SELECT_COLUMNS)
          .eq('company_id', validCompanyId)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as CompanyMemberRow[];
      });
    },

    async inviteCompanyMember(input: InviteCompanyMemberInput): Promise<CompanyMemberRow> {
      const valid = parseRepositoryInput(inviteCompanyMemberSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        if (valid.user_id === user.id) {
          throw new AppDomainError({
            code: 'VALIDATION_ERROR',
            messageKey: 'errors.cannotActOnSelf',
            statusCode: 400,
          });
        }

        const result = await client
          .from('company_members')
          .insert({
            company_id: valid.company_id,
            user_id: valid.user_id,
            member_role: valid.member_role,
            title_ar: valid.title_ar ?? null,
            title_en: valid.title_en ?? null,
            status: 'invited',
            can_manage_pitches: valid.can_manage_pitches,
            can_manage_documents: valid.can_manage_documents,
            invited_by: user.id,
          })
          .select(COMPANY_MEMBER_SELECT_COLUMNS)
          .single<CompanyMemberRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async updateCompanyMember(
      memberId: string,
      input: UpdateCompanyMemberInput,
    ): Promise<CompanyMemberRow> {
      const validMemberId = parseRepositoryInput(uuidSchema, memberId);
      const valid = parseRepositoryInput(updateCompanyMemberSchema, input);
      const safePayload = buildSafeMemberUpdatePayload(valid);

      if (Object.keys(safePayload).length === 0) {
        throw new AppDomainError({
          code: 'VALIDATION_ERROR',
          messageKey: 'errors.validationFailed',
          statusCode: 400,
        });
      }

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('company_members')
          .update(safePayload)
          .eq('id', validMemberId)
          .is('deleted_at', null)
          .select(COMPANY_MEMBER_SELECT_COLUMNS)
          .maybeSingle<CompanyMemberRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async removeCompanyMember(memberId: string): Promise<void> {
      const validMemberId = parseRepositoryInput(uuidSchema, memberId);

      await executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('company_members')
          .delete()
          .eq('id', validMemberId)
          .neq('user_id', user.id)
          .select('id')
          .maybeSingle<{ readonly id: string }>();

        requireEntityRow(await assertSupabaseResult(result));
      });
    },
  };
}
