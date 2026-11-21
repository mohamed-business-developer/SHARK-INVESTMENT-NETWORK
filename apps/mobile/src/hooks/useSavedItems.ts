import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type { CursorPageResponse, SavedEntityType, SavedItemRow } from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  applyOptimisticSavedItemPages,
  createSavedRepository,
  type OptimisticSavedPagesSnapshot,
  type ToggleSavedItemInput,
  type ToggleSavedItemResult,
} from '../repositories/saved.repository';
import { getMobileSupabaseClient } from '../services/supabase';
import { useAuth } from './useAuth';

export const savedKeys = {
  all: ['saved-items'] as const,
  byUser: (userId: string) => [...savedKeys.all, userId] as const,
  list: (userId: string, entityType?: SavedEntityType, limit = 20) =>
    [...savedKeys.byUser(userId), 'list', entityType ?? 'all', limit] as const,
  status: (userId: string, entityType: SavedEntityType, entityId: string) =>
    [...savedKeys.byUser(userId), 'status', entityType, entityId] as const,
};

function getRepo() {
  return createSavedRepository(getMobileSupabaseClient());
}

export function useSavedItemsInfiniteQuery(entityType?: SavedEntityType, limit = 20) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';

  return useInfiniteQuery<
    CursorPageResponse<SavedItemRow>,
    Error,
    InfiniteData<CursorPageResponse<SavedItemRow>>,
    ReturnType<typeof savedKeys.list>,
    string | null
  >({
    queryKey: savedKeys.list(userId || 'anonymous', entityType, limit),
    initialPageParam: null,
    queryFn: ({ pageParam }) => getRepo().listSavedItems({ entityType, cursor: pageParam, limit }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled: Boolean(userId) && isApproved,
  });
}

export function useIsEntitySavedQuery(
  entityType: SavedEntityType,
  entityId: string | null | undefined,
) {
  const { user, isApproved } = useAuth();
  const userId = user?.id ?? '';
  const safeId = entityId?.trim() ?? '';

  return useQuery<boolean>({
    queryKey: savedKeys.status(userId || 'anonymous', entityType, safeId || 'none'),
    queryFn: () => getRepo().isEntitySaved(entityType, safeId),
    enabled: Boolean(userId) && isApproved && safeId.length > 0,
  });
}

type SavedListSnapshotEntry = readonly [QueryKey, OptimisticSavedPagesSnapshot | undefined];

interface ToggleMutationContext {
  readonly statusKey: QueryKey;
  readonly previousStatus: boolean | undefined;
  readonly previousLists: SavedListSnapshotEntry[];
}

/**
 * Optimistic bookmark toggle mutation restricted to approved accounts, with full snapshot rollback on error.
 */
export function useToggleSavedItemMutation() {
  const queryClient = useQueryClient();
  const { user, isApproved } = useAuth();

  return useMutation<ToggleSavedItemResult, Error, ToggleSavedItemInput, ToggleMutationContext>({
    mutationFn: async (input) => {
      if (!user?.id || !isApproved) {
        throw new AppDomainError({
          code: 'FORBIDDEN',
          messageKey: 'errors.accountApprovalRequired',
          statusCode: 403,
        });
      }
      return getRepo().toggleSavedItem(input);
    },
    onMutate: async (input) => {
      const userId = user?.id ?? '';
      const statusKey = savedKeys.status(userId || 'anonymous', input.entity_type, input.entity_id);
      if (!userId || !isApproved) {
        return { statusKey, previousStatus: undefined, previousLists: [] };
      }

      const userScope = savedKeys.byUser(userId);
      await queryClient.cancelQueries({ queryKey: userScope });

      const previousStatus = queryClient.getQueryData<boolean>(statusKey);
      const nextSaved = !(previousStatus ?? false);
      queryClient.setQueryData<boolean>(statusKey, nextSaved);

      const matchedLists = queryClient.getQueriesData<OptimisticSavedPagesSnapshot>({
        queryKey: userScope,
      });
      const previousLists: SavedListSnapshotEntry[] = [];

      for (const [key, snapshot] of matchedLists) {
        if (!Array.isArray(key) || key[2] !== 'list') {
          continue;
        }
        const filterType = key[3];
        if (filterType !== 'all' && filterType !== input.entity_type) {
          continue;
        }
        previousLists.push([key, snapshot]);
        queryClient.setQueryData<OptimisticSavedPagesSnapshot | undefined>(key, (old) =>
          applyOptimisticSavedItemPages(old, {
            userId,
            entityType: input.entity_type,
            entityId: input.entity_id,
            nextSaved,
            notes: input.notes ?? null,
          }),
        );
      }

      return { statusKey, previousStatus, previousLists };
    },
    onError: (_err, _input, context) => {
      if (!context) {
        return;
      }
      if (context.previousStatus !== undefined) {
        queryClient.setQueryData<boolean>(context.statusKey, context.previousStatus);
      } else {
        queryClient.removeQueries({ queryKey: context.statusKey, exact: true });
      }
      for (const [key, snapshot] of context.previousLists) {
        queryClient.setQueryData(key, snapshot);
      }
    },
    onSettled: async () => {
      if (user?.id) {
        await queryClient.invalidateQueries({ queryKey: savedKeys.byUser(user.id) });
      }
    },
  });
}
