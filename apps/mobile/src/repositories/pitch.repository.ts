import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PITCH_DOCUMENT_CATEGORIES,
  type CursorPageResponse,
  type InvestmentInterestRow,
  type InvestmentInterestStatus,
  type PitchAccessGrantRow,
  type PitchAccessMode,
  type PitchDocumentRow,
  type PitchReviewRow,
  type PitchRow,
  type PitchStatus,
} from '@shark/shared-types';
import { AppDomainError, buildCursorPage, buildPostgrestSearchOrClause } from '@shark/utils';
import {
  boundedTextSchema,
  createInvestmentInterestSchema,
  createPitchDocumentSchema,
  founderPitchTransitionSchema,
  grantPitchAccessSchema,
  paginationQuerySchema,
  pitchDirectoryFilterSchema,
  revokePitchAccessSchema,
  updateInvestmentInterestResponseSchema,
  upsertPitchSchema,
  uuidSchema,
} from '@shark/validation';
import { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';
import {
  applyCreatedAtCursorFilter,
  applyFeaturedTimestampCursorFilter,
  clampPageLimit,
  EPOCH_CURSOR_TS,
  parseRepositoryInput,
  requireAuthenticatedUser,
  requireEntityRow,
  resolveCursorOrThrow,
  verifyCompanyOperator,
} from './helpers';

export const PITCH_SELECT_COLUMNS = [
  'id',
  'company_id',
  'created_by',
  'sector_id',
  'title_ar',
  'title_en',
  'summary_ar',
  'summary_en',
  'problem_ar',
  'problem_en',
  'solution_ar',
  'solution_en',
  'market_opportunity_ar',
  'market_opportunity_en',
  'traction_metrics',
  'use_of_funds_ar',
  'use_of_funds_en',
  'funding_stage',
  'instrument',
  'target_amount_usd',
  'min_ticket_usd',
  'pre_money_valuation_usd',
  'equity_offered_pct',
  'currency_code',
  'closing_date',
  'status',
  'is_featured',
  'rejection_reason',
  'submitted_at',
  'approved_at',
  'approved_by',
  'closed_at',
  'restricted_at',
  'restricted_by',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export const PITCH_DOCUMENT_SELECT_COLUMNS = [
  'id',
  'pitch_id',
  'company_id',
  'uploaded_by',
  'category',
  'title_ar',
  'title_en',
  'file_name',
  'storage_bucket',
  'storage_path',
  'mime_type',
  'file_size_bytes',
  'checksum_sha256',
  'is_restricted',
  'restriction_reason',
  'restricted_at',
  'restricted_by',
  'scan_status',
  'is_active',
  'sort_order',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

/**
 * Operator-facing review projection; omits moderator-only notes and restricts to `is_internal = false`.
 */
export const PITCH_REVIEW_SELECT_COLUMNS = [
  'id',
  'pitch_id',
  'reviewer_id',
  'decision',
  'checklist',
  'feedback_ar',
  'feedback_en',
  'is_internal',
  'created_at',
].join(', ');

export const PITCH_ACCESS_GRANT_SELECT_COLUMNS = [
  'id',
  'pitch_id',
  'pitch_document_id',
  'user_id',
  'granted_by',
  'reason',
  'expires_at',
  'revoked_at',
  'revoked_by',
  'created_at',
  'updated_at',
].join(', ');

/**
 * Investor-facing investment interest projection strictly omitting `founder_notes`.
 */
export const INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS = [
  'id',
  'pitch_id',
  'company_id',
  'investor_id',
  'indicative_amount_usd',
  'message',
  'status',
  'reviewed_at',
  'withdrawn_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

/**
 * Founder/company-operator projection including `founder_notes`.
 */
export const INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS = [
  'id',
  'pitch_id',
  'company_id',
  'investor_id',
  'indicative_amount_usd',
  'message',
  'status',
  'founder_notes',
  'reviewed_at',
  'withdrawn_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

const PITCH_SEARCH_COLUMNS = ['title_ar', 'title_en', 'summary_ar', 'summary_en'] as const;

export interface PitchAccessSummary {
  readonly accessMode: PitchAccessMode;
  readonly hasActivePitchGrant: boolean;
  readonly unlockedDocumentIds: ReadonlySet<string>;
  readonly isLocked: boolean;
}

export function isPitchAccessGrantActive(
  grant: Pick<PitchAccessGrantRow, 'revoked_at' | 'expires_at'>,
  nowMs: number = Date.now(),
): boolean {
  if (grant.revoked_at !== null) {
    return false;
  }
  if (grant.expires_at === null) {
    return true;
  }
  const expiresMs = Date.parse(grant.expires_at);
  return !Number.isNaN(expiresMs) && expiresMs > nowMs;
}

/**
 * Derives UI lock / clearance state purely from server-returned pitch, documents, and active grants.
 */
export function derivePitchAccessState(params: {
  readonly pitch: PitchRow | null;
  readonly documents?: readonly PitchDocumentRow[];
  readonly myGrants?: readonly PitchAccessGrantRow[];
  readonly isOperator?: boolean;
  readonly nowMs?: number;
}): PitchAccessSummary {
  const { pitch, documents = [], myGrants = [], isOperator = false, nowMs = Date.now() } = params;

  if (!pitch) {
    return {
      accessMode: 'restricted_locked',
      hasActivePitchGrant: false,
      unlockedDocumentIds: new Set<string>(),
      isLocked: true,
    };
  }

  const activeGrants = myGrants.filter(
    (grant) => grant.pitch_id === pitch.id && isPitchAccessGrantActive(grant, nowMs),
  );
  const hasActivePitchGrant = activeGrants.some((grant) => grant.pitch_document_id === null);
  const unlockedDocumentIds = new Set<string>();

  for (const doc of documents) {
    if (isOperator) {
      unlockedDocumentIds.add(doc.id);
      continue;
    }
    if (doc.scan_status === 'quarantined' || !doc.is_active) {
      continue;
    }
    const docSpecificGrant = activeGrants.some((grant) => grant.pitch_document_id === doc.id);
    if (
      hasActivePitchGrant ||
      docSpecificGrant ||
      (!doc.is_restricted && pitch.status === 'approved')
    ) {
      unlockedDocumentIds.add(doc.id);
    }
  }

  const pitchLocked = !isOperator && pitch.status === 'restricted' && !hasActivePitchGrant;
  const anyDocLocked =
    !isOperator && documents.some((doc) => doc.is_restricted && !unlockedDocumentIds.has(doc.id));
  const isLocked = pitchLocked || anyDocLocked;

  return {
    accessMode: pitchLocked ? 'restricted_locked' : 'full',
    hasActivePitchGrant,
    unlockedDocumentIds,
    isLocked,
  };
}

const OPERATOR_INTEREST_RESPONSE_STATUSES: ReadonlySet<InvestmentInterestStatus> = new Set([
  'reviewing',
  'shortlisted',
  'connected',
  'declined',
]);

export const updatePitchDocumentMetadataSchema = z
  .object({
    category: z.enum(PITCH_DOCUMENT_CATEGORIES).optional(),
    title_ar: boundedTextSchema(1, 160, 'validation.document.title').nullable().optional(),
    title_en: boundedTextSchema(1, 160, 'validation.document.title').nullable().optional(),
    sort_order: z.number().int().min(0).max(500).optional(),
  })
  .strict();

export type PitchDirectoryFilterInput = z.input<typeof pitchDirectoryFilterSchema>;
export type UpsertPitchInput = z.input<typeof upsertPitchSchema>;
export type FounderPitchTransitionInput = z.input<typeof founderPitchTransitionSchema>;
export type CreatePitchDocumentInput = z.input<typeof createPitchDocumentSchema>;
export type UpdatePitchDocumentMetadataInput = z.input<typeof updatePitchDocumentMetadataSchema>;
export type GrantPitchAccessInput = z.input<typeof grantPitchAccessSchema>;
export type RevokePitchAccessInput = z.input<typeof revokePitchAccessSchema>;
export type CreateInvestmentInterestInput = z.input<typeof createInvestmentInterestSchema>;
export type UpdateInvestmentInterestResponseInput = z.input<
  typeof updateInvestmentInterestResponseSchema
>;

function buildSafePitchWriteFields(valid: z.output<typeof upsertPitchSchema>) {
  return {
    sector_id: valid.sector_id,
    title_ar: valid.title_ar ?? null,
    title_en: valid.title_en ?? null,
    summary_ar: valid.summary_ar ?? null,
    summary_en: valid.summary_en ?? null,
    problem_ar: valid.problem_ar ?? null,
    problem_en: valid.problem_en ?? null,
    solution_ar: valid.solution_ar ?? null,
    solution_en: valid.solution_en ?? null,
    market_opportunity_ar: valid.market_opportunity_ar ?? null,
    market_opportunity_en: valid.market_opportunity_en ?? null,
    traction_metrics: valid.traction_metrics,
    use_of_funds_ar: valid.use_of_funds_ar ?? null,
    use_of_funds_en: valid.use_of_funds_en ?? null,
    funding_stage: valid.funding_stage,
    instrument: valid.instrument,
    target_amount_usd: valid.target_amount_usd,
    min_ticket_usd: valid.min_ticket_usd ?? null,
    pre_money_valuation_usd: valid.pre_money_valuation_usd ?? null,
    equity_offered_pct: valid.equity_offered_pct ?? null,
    currency_code: valid.currency_code,
    closing_date: valid.closing_date ?? null,
  };
}

export interface MobilePitchRepository {
  readonly listAccessiblePitches: (
    filters?: PitchDirectoryFilterInput,
  ) => Promise<CursorPageResponse<PitchRow>>;
  readonly getAccessiblePitchById: (pitchId: string) => Promise<PitchRow | null>;
  readonly listCompanyPitches: (
    companyId: string,
    options?: {
      readonly status?: PitchStatus;
      readonly cursor?: string | null;
      readonly limit?: number;
    },
  ) => Promise<CursorPageResponse<PitchRow>>;
  readonly createDraftPitch: (input: UpsertPitchInput) => Promise<PitchRow>;
  readonly updatePitch: (pitchId: string, input: UpsertPitchInput) => Promise<PitchRow>;
  readonly transitionPitch: (input: FounderPitchTransitionInput) => Promise<PitchRow>;
  readonly deleteDraftPitch: (pitchId: string) => Promise<void>;
  readonly listPitchDocuments: (
    pitchId: string,
    limit?: number,
  ) => Promise<readonly PitchDocumentRow[]>;
  readonly createPitchDocument: (input: CreatePitchDocumentInput) => Promise<PitchDocumentRow>;
  readonly updatePitchDocumentMetadata: (
    documentId: string,
    input: UpdatePitchDocumentMetadataInput,
  ) => Promise<PitchDocumentRow>;
  readonly deleteDraftPitchDocument: (documentId: string) => Promise<void>;
  readonly listNonInternalPitchReviews: (
    pitchId: string,
    limit?: number,
  ) => Promise<readonly PitchReviewRow[]>;
  readonly listMyPitchAccessGrants: (
    pitchId?: string,
    limit?: number,
  ) => Promise<readonly PitchAccessGrantRow[]>;
  readonly listPitchAccessGrantsForPitch: (
    pitchId: string,
    limit?: number,
  ) => Promise<readonly PitchAccessGrantRow[]>;
  readonly grantPitchAccess: (input: GrantPitchAccessInput) => Promise<PitchAccessGrantRow>;
  readonly revokePitchAccess: (input: RevokePitchAccessInput) => Promise<PitchAccessGrantRow>;
  readonly listOwnInvestmentInterests: (options?: {
    readonly cursor?: string | null;
    readonly limit?: number;
  }) => Promise<CursorPageResponse<InvestmentInterestRow>>;
  readonly listPitchInvestmentInterests: (
    pitchId: string,
    options?: { readonly cursor?: string | null; readonly limit?: number },
  ) => Promise<CursorPageResponse<InvestmentInterestRow>>;
  readonly submitInvestmentInterest: (
    input: CreateInvestmentInterestInput,
  ) => Promise<InvestmentInterestRow>;
  readonly withdrawInvestmentInterest: (interestId: string) => Promise<InvestmentInterestRow>;
  readonly respondToInvestmentInterest: (
    input: UpdateInvestmentInterestResponseInput,
  ) => Promise<InvestmentInterestRow>;
}

/**
 * Approved-gated pitches, document metadata, access grants, non-internal reviews, and investment interests repository.
 * Authorization, visibility, and status transitions rely on PostgreSQL RLS (`can_view_pitch`, `is_approved_user`) and DB triggers.
 */
export function createPitchRepository(client: SupabaseClient): MobilePitchRepository {
  return {
    async listAccessiblePitches(
      filters?: PitchDirectoryFilterInput,
    ): Promise<CursorPageResponse<PitchRow>> {
      const valid = parseRepositoryInput(pitchDirectoryFilterSchema, filters ?? {});
      const decodedCursor = resolveCursorOrThrow(valid.cursor);
      const limit = clampPageLimit(valid.limit, 20);

      return executeServiceCall(async () => {
        let query = client
          .from('pitches')
          .select(PITCH_SELECT_COLUMNS)
          .in('status', ['approved', 'restricted'])
          .is('deleted_at', null);

        if (valid.sectorId) {
          query = query.eq('sector_id', valid.sectorId);
        }
        if (valid.stage) {
          query = query.eq('funding_stage', valid.stage);
        }
        if (valid.instrument) {
          query = query.eq('instrument', valid.instrument);
        }
        if (valid.minTargetUsd !== undefined) {
          query = query.gte('target_amount_usd', valid.minTargetUsd);
        }
        if (valid.maxTargetUsd !== undefined) {
          query = query.lte('target_amount_usd', valid.maxTargetUsd);
        }
        if (valid.featuredOnly) {
          query = query.eq('is_featured', true);
        }

        const searchClause = buildPostgrestSearchOrClause(PITCH_SEARCH_COLUMNS, valid.q);
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
        return buildCursorPage(rows as unknown as PitchRow[], limit, (item) => ({
          featured: item.is_featured,
          ts: item.approved_at ?? EPOCH_CURSOR_TS,
          id: item.id,
        }));
      });
    },

    async getAccessiblePitchById(pitchId: string): Promise<PitchRow | null> {
      const validId = parseRepositoryInput(uuidSchema, pitchId);

      return executeServiceCall(async () => {
        const result = await client
          .from('pitches')
          .select(PITCH_SELECT_COLUMNS)
          .eq('id', validId)
          .is('deleted_at', null)
          .maybeSingle<PitchRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async listCompanyPitches(
      companyId: string,
      options?: {
        readonly status?: PitchStatus;
        readonly cursor?: string | null;
        readonly limit?: number;
      },
    ): Promise<CursorPageResponse<PitchRow>> {
      const validCompanyId = parseRepositoryInput(uuidSchema, companyId);
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        let query = client
          .from('pitches')
          .select(PITCH_SELECT_COLUMNS)
          .eq('company_id', validCompanyId)
          .is('deleted_at', null);

        if (options?.status) {
          query = query.eq('status', options.status);
        }

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as PitchRow[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async createDraftPitch(input: UpsertPitchInput): Promise<PitchRow> {
      const valid = parseRepositoryInput(upsertPitchSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('pitches')
          .insert({
            company_id: valid.company_id,
            created_by: user.id,
            status: 'draft',
            is_featured: false,
            ...buildSafePitchWriteFields(valid),
          })
          .select(PITCH_SELECT_COLUMNS)
          .single<PitchRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async updatePitch(pitchId: string, input: UpsertPitchInput): Promise<PitchRow> {
      const validId = parseRepositoryInput(uuidSchema, pitchId);
      const valid = parseRepositoryInput(upsertPitchSchema, input);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('pitches')
          .update(buildSafePitchWriteFields(valid))
          .eq('id', validId)
          .eq('company_id', valid.company_id)
          .is('deleted_at', null)
          .select(PITCH_SELECT_COLUMNS)
          .maybeSingle<PitchRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async transitionPitch(input: FounderPitchTransitionInput): Promise<PitchRow> {
      const valid = parseRepositoryInput(founderPitchTransitionSchema, input);
      const allowedPriorStatuses: readonly PitchStatus[] =
        valid.next_status === 'pending' ? ['draft', 'rejected'] : ['approved', 'restricted'];

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('pitches')
          .update({ status: valid.next_status })
          .eq('id', valid.pitch_id)
          .in('status', [...allowedPriorStatuses])
          .is('deleted_at', null)
          .select(PITCH_SELECT_COLUMNS)
          .maybeSingle<PitchRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async deleteDraftPitch(pitchId: string): Promise<void> {
      const validId = parseRepositoryInput(uuidSchema, pitchId);

      await executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('pitches')
          .delete()
          .eq('id', validId)
          .eq('status', 'draft')
          .select('id')
          .maybeSingle<{ readonly id: string }>();

        requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async listPitchDocuments(pitchId: string, limit = 50): Promise<readonly PitchDocumentRow[]> {
      const validPitchId = parseRepositoryInput(uuidSchema, pitchId);
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        const result = await client
          .from('pitch_documents')
          .select(PITCH_DOCUMENT_SELECT_COLUMNS)
          .eq('pitch_id', validPitchId)
          .eq('is_active', true)
          .is('deleted_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as PitchDocumentRow[];
      });
    },

    async createPitchDocument(input: CreatePitchDocumentInput): Promise<PitchDocumentRow> {
      const valid = parseRepositoryInput(createPitchDocumentSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('pitch_documents')
          .insert({
            pitch_id: valid.pitch_id,
            company_id: valid.company_id,
            uploaded_by: user.id,
            category: valid.category,
            title_ar: valid.title_ar ?? null,
            title_en: valid.title_en ?? null,
            file_name: valid.file_name,
            storage_bucket: 'pitch-documents',
            storage_path: valid.storage_path,
            mime_type: valid.mime_type,
            file_size_bytes: valid.file_size_bytes,
            checksum_sha256: valid.checksum_sha256 ?? null,
            is_restricted: false,
            scan_status: 'pending',
            is_active: true,
            sort_order: valid.sort_order,
          })
          .select(PITCH_DOCUMENT_SELECT_COLUMNS)
          .single<PitchDocumentRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async updatePitchDocumentMetadata(
      documentId: string,
      input: UpdatePitchDocumentMetadataInput,
    ): Promise<PitchDocumentRow> {
      const validId = parseRepositoryInput(uuidSchema, documentId);
      const valid = parseRepositoryInput(updatePitchDocumentMetadataSchema, input);

      const safePayload: Record<string, unknown> = {};
      if (valid.category !== undefined) safePayload.category = valid.category;
      if (valid.title_ar !== undefined) safePayload.title_ar = valid.title_ar;
      if (valid.title_en !== undefined) safePayload.title_en = valid.title_en;
      if (valid.sort_order !== undefined) safePayload.sort_order = valid.sort_order;

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
          .from('pitch_documents')
          .update(safePayload)
          .eq('id', validId)
          .is('deleted_at', null)
          .select(PITCH_DOCUMENT_SELECT_COLUMNS)
          .maybeSingle<PitchDocumentRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async deleteDraftPitchDocument(documentId: string): Promise<void> {
      const validId = parseRepositoryInput(uuidSchema, documentId);

      await executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('pitch_documents')
          .delete()
          .eq('id', validId)
          .select('id')
          .maybeSingle<{ readonly id: string }>();

        requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async listNonInternalPitchReviews(
      pitchId: string,
      limit = 50,
    ): Promise<readonly PitchReviewRow[]> {
      const validPitchId = parseRepositoryInput(uuidSchema, pitchId);
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        const result = await client
          .from('pitch_reviews')
          .select(PITCH_REVIEW_SELECT_COLUMNS)
          .eq('pitch_id', validPitchId)
          .eq('is_internal', false)
          .order('created_at', { ascending: false })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as PitchReviewRow[];
      });
    },

    async listMyPitchAccessGrants(
      pitchId?: string,
      limit = 50,
    ): Promise<readonly PitchAccessGrantRow[]> {
      const validPitchId = pitchId ? parseRepositoryInput(uuidSchema, pitchId) : undefined;
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        let query = client
          .from('pitch_access_grants')
          .select(PITCH_ACCESS_GRANT_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('revoked_at', null);

        if (validPitchId) {
          query = query.eq('pitch_id', validPitchId);
        }

        const result = await query.order('created_at', { ascending: false }).limit(safeLimit);
        const rows = (await assertSupabaseResult(result)) ?? [];
        const nowMs = Date.now();

        return (rows as unknown as PitchAccessGrantRow[]).filter(
          (grant) => grant.expires_at === null || Date.parse(grant.expires_at) > nowMs,
        );
      });
    },

    async listPitchAccessGrantsForPitch(
      pitchId: string,
      limit = 50,
    ): Promise<readonly PitchAccessGrantRow[]> {
      const validPitchId = parseRepositoryInput(uuidSchema, pitchId);
      const safeLimit = clampPageLimit(limit, 50);

      return executeServiceCall(async () => {
        await requireAuthenticatedUser(client);
        const result = await client
          .from('pitch_access_grants')
          .select(PITCH_ACCESS_GRANT_SELECT_COLUMNS)
          .eq('pitch_id', validPitchId)
          .order('created_at', { ascending: false })
          .limit(safeLimit);

        const rows = await assertSupabaseResult(result);
        return (rows ?? []) as unknown as PitchAccessGrantRow[];
      });
    },

    async grantPitchAccess(input: GrantPitchAccessInput): Promise<PitchAccessGrantRow> {
      const valid = parseRepositoryInput(grantPitchAccessSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('pitch_access_grants')
          .insert({
            pitch_id: valid.pitch_id,
            pitch_document_id: valid.pitch_document_id ?? null,
            user_id: valid.user_id,
            granted_by: user.id,
            reason: valid.reason ?? null,
            expires_at: valid.expires_at ?? null,
          })
          .select(PITCH_ACCESS_GRANT_SELECT_COLUMNS)
          .single<PitchAccessGrantRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async revokePitchAccess(input: RevokePitchAccessInput): Promise<PitchAccessGrantRow> {
      const valid = parseRepositoryInput(revokePitchAccessSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('pitch_access_grants')
          .update({
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            reason: valid.reason,
          })
          .eq('id', valid.grant_id)
          .is('revoked_at', null)
          .select(PITCH_ACCESS_GRANT_SELECT_COLUMNS)
          .maybeSingle<PitchAccessGrantRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async listOwnInvestmentInterests(options?: {
      readonly cursor?: string | null;
      readonly limit?: number;
    }): Promise<CursorPageResponse<InvestmentInterestRow>> {
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        let query = client
          .from('investment_interests')
          .select(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS)
          .eq('investor_id', user.id)
          .is('deleted_at', null);

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as InvestmentInterestRow[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async listPitchInvestmentInterests(
      pitchId: string,
      options?: { readonly cursor?: string | null; readonly limit?: number },
    ): Promise<CursorPageResponse<InvestmentInterestRow>> {
      const validPitchId = parseRepositoryInput(uuidSchema, pitchId);
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const pitchRefResult = await client
          .from('pitches')
          .select('id, company_id')
          .eq('id', validPitchId)
          .is('deleted_at', null)
          .maybeSingle<{ readonly id: string; readonly company_id: string }>();

        const pitchRef = await assertSupabaseResult(pitchRefResult);
        if (!pitchRef) {
          throw new AppDomainError({
            code: 'FORBIDDEN',
            messageKey: 'errors.forbidden',
            statusCode: 403,
          });
        }

        const operatorAccess = await verifyCompanyOperator(client, user.id, pitchRef.company_id);
        if (!operatorAccess.isOperator) {
          throw new AppDomainError({
            code: 'FORBIDDEN',
            messageKey: 'errors.forbidden',
            statusCode: 403,
          });
        }

        let query = client
          .from('investment_interests')
          .select(INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS)
          .eq('pitch_id', validPitchId)
          .eq('company_id', pitchRef.company_id)
          .is('deleted_at', null);

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as InvestmentInterestRow[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async submitInvestmentInterest(
      input: CreateInvestmentInterestInput,
    ): Promise<InvestmentInterestRow> {
      const valid = parseRepositoryInput(createInvestmentInterestSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('investment_interests')
          .insert({
            pitch_id: valid.pitch_id,
            investor_id: user.id,
            indicative_amount_usd: valid.indicative_amount_usd ?? null,
            message: valid.message ?? null,
            status: 'submitted',
          })
          .select(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS)
          .single<InvestmentInterestRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async withdrawInvestmentInterest(interestId: string): Promise<InvestmentInterestRow> {
      const validId = parseRepositoryInput(uuidSchema, interestId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('investment_interests')
          .update({
            status: 'withdrawn',
            withdrawn_at: new Date().toISOString(),
          })
          .eq('id', validId)
          .eq('investor_id', user.id)
          .neq('status', 'withdrawn')
          .is('deleted_at', null)
          .select(INVESTMENT_INTEREST_INVESTOR_SELECT_COLUMNS)
          .maybeSingle<InvestmentInterestRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async respondToInvestmentInterest(
      input: UpdateInvestmentInterestResponseInput,
    ): Promise<InvestmentInterestRow> {
      const valid = parseRepositoryInput(updateInvestmentInterestResponseSchema, input);
      if (!OPERATOR_INTEREST_RESPONSE_STATUSES.has(valid.status)) {
        throw new AppDomainError({
          code: 'VALIDATION_ERROR',
          messageKey: 'errors.validationFailed',
          statusCode: 400,
        });
      }

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const interestRefResult = await client
          .from('investment_interests')
          .select('id, company_id')
          .eq('id', valid.interest_id)
          .is('deleted_at', null)
          .maybeSingle<{ readonly id: string; readonly company_id: string }>();

        const interestRef = await assertSupabaseResult(interestRefResult);
        if (!interestRef) {
          throw new AppDomainError({
            code: 'FORBIDDEN',
            messageKey: 'errors.forbidden',
            statusCode: 403,
          });
        }

        const operatorAccess = await verifyCompanyOperator(client, user.id, interestRef.company_id);
        if (!operatorAccess.isOperator) {
          throw new AppDomainError({
            code: 'FORBIDDEN',
            messageKey: 'errors.forbidden',
            statusCode: 403,
          });
        }

        const result = await client
          .from('investment_interests')
          .update({
            status: valid.status,
            founder_notes: valid.founder_notes ?? null,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', valid.interest_id)
          .eq('company_id', interestRef.company_id)
          .is('deleted_at', null)
          .select(INVESTMENT_INTEREST_FOUNDER_SELECT_COLUMNS)
          .maybeSingle<InvestmentInterestRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },
  };
}
