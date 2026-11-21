import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CursorPageResponse,
  VerificationRequestRow,
  VerificationSubjectType,
} from '@shark/shared-types';
import { buildCursorPage } from '@shark/utils';
import {
  createVerificationRequestSchema,
  paginationQuerySchema,
  uuidSchema,
} from '@shark/validation';
import type { z } from 'zod';
import { assertSupabaseResult, executeServiceCall } from '../services/service-client';
import {
  applyCreatedAtCursorFilter,
  clampPageLimit,
  parseRepositoryInput,
  requireAuthenticatedUser,
  requireEntityRow,
  resolveCursorOrThrow,
} from './helpers';

/**
 * Exact 14-column applicant projection granted on `public.verification_requests` (`0007` lines 350–365).
 * Strictly omits restricted compliance notes (`G5-04`).
 */
export const VERIFICATION_REQUEST_SELECT_COLUMNS = [
  'id',
  'user_id',
  'company_id',
  'subject_type',
  'status',
  'storage_bucket',
  'document_paths',
  'submission_notes',
  'reviewer_id',
  'review_notes',
  'reviewed_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export type CreateVerificationRequestInput = z.input<typeof createVerificationRequestSchema>;

export interface ListVerificationRequestsOptions {
  readonly subjectType?: VerificationSubjectType;
  readonly companyId?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface MobileVerificationRepository {
  readonly listOwnVerificationRequests: (
    options?: ListVerificationRequestsOptions,
  ) => Promise<CursorPageResponse<VerificationRequestRow>>;
  readonly getVerificationRequestById: (
    requestId: string,
  ) => Promise<VerificationRequestRow | null>;
  readonly submitVerificationRequest: (
    input: CreateVerificationRequestInput,
  ) => Promise<VerificationRequestRow>;
}

/**
 * Identity & company KYB verification request metadata repository.
 * Pending non-suspended applicants may submit `user_identity` requests; company KYB requires approved operators.
 */
export function createVerificationRepository(client: SupabaseClient): MobileVerificationRepository {
  return {
    async listOwnVerificationRequests(
      options?: ListVerificationRequestsOptions,
    ): Promise<CursorPageResponse<VerificationRequestRow>> {
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const validCompanyId = options?.companyId
        ? parseRepositoryInput(uuidSchema, options.companyId)
        : undefined;
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        let query = client
          .from('verification_requests')
          .select(VERIFICATION_REQUEST_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (options?.subjectType) {
          query = query.eq('subject_type', options.subjectType);
        }
        if (validCompanyId) {
          query = query.eq('company_id', validCompanyId);
        }

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as VerificationRequestRow[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async getVerificationRequestById(requestId: string): Promise<VerificationRequestRow | null> {
      const validId = parseRepositoryInput(uuidSchema, requestId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('verification_requests')
          .select(VERIFICATION_REQUEST_SELECT_COLUMNS)
          .eq('id', validId)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle<VerificationRequestRow>();

        return (await assertSupabaseResult(result)) ?? null;
      });
    },

    async submitVerificationRequest(
      input: CreateVerificationRequestInput,
    ): Promise<VerificationRequestRow> {
      const valid = parseRepositoryInput(createVerificationRequestSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('verification_requests')
          .insert({
            user_id: user.id,
            company_id: valid.company_id ?? null,
            subject_type: valid.subject_type,
            status: 'pending',
            storage_bucket: 'verification-documents',
            document_paths: valid.document_paths,
            submission_notes: valid.submission_notes ?? null,
          })
          .select(VERIFICATION_REQUEST_SELECT_COLUMNS)
          .single<VerificationRequestRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },
  };
}
