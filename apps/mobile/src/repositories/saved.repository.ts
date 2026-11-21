import {
  SAVED_ENTITY_TYPES,
  type CursorPageResponse,
  type SavedEntityType,
  type SavedItemRow,
} from '@shark/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCursorPage } from '@shark/utils';
import { paginationQuerySchema, toggleSavedItemSchema, uuidSchema } from '@shark/validation';
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

export const SAVED_ITEM_SELECT_COLUMNS = [
  'id',
  'user_id',
  'entity_type',
  'entity_id',
  'notes',
  'created_at',
].join(', ');

const savedEntityTypeSchema = z.enum(SAVED_ENTITY_TYPES);

export type ToggleSavedItemInput = z.input<typeof toggleSavedItemSchema>;

export interface ToggleSavedItemResult {
  readonly saved: boolean;
  readonly entityType: SavedEntityType;
  readonly entityId: string;
  readonly item: SavedItemRow | null;
}

export interface OptimisticSavedPagesSnapshot {
  readonly pages: readonly CursorPageResponse<SavedItemRow>[];
  readonly pageParams: readonly unknown[];
}

/**
 * Applies deterministic optimistic toggle updates across cached keyset pages of `saved_items`.
 */
export function applyOptimisticSavedItemPages(
  current: OptimisticSavedPagesSnapshot | undefined,
  params: {
    readonly userId: string;
    readonly entityType: SavedEntityType;
    readonly entityId: string;
    readonly nextSaved: boolean;
    readonly notes?: string | null;
  },
): OptimisticSavedPagesSnapshot | undefined {
  if (!current || current.pages.length === 0) {
    return current;
  }

  const withoutTarget = current.pages.map((page) => ({
    ...page,
    items: page.items.filter(
      (item) => !(item.entity_type === params.entityType && item.entity_id === params.entityId),
    ),
  }));

  if (!params.nextSaved) {
    return {
      ...current,
      pages: withoutTarget,
    };
  }

  const optimisticRow: SavedItemRow = {
    id: `optimistic:${params.entityType}:${params.entityId}`,
    user_id: params.userId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    notes: params.notes ?? null,
    created_at: new Date().toISOString(),
  };

  const firstPage = withoutTarget[0]!;
  return {
    ...current,
    pages: [
      {
        ...firstPage,
        items: [optimisticRow, ...firstPage.items],
      },
      ...withoutTarget.slice(1),
    ],
  };
}

export interface MobileSavedRepository {
  readonly listSavedItems: (options?: {
    readonly entityType?: SavedEntityType;
    readonly cursor?: string | null;
    readonly limit?: number;
  }) => Promise<CursorPageResponse<SavedItemRow>>;
  readonly isEntitySaved: (entityType: SavedEntityType, entityId: string) => Promise<boolean>;
  readonly saveItem: (input: ToggleSavedItemInput) => Promise<SavedItemRow>;
  readonly removeSavedItem: (entityType: SavedEntityType, entityId: string) => Promise<void>;
  readonly toggleSavedItem: (input: ToggleSavedItemInput) => Promise<ToggleSavedItemResult>;
}

/**
 * Approved-user bookmarks repository (`investor` | `company` | `pitch`).
 * Target accessibility and approval status are enforced by `saved_items` RLS + `validate_saved_item_target()` trigger.
 */
export function createSavedRepository(client: SupabaseClient): MobileSavedRepository {
  return {
    async listSavedItems(options?: {
      readonly entityType?: SavedEntityType;
      readonly cursor?: string | null;
      readonly limit?: number;
    }): Promise<CursorPageResponse<SavedItemRow>> {
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const entityType = options?.entityType
        ? parseRepositoryInput(savedEntityTypeSchema, options.entityType)
        : undefined;
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        let query = client
          .from('saved_items')
          .select(SAVED_ITEM_SELECT_COLUMNS)
          .eq('user_id', user.id);

        if (entityType) {
          query = query.eq('entity_type', entityType);
        }

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        return buildCursorPage(rows as unknown as SavedItemRow[], limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async isEntitySaved(entityType: SavedEntityType, entityId: string): Promise<boolean> {
      const validType = parseRepositoryInput(savedEntityTypeSchema, entityType);
      const validId = parseRepositoryInput(uuidSchema, entityId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('saved_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('entity_type', validType)
          .eq('entity_id', validId)
          .maybeSingle<{ readonly id: string }>();

        const row = await assertSupabaseResult(result);
        return Boolean(row);
      });
    },

    async saveItem(input: ToggleSavedItemInput): Promise<SavedItemRow> {
      const valid = parseRepositoryInput(toggleSavedItemSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('saved_items')
          .insert({
            user_id: user.id,
            entity_type: valid.entity_type,
            entity_id: valid.entity_id,
            notes: valid.notes ?? null,
          })
          .select(SAVED_ITEM_SELECT_COLUMNS)
          .single<SavedItemRow>();

        return requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async removeSavedItem(entityType: SavedEntityType, entityId: string): Promise<void> {
      const validType = parseRepositoryInput(savedEntityTypeSchema, entityType);
      const validId = parseRepositoryInput(uuidSchema, entityId);

      await executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('saved_items')
          .delete()
          .eq('user_id', user.id)
          .eq('entity_type', validType)
          .eq('entity_id', validId);

        await assertSupabaseResult(result);
      });
    },

    async toggleSavedItem(input: ToggleSavedItemInput): Promise<ToggleSavedItemResult> {
      const valid = parseRepositoryInput(toggleSavedItemSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);

        const deletedResult = await client
          .from('saved_items')
          .delete()
          .eq('user_id', user.id)
          .eq('entity_type', valid.entity_type)
          .eq('entity_id', valid.entity_id)
          .select(SAVED_ITEM_SELECT_COLUMNS)
          .maybeSingle<SavedItemRow>();

        const removed = await assertSupabaseResult(deletedResult);
        if (removed) {
          return {
            saved: false,
            entityType: valid.entity_type,
            entityId: valid.entity_id,
            item: null,
          };
        }

        const insertedResult = await client
          .from('saved_items')
          .insert({
            user_id: user.id,
            entity_type: valid.entity_type,
            entity_id: valid.entity_id,
            notes: valid.notes ?? null,
          })
          .select(SAVED_ITEM_SELECT_COLUMNS)
          .single<SavedItemRow>();

        const inserted = requireEntityRow(await assertSupabaseResult(insertedResult));
        return {
          saved: true,
          entityType: valid.entity_type,
          entityId: valid.entity_id,
          item: inserted,
        };
      });
    },
  };
}
