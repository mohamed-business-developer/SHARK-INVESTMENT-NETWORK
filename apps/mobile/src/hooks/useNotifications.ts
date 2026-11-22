import { useEffect, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import type {
  AppLocale,
  CursorPageResponse,
  NotificationCategory,
  SupportRequestStatus,
} from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  createNotificationRepository,
  type ListNotificationsOptions,
} from '../repositories/notification.repository';
import {
  createSupportRepository,
  type CreateSupportRequestInput,
  type ListSupportRequestsOptions,
  type MobileSupportRequest,
} from '../repositories/support.repository';
import {
  applyMarkAllNotificationsRead,
  applyNotificationReadUpdate,
  applyNotificationSoftDelete,
  applyRealtimeNotificationInsert,
  isInboxAndSupportAllowedStatus,
  setActiveRegisteredPushToken,
  subscribeToNotificationResponseDeepLinks,
  subscribeToUserNotifications,
  syncNativeDevicePushRegistration,
  type MobileNotificationItem,
  type NotificationPagesSnapshot,
  type PushRegistrationStatus,
  type RealtimeNotificationClientLike,
} from '../services/notifications';
import { getMobileSupabaseClient, tryGetMobileSupabaseClient } from '../services/supabase';
import { useAuth } from './useAuth';

export const notificationKeys = {
  all: ['notifications'] as const,
  byUser: (userId: string) => [...notificationKeys.all, userId] as const,
  list: (userId: string, unreadOnly = false, category?: NotificationCategory, limit = 20) =>
    [...notificationKeys.byUser(userId), 'list', unreadOnly, category ?? 'all', limit] as const,
  unreadCount: (userId: string) => [...notificationKeys.byUser(userId), 'unread-count'] as const,
};

export const supportKeys = {
  all: ['support-requests'] as const,
  byUser: (userId: string) => [...supportKeys.all, userId] as const,
  list: (userId: string, status?: SupportRequestStatus, limit = 20) =>
    [...supportKeys.byUser(userId), 'list', status ?? 'all', limit] as const,
  detail: (userId: string, requestId: string) =>
    [...supportKeys.byUser(userId), 'detail', requestId] as const,
};

function getNotificationRepo() {
  return createNotificationRepository(getMobileSupabaseClient());
}

function getSupportRepo() {
  return createSupportRepository(getMobileSupabaseClient());
}

function assertNonSuspendedAuthenticated(userId: string | null, statusAllowed: boolean): void {
  if (!userId || !statusAllowed) {
    throw new AppDomainError({
      code: statusAllowed ? 'UNAUTHORIZED' : 'ACCOUNT_SUSPENDED',
      messageKey: statusAllowed ? 'errors.unauthorized' : 'errors.accountSuspended',
      statusCode: statusAllowed ? 401 : 403,
    });
  }
}

export function useNotificationsInfiniteQuery(options?: Omit<ListNotificationsOptions, 'cursor'>) {
  const { user, status } = useAuth();
  const userId = user?.id ?? '';
  const unreadOnly = options?.unreadOnly ?? false;
  const limit = options?.limit ?? 20;
  const enabled = Boolean(userId) && isInboxAndSupportAllowedStatus(status);

  return useInfiniteQuery<
    CursorPageResponse<MobileNotificationItem>,
    Error,
    InfiniteData<CursorPageResponse<MobileNotificationItem>>,
    ReturnType<typeof notificationKeys.list>,
    string | null
  >({
    queryKey: notificationKeys.list(userId || 'anonymous', unreadOnly, options?.category, limit),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getNotificationRepo().listNotifications({
        unreadOnly,
        category: options?.category,
        cursor: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled,
  });
}

export function useUnreadNotificationsCountQuery() {
  const { user, status } = useAuth();
  const userId = user?.id ?? '';
  const enabled = Boolean(userId) && isInboxAndSupportAllowedStatus(status);

  return useQuery<number>({
    queryKey: notificationKeys.unreadCount(userId || 'anonymous'),
    queryFn: () => getNotificationRepo().getUnreadCount(),
    enabled,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const allowed = isInboxAndSupportAllowedStatus(status);

  return useMutation<MobileNotificationItem, Error, string>({
    mutationFn: async (notificationId) => {
      assertNonSuspendedAuthenticated(userId, allowed);
      return getNotificationRepo().markNotificationAsRead(notificationId);
    },
    onSuccess: async (updated) => {
      if (!userId) {
        return;
      }
      const userScope = notificationKeys.byUser(userId);
      const listQueries = queryClient.getQueriesData<NotificationPagesSnapshot>({
        queryKey: userScope,
      });
      let appliedUnreadDelta = 0;

      for (const [key, snapshot] of listQueries as readonly [
        QueryKey,
        NotificationPagesSnapshot | undefined,
      ][]) {
        if (!Array.isArray(key) || key[2] !== 'list' || !snapshot) {
          continue;
        }
        const { nextSnapshot, unreadDelta } = applyNotificationReadUpdate(snapshot, updated);
        if (nextSnapshot && nextSnapshot !== snapshot) {
          queryClient.setQueryData<NotificationPagesSnapshot>(key, nextSnapshot);
          if (unreadDelta < 0) {
            appliedUnreadDelta = unreadDelta;
          }
        }
      }

      if (appliedUnreadDelta < 0) {
        queryClient.setQueryData<number>(notificationKeys.unreadCount(userId), (prev) =>
          Math.max(0, (prev ?? 0) + appliedUnreadDelta),
        );
      }
      await queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount(userId) });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const allowed = isInboxAndSupportAllowedStatus(status);

  return useMutation<number, Error, void>({
    mutationFn: async () => {
      assertNonSuspendedAuthenticated(userId, allowed);
      return getNotificationRepo().markAllNotificationsAsRead();
    },
    onSuccess: async () => {
      if (!userId) {
        return;
      }
      const userScope = notificationKeys.byUser(userId);
      const nowIso = new Date().toISOString();
      const listQueries = queryClient.getQueriesData<NotificationPagesSnapshot>({
        queryKey: userScope,
      });

      for (const [key, snapshot] of listQueries as readonly [
        QueryKey,
        NotificationPagesSnapshot | undefined,
      ][]) {
        if (!Array.isArray(key) || key[2] !== 'list' || !snapshot) {
          continue;
        }
        queryClient.setQueryData<NotificationPagesSnapshot>(
          key,
          applyMarkAllNotificationsRead(snapshot, nowIso),
        );
      }

      queryClient.setQueryData<number>(notificationKeys.unreadCount(userId), 0);
      await queryClient.invalidateQueries({ queryKey: userScope });
    },
  });
}

export function useSoftDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const allowed = isInboxAndSupportAllowedStatus(status);

  return useMutation<void, Error, string>({
    mutationFn: async (notificationId) => {
      assertNonSuspendedAuthenticated(userId, allowed);
      return getNotificationRepo().softDeleteNotification(notificationId);
    },
    onSuccess: async (_data, notificationId) => {
      if (!userId) {
        return;
      }
      const userScope = notificationKeys.byUser(userId);
      const listQueries = queryClient.getQueriesData<NotificationPagesSnapshot>({
        queryKey: userScope,
      });
      let appliedUnreadDelta = 0;

      for (const [key, snapshot] of listQueries as readonly [
        QueryKey,
        NotificationPagesSnapshot | undefined,
      ][]) {
        if (!Array.isArray(key) || key[2] !== 'list' || !snapshot) {
          continue;
        }
        const { nextSnapshot, unreadDelta } = applyNotificationSoftDelete(snapshot, notificationId);
        if (nextSnapshot) {
          queryClient.setQueryData<NotificationPagesSnapshot>(key, nextSnapshot);
          if (unreadDelta < 0) {
            appliedUnreadDelta = unreadDelta;
          }
        }
      }

      if (appliedUnreadDelta < 0) {
        queryClient.setQueryData<number>(notificationKeys.unreadCount(userId), (prev) =>
          Math.max(0, (prev ?? 0) + appliedUnreadDelta),
        );
      }
      await queryClient.invalidateQueries({ queryKey: userScope });
    },
  });
}

/**
 * Subscribes cleanly to Realtime notification INSERTs and validated notification tap deep links.
 * Active for authenticated non-suspended users; cleans up on logout, suspension, switch, or unmount.
 */
export function useNotificationsRealtimeSync(options?: {
  readonly onDeepLinkTap?: (relativePath: string) => void;
}): void {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const allowed = Boolean(userId) && isInboxAndSupportAllowedStatus(status);
  const onDeepLinkTap = options?.onDeepLinkTap;

  useEffect(() => {
    if (!allowed || !userId) {
      return;
    }

    const client = tryGetMobileSupabaseClient();
    if (!client) {
      return;
    }

    const unsubscribeRealtime = subscribeToUserNotifications({
      client: client as unknown as RealtimeNotificationClientLike,
      userId,
      onInsert: (incoming) => {
        const userScope = notificationKeys.byUser(userId);
        const listQueries = queryClient.getQueriesData<NotificationPagesSnapshot>({
          queryKey: userScope,
        });
        let countDelta = incoming.is_read ? 0 : 1;

        for (const [key, snapshot] of listQueries as readonly [
          QueryKey,
          NotificationPagesSnapshot | undefined,
        ][]) {
          if (!Array.isArray(key) || key[2] !== 'list' || !snapshot) {
            continue;
          }
          const categoryFilter = key[4];
          if (
            categoryFilter !== 'all' &&
            typeof categoryFilter === 'string' &&
            incoming.category !== categoryFilter
          ) {
            continue;
          }
          const { nextSnapshot, insertedUnreadDelta } = applyRealtimeNotificationInsert(
            snapshot,
            incoming,
          );
          if (nextSnapshot && nextSnapshot !== snapshot) {
            queryClient.setQueryData<NotificationPagesSnapshot>(key, nextSnapshot);
            countDelta = insertedUnreadDelta;
          }
        }

        if (countDelta > 0) {
          queryClient.setQueryData<number>(
            notificationKeys.unreadCount(userId),
            (prev) => (prev ?? 0) + countDelta,
          );
        }
      },
    });

    const unsubscribeResponse = onDeepLinkTap
      ? subscribeToNotificationResponseDeepLinks(onDeepLinkTap)
      : undefined;

    return () => {
      unsubscribeRealtime();
      unsubscribeResponse?.();
    };
  }, [allowed, onDeepLinkTap, queryClient, userId]);
}

/**
 * Synchronizes Expo push token registration for non-suspended users, surfacing non-fatal degraded states
 * when a physical device token is still owned by another user in PostgreSQL (`23505`/`42501`).
 */
export function usePushTokenLifecycleSync(): {
  readonly pushStatus: PushRegistrationStatus;
  readonly isPushDegraded: boolean;
} {
  const { user, profile, status } = useAuth();
  const userId = user?.id ?? null;
  const locale: AppLocale = profile?.preferred_language === 'en' ? 'en' : 'ar';
  const allowed = Boolean(userId) && isInboxAndSupportAllowedStatus(status);
  const [pushStatus, setPushStatus] = useState<PushRegistrationStatus>('idle');

  useEffect(() => {
    let active = true;

    if (!allowed || !userId) {
      setActiveRegisteredPushToken(null);
      setPushStatus('idle');
      return;
    }

    const client = tryGetMobileSupabaseClient();
    if (!client) {
      setPushStatus('unavailable_or_denied');
      return;
    }

    setActiveRegisteredPushToken(null);
    setPushStatus('registering');
    void syncNativeDevicePushRegistration({
      client,
      userId,
      accountStatus: status,
      locale,
    }).then((result) => {
      if (active) {
        setPushStatus(result.pushStatus);
      }
    });

    return () => {
      active = false;
    };
  }, [allowed, locale, status, userId]);

  return {
    pushStatus,
    isPushDegraded: pushStatus === 'token_conflict_degraded' || pushStatus === 'degraded_error',
  };
}

export function useSupportRequestsInfiniteQuery(
  options?: Omit<ListSupportRequestsOptions, 'cursor'>,
) {
  const { user, status } = useAuth();
  const userId = user?.id ?? '';
  const limit = options?.limit ?? 20;
  const enabled = Boolean(userId) && isInboxAndSupportAllowedStatus(status);

  return useInfiniteQuery<
    CursorPageResponse<MobileSupportRequest>,
    Error,
    InfiniteData<CursorPageResponse<MobileSupportRequest>>,
    ReturnType<typeof supportKeys.list>,
    string | null
  >({
    queryKey: supportKeys.list(userId || 'anonymous', options?.status, limit),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      getSupportRepo().listOwnSupportRequests({
        status: options?.status,
        cursor: pageParam,
        limit,
      }),
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.nextCursor : undefined),
    enabled,
  });
}

export function useSupportRequestDetailQuery(requestId: string | null | undefined) {
  const { user, status } = useAuth();
  const userId = user?.id ?? '';
  const safeId = requestId?.trim() ?? '';
  const enabled = Boolean(userId) && isInboxAndSupportAllowedStatus(status) && safeId.length > 0;

  return useQuery<MobileSupportRequest | null>({
    queryKey: supportKeys.detail(userId || 'anonymous', safeId || 'none'),
    queryFn: () => getSupportRepo().getSupportRequestById(safeId),
    enabled,
  });
}

export function useCreateSupportRequestMutation() {
  const queryClient = useQueryClient();
  const { user, status } = useAuth();
  const userId = user?.id ?? null;
  const allowed = isInboxAndSupportAllowedStatus(status);

  return useMutation<MobileSupportRequest, Error, CreateSupportRequestInput>({
    mutationFn: async (input) => {
      assertNonSuspendedAuthenticated(userId, allowed);
      return getSupportRepo().submitSupportRequest(input);
    },
    onSuccess: async () => {
      if (userId) {
        await queryClient.invalidateQueries({ queryKey: supportKeys.byUser(userId) });
      }
    },
  });
}
