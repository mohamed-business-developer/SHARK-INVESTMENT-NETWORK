import { z } from 'zod';
import {
  NOTIFICATION_CATEGORIES,
  type AppLocale,
  type CursorPageResponse,
  type DevicePlatform,
  type DeviceTokenRow,
  type NotificationCategory,
  type NotificationRow,
} from '@shark/shared-types';
import { strictNotificationDeepLinkSchema, uuidSchema } from '@shark/validation';
import type { MobileAuthStatus } from '../hooks/auth-state';

const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);

export type MobileNotificationItem = Omit<NotificationRow, 'sent_by'>;

export type PushRegistrationStatus =
  | 'idle'
  | 'registering'
  | 'active'
  | 'token_conflict_degraded'
  | 'unavailable_or_denied'
  | 'degraded_error';

export type DeviceTokenRegistrationResult =
  | {
      readonly status: 'registered';
      readonly token: DeviceTokenRow;
    }
  | {
      readonly status: 'degraded_conflict';
      readonly reasonCode: 'PUSH_TOKEN_OWNERSHIP_CONFLICT';
      readonly token: null;
    };

export interface RegisterDeviceTokenCommand {
  readonly expo_push_token: string;
  readonly platform: DevicePlatform;
  readonly device_id?: string | null;
  readonly app_version?: string | null;
  readonly locale: AppLocale;
}

export interface PushNotificationDriver {
  readonly isPhysicalDevice: boolean;
  readonly platform: DevicePlatform;
  readonly locale: AppLocale;
  readonly deviceId: string | null;
  readonly appVersion: string | null;
  readonly requestPermissionsAndGetToken: () => Promise<string | null>;
}

export interface PushRegistrationSyncResult {
  readonly pushStatus: PushRegistrationStatus;
  readonly activeToken: string | null;
}

export interface NotificationPagesSnapshot {
  readonly pages: readonly CursorPageResponse<MobileNotificationItem>[];
  readonly pageParams: readonly unknown[];
}

export interface RealtimeUnsubscribable {
  unsubscribe: () => Promise<unknown> | void;
}

export interface RealtimeNotificationClientLike {
  channel: (name: string) => RealtimeNotificationChannelLike;
  removeChannel?: (channel: RealtimeNotificationChannelLike) => Promise<unknown> | void;
}

export interface RealtimeNotificationChannelLike {
  on: (
    type: 'postgres_changes',
    filter: {
      event: 'INSERT';
      schema: 'public';
      table: 'notifications';
      filter?: string;
    },
    callback: (payload: { new?: unknown }) => void,
  ) => RealtimeNotificationChannelLike;
  subscribe: (callback?: (status: string) => void) => RealtimeUnsubscribable;
}

/**
 * Approved PM boundary: authenticated non-suspended users (`pending`, `rejected`, `approved`)
 * may access notifications, push registration, and support requests; guests & suspended users are blocked.
 */
export function isInboxAndSupportAllowedStatus(status: MobileAuthStatus): boolean {
  return status === 'pending' || status === 'rejected' || status === 'approved';
}

/**
 * Validates that a deep link is a safe internal relative application route (`/segment/...`).
 * Rejects protocol URLs (`https://`), protocol-relative (`//`), traversal (`..`), backslashes, and queries.
 */
export function sanitizeNotificationDeepLink(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = strictNotificationDeepLinkSchema.safeParse(trimmed);
  return parsed.success ? parsed.data : null;
}

export function normalizeRealtimeNotificationPayload(
  raw: unknown,
  expectedUserId: string,
): MobileNotificationItem | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id =
    typeof record.id === 'string' && uuidSchema.safeParse(record.id).success ? record.id : null;
  const userId =
    typeof record.user_id === 'string' && record.user_id === expectedUserId ? record.user_id : null;
  const categoryResult = notificationCategorySchemaSafe(record.category);
  if (!id || !userId || !categoryResult) {
    return null;
  }

  const deletedAt = typeof record.deleted_at === 'string' ? record.deleted_at : null;
  if (deletedAt !== null) {
    return null;
  }

  return {
    id,
    user_id: userId,
    category: categoryResult,
    title_ar: typeof record.title_ar === 'string' ? record.title_ar : '',
    title_en: typeof record.title_en === 'string' ? record.title_en : '',
    body_ar: typeof record.body_ar === 'string' ? record.body_ar : '',
    body_en: typeof record.body_en === 'string' ? record.body_en : '',
    deep_link: sanitizeNotificationDeepLink(
      typeof record.deep_link === 'string' ? record.deep_link : null,
    ),
    entity_type: typeof record.entity_type === 'string' ? record.entity_type : null,
    entity_id:
      typeof record.entity_id === 'string' && uuidSchema.safeParse(record.entity_id).success
        ? record.entity_id
        : null,
    metadata:
      typeof record.metadata === 'object' &&
      record.metadata !== null &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, string | number | boolean | null>)
        : {},
    is_read: record.is_read === true,
    read_at: typeof record.read_at === 'string' ? record.read_at : null,
    created_at:
      typeof record.created_at === 'string' ? record.created_at : new Date().toISOString(),
    deleted_at: null,
  };
}

function notificationCategorySchemaSafe(value: unknown): NotificationCategory | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = notificationCategorySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function applyRealtimeNotificationInsert(
  current: NotificationPagesSnapshot | undefined,
  incoming: MobileNotificationItem,
): {
  readonly nextSnapshot: NotificationPagesSnapshot | undefined;
  readonly insertedUnreadDelta: number;
} {
  if (!current || current.pages.length === 0) {
    return {
      nextSnapshot: current,
      insertedUnreadDelta: incoming.is_read ? 0 : 1,
    };
  }

  const alreadyExists = current.pages.some((page) =>
    page.items.some((item) => item.id === incoming.id),
  );
  if (alreadyExists) {
    return {
      nextSnapshot: current,
      insertedUnreadDelta: 0,
    };
  }

  const firstPage = current.pages[0]!;
  return {
    insertedUnreadDelta: incoming.is_read ? 0 : 1,
    nextSnapshot: {
      ...current,
      pages: [
        {
          ...firstPage,
          items: [incoming, ...firstPage.items],
        },
        ...current.pages.slice(1),
      ],
    },
  };
}

export function applyNotificationReadUpdate(
  current: NotificationPagesSnapshot | undefined,
  updated: MobileNotificationItem,
): {
  readonly nextSnapshot: NotificationPagesSnapshot | undefined;
  readonly unreadDelta: number;
} {
  if (!current || current.pages.length === 0) {
    return { nextSnapshot: current, unreadDelta: -1 };
  }

  let unreadDelta = 0;
  let found = false;
  const pages = current.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (item.id !== updated.id) {
        return item;
      }
      found = true;
      if (!item.is_read && updated.is_read) {
        unreadDelta -= 1;
      }
      return updated;
    }),
  }));

  return {
    nextSnapshot: found ? { ...current, pages } : current,
    unreadDelta: found ? unreadDelta : -1,
  };
}

export function applyMarkAllNotificationsRead(
  current: NotificationPagesSnapshot | undefined,
  readAtIso: string,
): NotificationPagesSnapshot | undefined {
  if (!current || current.pages.length === 0) {
    return current;
  }
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.is_read ? item : { ...item, is_read: true, read_at: item.read_at ?? readAtIso },
      ),
    })),
  };
}

export function applyNotificationSoftDelete(
  current: NotificationPagesSnapshot | undefined,
  notificationId: string,
): {
  readonly nextSnapshot: NotificationPagesSnapshot | undefined;
  readonly unreadDelta: number;
} {
  if (!current || current.pages.length === 0) {
    return { nextSnapshot: current, unreadDelta: 0 };
  }

  let unreadDelta = 0;
  const pages = current.pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => {
      if (item.id !== notificationId) {
        return true;
      }
      if (!item.is_read) {
        unreadDelta -= 1;
      }
      return false;
    }),
  }));

  return {
    nextSnapshot: { ...current, pages },
    unreadDelta,
  };
}

export async function syncDevicePushRegistration(params: {
  readonly userId: string;
  readonly accountStatus: MobileAuthStatus;
  readonly driver: PushNotificationDriver;
  readonly registerToken: (
    input: RegisterDeviceTokenCommand,
  ) => Promise<DeviceTokenRegistrationResult>;
}): Promise<PushRegistrationSyncResult> {
  if (!isInboxAndSupportAllowedStatus(params.accountStatus) || !params.driver.isPhysicalDevice) {
    return {
      pushStatus: 'unavailable_or_denied',
      activeToken: null,
    };
  }

  try {
    const token = await params.driver.requestPermissionsAndGetToken();
    if (!token) {
      return {
        pushStatus: 'unavailable_or_denied',
        activeToken: null,
      };
    }

    const result = await params.registerToken({
      expo_push_token: token,
      platform: params.driver.platform,
      device_id: params.driver.deviceId,
      app_version: params.driver.appVersion,
      locale: params.driver.locale,
    });

    if (result.status === 'degraded_conflict') {
      return {
        pushStatus: 'token_conflict_degraded',
        activeToken: null,
      };
    }

    return {
      pushStatus: 'active',
      activeToken: result.token.expo_push_token,
    };
  } catch {
    return {
      pushStatus: 'degraded_error',
      activeToken: null,
    };
  }
}

export async function runBoundedPushDeactivation(
  deactivateFn: () => Promise<unknown>,
  timeoutMs = 500,
): Promise<void> {
  const safeTimeout = Math.max(10, Math.min(timeoutMs, 2000));
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      deactivateFn().catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, safeTimeout);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function subscribeToUserNotifications(params: {
  readonly client: RealtimeNotificationClientLike;
  readonly userId: string;
  readonly onInsert: (notification: MobileNotificationItem) => void;
}): () => void {
  const channel = params.client.channel(`notifications-inbox-${params.userId}`);
  const subscription = channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${params.userId}`,
      },
      (payload) => {
        const normalized = normalizeRealtimeNotificationPayload(payload.new, params.userId);
        if (normalized) {
          params.onInsert(normalized);
        }
      },
    )
    .subscribe();

  return () => {
    void subscription.unsubscribe();
    if (params.client.removeChannel) {
      void params.client.removeChannel(channel);
    }
  };
}
