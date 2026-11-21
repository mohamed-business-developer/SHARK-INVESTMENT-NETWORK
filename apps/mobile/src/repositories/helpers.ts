import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { KeysetCursor } from '@shark/shared-types';
import { AppDomainError, decodeCursor } from '@shark/utils';
import { safeStoragePathSchema } from '@shark/validation';
import type { z } from 'zod';

const ISO_CURSOR_TS_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/;

export const EPOCH_CURSOR_TS = '1970-01-01T00:00:00.000Z' as const;

export function parseRepositoryInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppDomainError({
      code: 'VALIDATION_ERROR',
      messageKey: firstIssue?.message ?? 'errors.validationFailed',
      statusCode: 400,
    });
  }
  return parsed.data;
}

export async function requireAuthenticatedUser(client: SupabaseClient): Promise<User> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new AppDomainError({
      code: 'UNAUTHORIZED',
      messageKey: 'errors.unauthorized',
      statusCode: 401,
    });
  }
  return data.user;
}

export function requireEntityRow<T>(
  value: T | null | undefined,
  messageKey: 'errors.entityNotFound' | 'errors.profileNotFound' = 'errors.entityNotFound',
): T {
  if (value === null || value === undefined) {
    throw new AppDomainError({
      code: 'NOT_FOUND',
      messageKey,
      statusCode: 404,
    });
  }
  return value;
}

export function clampPageLimit(rawLimit?: number, fallback = 20): number {
  const numeric = rawLimit ?? fallback;
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, Math.min(50, Math.trunc(numeric)));
}

export function resolveCursorOrThrow(rawCursor: string | null | undefined): KeysetCursor | null {
  if (rawCursor === null || rawCursor === undefined || rawCursor.length === 0) {
    return null;
  }
  const decoded = decodeCursor(rawCursor);
  if (!decoded || !ISO_CURSOR_TS_REGEX.test(decoded.ts)) {
    throw new AppDomainError({
      code: 'VALIDATION_ERROR',
      messageKey: 'errors.validationFailed',
      statusCode: 400,
    });
  }
  return decoded;
}

export interface KeysetFilterableQuery<TSelf> {
  eq(column: string, value: unknown): TSelf;
  is(column: string, value: null): TSelf;
  lt(column: string, value: unknown): TSelf;
  or(filters: string): TSelf;
}

/**
 * Applies deterministic keyset pagination filters matching `(is_featured DESC, approved_at DESC NULLS LAST, <idColumn> DESC)`.
 */
export function applyFeaturedTimestampCursorFilter<TQuery extends KeysetFilterableQuery<TQuery>>(
  query: TQuery,
  cursor: KeysetCursor | null,
  options: {
    readonly idColumn: 'id' | 'investor_id';
    readonly featuredOnly?: boolean;
  },
): TQuery {
  if (!cursor) {
    return query;
  }

  const { idColumn, featuredOnly = false } = options;
  const { ts, id, featured } = cursor;

  if (featured === true && !featuredOnly) {
    if (ts === EPOCH_CURSOR_TS) {
      return query.or(
        `is_featured.eq.false,and(is_featured.eq.true,approved_at.is.null,${idColumn}.lt.${id})`,
      );
    }
    return query.or(
      `is_featured.eq.false,and(is_featured.eq.true,approved_at.lt.${ts}),and(is_featured.eq.true,approved_at.eq.${ts},${idColumn}.lt.${id}),and(is_featured.eq.true,approved_at.is.null)`,
    );
  }

  const scoped = featured === false ? query.eq('is_featured', false) : query;
  if (ts === EPOCH_CURSOR_TS) {
    return scoped.is('approved_at', null).lt(idColumn, id);
  }

  return scoped.or(
    `approved_at.lt.${ts},and(approved_at.eq.${ts},${idColumn}.lt.${id}),approved_at.is.null`,
  );
}

/**
 * Applies deterministic keyset pagination filters matching `(created_at DESC, id DESC)`.
 */
export function applyCreatedAtCursorFilter<TQuery extends KeysetFilterableQuery<TQuery>>(
  query: TQuery,
  cursor: KeysetCursor | null,
): TQuery {
  if (!cursor) {
    return query;
  }
  return query.or(`created_at.lt.${cursor.ts},and(created_at.eq.${cursor.ts},id.lt.${cursor.id})`);
}

/**
 * Builds a public CDN URL exclusively from the `public-assets` bucket after traversal validation.
 */
export function resolvePublicAssetUrl(
  client: SupabaseClient,
  storagePath: string | null | undefined,
): string | null {
  if (!storagePath) {
    return null;
  }
  const parsed = safeStoragePathSchema.safeParse(storagePath);
  if (!parsed.success) {
    return null;
  }
  const { data } = client.storage.from('public-assets').getPublicUrl(parsed.data);
  return data?.publicUrl ?? null;
}
