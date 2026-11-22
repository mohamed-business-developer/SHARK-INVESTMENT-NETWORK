import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CursorPageResponse,
  SupportRequestRow,
  SupportRequestStatus,
} from '@shark/shared-types';
import { SUPPORT_REQUEST_STATUSES } from '@shark/shared-types';
import { AppDomainError, buildCursorPage } from '@shark/utils';
import { createSupportRequestSchema, paginationQuerySchema, uuidSchema } from '@shark/validation';
import { z } from 'zod';
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
 * Explicit self-service projection for `public.support_requests`; omits staff `assigned_to`.
 */
export const SUPPORT_REQUEST_SELECT_COLUMNS = [
  'id',
  'user_id',
  'contact_email',
  'category',
  'subject',
  'message',
  'status',
  'admin_response',
  'resolved_at',
  'created_at',
  'updated_at',
  'deleted_at',
].join(', ');

export type MobileSupportRequest = Omit<SupportRequestRow, 'assigned_to'>;
export type CreateSupportRequestInput = z.input<typeof createSupportRequestSchema>;

const supportStatusFilterSchema = z.enum(SUPPORT_REQUEST_STATUSES);

export interface ListSupportRequestsOptions {
  readonly status?: SupportRequestStatus;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface MobileSupportRepository {
  readonly listOwnSupportRequests: (
    options?: ListSupportRequestsOptions,
  ) => Promise<CursorPageResponse<MobileSupportRequest>>;
  readonly getSupportRequestById: (requestId: string) => Promise<MobileSupportRequest | null>;
  readonly submitSupportRequest: (
    input: CreateSupportRequestInput,
  ) => Promise<MobileSupportRequest>;
}

async function requireNonSuspendedProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{
  readonly id: string;
  readonly email: string | null;
  readonly account_status: string;
}> {
  // Under 0007 RLS, `profiles_select_self_or_admin` enforces `is_not_suspended()`.
  const profileRes = await client
    .from('profiles')
    .select('id, email, account_status')
    .eq('id', userId)
    .is('deleted_at', null)
    .maybeSingle<{
      readonly id: string;
      readonly email: string | null;
      readonly account_status: string;
    }>();

  const profile = await assertSupabaseResult(profileRes);
  if (!profile || profile.account_status === 'suspended') {
    throw new AppDomainError({
      code: 'ACCOUNT_SUSPENDED',
      messageKey: 'errors.accountSuspended',
      statusCode: 403,
    });
  }
  return profile;
}

/**
 * Self-service support & appeal ticket repository.
 * Permitted for authenticated non-suspended users (`pending`, `rejected`, `approved`); blocks guests and suspended sessions.
 */
export function createSupportRepository(client: SupabaseClient): MobileSupportRepository {
  return {
    async listOwnSupportRequests(
      options?: ListSupportRequestsOptions,
    ): Promise<CursorPageResponse<MobileSupportRequest>> {
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const validStatus = options?.status
        ? parseRepositoryInput(supportStatusFilterSchema, options.status)
        : undefined;
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        await requireNonSuspendedProfile(client, user.id);

        let query = client
          .from('support_requests')
          .select(SUPPORT_REQUEST_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (validStatus) {
          query = query.eq('status', validStatus);
        }

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as MobileSupportRequest[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async getSupportRequestById(requestId: string): Promise<MobileSupportRequest | null> {
      const validId = parseRepositoryInput(uuidSchema, requestId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        await requireNonSuspendedProfile(client, user.id);

        const result = await client
          .from('support_requests')
          .select(SUPPORT_REQUEST_SELECT_COLUMNS)
          .eq('id', validId)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .maybeSingle();

        return (await assertSupabaseResult(result)) as unknown as MobileSupportRequest | null;
      });
    },

    async submitSupportRequest(input: CreateSupportRequestInput): Promise<MobileSupportRequest> {
      const parsed = parseRepositoryInput(createSupportRequestSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const profile = await requireNonSuspendedProfile(client, user.id);

        const result = await client
          .from('support_requests')
          .insert({
            user_id: user.id,
            contact_email: profile.email ?? user.email ?? null,
            category: parsed.category,
            subject: parsed.subject,
            message: parsed.message,
            status: 'open',
          })
          .select(SUPPORT_REQUEST_SELECT_COLUMNS)
          .single();

        return requireEntityRow(
          await assertSupabaseResult(result),
        ) as unknown as MobileSupportRequest;
      });
    },
  };
}
