import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createNotificationRepository,
  DEVICE_TOKEN_SELECT_COLUMNS,
  NOTIFICATION_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/notification.repository';
import {
  createSupportRepository,
  SUPPORT_REQUEST_SELECT_COLUMNS,
} from '../../apps/mobile/src/repositories/support.repository';
import {
  applyMarkAllNotificationsRead,
  applyNotificationReadUpdate,
  applyNotificationSoftDelete,
  applyRealtimeNotificationInsert,
  isInboxAndSupportAllowedStatus,
  normalizeRealtimeNotificationPayload,
  runBoundedPushDeactivation,
  sanitizeNotificationDeepLink,
  subscribeToUserNotifications,
  syncDevicePushRegistration,
  type MobileNotificationItem,
  type NotificationPagesSnapshot,
  type PushNotificationDriver,
  type RealtimeNotificationChannelLike,
  type RealtimeNotificationClientLike,
} from '../../apps/mobile/src/services/notifications-core';

const USER_A = '11111111-1111-4111-8111-111111111104';
const USER_B = '11111111-1111-4111-8111-111111111105';
const NOTIF_1 = '99999999-9999-4999-8999-999999999901';
const NOTIF_2 = '99999999-9999-4999-8999-999999999902';
const NOTIF_3 = '99999999-9999-4999-8999-999999999903';
const SUPPORT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const SHARED_TOKEN = 'ExponentPushToken[shared_device_token_12345]';

interface QueryLogEntry {
  readonly table: string;
  readonly op: string;
  readonly selectCols?: string;
  readonly payload?: unknown;
  readonly eqFilters: Record<string, unknown>;
}

function makeNotification(overrides: Partial<MobileNotificationItem> = {}): MobileNotificationItem {
  return {
    id: NOTIF_1,
    user_id: USER_A,
    category: 'account_status',
    title_ar: 'تنبيه جديد',
    title_en: 'New alert',
    body_ar: 'تم تحديث حالة حسابك.',
    body_en: 'Your account status has been updated.',
    deep_link: '/account/verification',
    entity_type: 'profile',
    entity_id: USER_A,
    metadata: {},
    is_read: false,
    read_at: null,
    created_at: '2026-11-22T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function createFakeDriver(overrides: Partial<PushNotificationDriver> = {}): PushNotificationDriver {
  return {
    isPhysicalDevice: true,
    platform: 'android',
    locale: 'ar',
    deviceId: 'pixel-8-build',
    appVersion: '0.1.0',
    requestPermissionsAndGetToken: async () => SHARED_TOKEN,
    ...overrides,
  };
}

function createTableMockClient(config: {
  authUserId?: string | null;
  userEmail?: string;
  resolver: (entry: QueryLogEntry) => {
    data: unknown;
    error: unknown;
    count?: number | null;
  };
}) {
  const logs: QueryLogEntry[] = [];

  const client = {
    auth: {
      getUser: async () =>
        config.authUserId
          ? {
              data: { user: { id: config.authUserId, email: config.userEmail ?? 'u@shark.test' } },
              error: null,
            }
          : { data: { user: null }, error: null },
    },
    from(table: string) {
      const state: {
        op: string;
        selectCols?: string;
        payload?: unknown;
        eqFilters: Record<string, unknown>;
      } = {
        op: 'select',
        eqFilters: {},
      };

      const finish = async () => {
        const entry: QueryLogEntry = {
          table,
          op: state.op,
          selectCols: state.selectCols,
          payload: state.payload,
          eqFilters: { ...state.eqFilters },
        };
        logs.push(entry);
        return config.resolver(entry);
      };

      const builder = {
        select(cols: string) {
          state.selectCols = cols;
          return builder;
        },
        insert(payload: unknown) {
          state.op = 'insert';
          state.payload = payload;
          return builder;
        },
        update(payload: unknown) {
          state.op = 'update';
          state.payload = payload;
          return builder;
        },
        eq(col: string, val: unknown) {
          state.eqFilters[col] = val;
          return builder;
        },
        is() {
          return builder;
        },
        or() {
          return builder;
        },
        order() {
          return builder;
        },
        limit: () => finish(),
        maybeSingle: () => finish(),
        single: () => finish(),
        then(
          onFulfilled?: (v: { data: unknown; error: unknown; count?: number | null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return finish().then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return {
    logs,
    client: client as unknown as Parameters<typeof createNotificationRepository>[0],
  };
}

describe('T5-15 Notifications, Push Tokens, Realtime Inbox & Support', () => {
  it('enforces safe relative deep links and strips unsafe redirects/traversal across reads and Realtime payloads', () => {
    expect(sanitizeNotificationDeepLink('/')).toBe('/');
    expect(sanitizeNotificationDeepLink('/pitches/22222222-2222-4222-8222-222222222201')).toBe(
      '/pitches/22222222-2222-4222-8222-222222222201',
    );
    expect(sanitizeNotificationDeepLink('/account/notifications')).toBe('/account/notifications');

    const maliciousDeepLinks = [
      'https://evil.example/phish',
      'http://127.0.0.1/steal',
      'javascript:alert(1)',
      'shark://auth/callback?token=1',
      '//evil.example/redirect',
      '/pitches/../admin',
      '/pitches/%2e%2e/admin',
      '/\\evil.example',
      '/pitches/1?next=https://evil.example',
      '/pitches/1#fragment',
      'no-leading-slash',
      '',
      '   ',
      null,
    ];

    for (const candidate of maliciousDeepLinks) {
      expect(sanitizeNotificationDeepLink(candidate)).toBeNull();
    }

    const realtimeSafe = normalizeRealtimeNotificationPayload(
      {
        id: NOTIF_1,
        user_id: USER_A,
        sent_by: 'admin-should-be-stripped',
        category: 'pitch_review',
        title_ar: 'عنوان',
        title_en: 'Title',
        body_ar: 'نص',
        body_en: 'Body',
        deep_link: '//evil.example/phish',
        is_read: false,
        created_at: '2026-11-22T12:00:00.000Z',
        deleted_at: null,
      },
      USER_A,
    );
    expect(realtimeSafe).not.toBeNull();
    expect(realtimeSafe?.deep_link).toBeNull();
    expect('sent_by' in (realtimeSafe ?? {})).toBe(false);

    // Rejects cross-user Realtime notification rows or soft-deleted rows
    expect(
      normalizeRealtimeNotificationPayload(
        { id: NOTIF_1, user_id: USER_B, category: 'security' },
        USER_A,
      ),
    ).toBeNull();
    expect(
      normalizeRealtimeNotificationPayload(
        { id: NOTIF_1, user_id: USER_A, category: 'security', deleted_at: '2026-11-22T12:00:00Z' },
        USER_A,
      ),
    ).toBeNull();
  });

  it('lists inbox, maintains unreadCount accuracy, and marks read / all-read / soft-delete with explicit safe projections', async () => {
    expect(NOTIFICATION_SELECT_COLUMNS).not.toContain('sent_by');
    expect(NOTIFICATION_SELECT_COLUMNS).not.toContain('*');
    expect(DEVICE_TOKEN_SELECT_COLUMNS).not.toContain('*');
    expect(SUPPORT_REQUEST_SELECT_COLUMNS).not.toContain('assigned_to');
    expect(SUPPORT_REQUEST_SELECT_COLUMNS).not.toContain('*');

    const pageItems = [
      makeNotification({ id: NOTIF_1, is_read: false, deep_link: 'https://bad.test' }),
      makeNotification({ id: NOTIF_2, is_read: false, deep_link: '/pitches/abc' }),
      makeNotification({ id: NOTIF_3, is_read: true, read_at: '2026-11-22T11:00:00.000Z' }),
    ];

    const mock = createTableMockClient({
      authUserId: USER_A,
      resolver: (entry) => {
        if (entry.table === 'notifications' && entry.op === 'select') {
          if (entry.selectCols === 'id') {
            return { data: null, error: null, count: 2 };
          }
          return { data: pageItems, error: null };
        }
        if (entry.table === 'notifications' && entry.op === 'update') {
          const payload = entry.payload as Record<string, unknown>;
          if (payload.deleted_at) {
            return { data: { id: NOTIF_1 }, error: null };
          }
          if (entry.eqFilters.id === NOTIF_2) {
            return {
              data: makeNotification({
                id: NOTIF_2,
                is_read: true,
                read_at: String(payload.read_at),
              }),
              error: null,
            };
          }
          return { data: [{ id: NOTIF_1 }, { id: NOTIF_2 }], error: null };
        }
        return { data: null, error: null };
      },
    });

    const repo = createNotificationRepository(mock.client);
    const page = await repo.listNotifications({ limit: 2 });
    expect(page.hasNextPage).toBe(true);
    expect(page.items).toHaveLength(2);
    expect(page.items[0]?.deep_link).toBeNull();
    expect(page.items[1]?.deep_link).toBe('/pitches/abc');

    const unread = await repo.getUnreadCount();
    expect(unread).toBe(2);

    const marked = await repo.markNotificationAsRead(NOTIF_2);
    expect(marked.is_read).toBe(true);

    const allMarkedCount = await repo.markAllNotificationsAsRead();
    expect(allMarkedCount).toBe(2);

    await repo.softDeleteNotification(NOTIF_1);

    // Verify pure cache reducers maintain exact unread count and deduplicate Realtime inserts
    let snapshot: NotificationPagesSnapshot | undefined = {
      pages: [
        {
          items: [
            makeNotification({ id: NOTIF_2, is_read: false }),
            makeNotification({ id: NOTIF_3, is_read: true }),
          ],
          nextCursor: null,
          hasNextPage: false,
        },
      ],
      pageParams: [null],
    };

    const firstInsert = applyRealtimeNotificationInsert(
      snapshot,
      makeNotification({ id: NOTIF_1, is_read: false }),
    );
    expect(firstInsert.insertedUnreadDelta).toBe(1);
    snapshot = firstInsert.nextSnapshot;
    expect(snapshot?.pages[0]?.items).toHaveLength(3);

    const dupInsert = applyRealtimeNotificationInsert(
      snapshot,
      makeNotification({ id: NOTIF_1, is_read: false }),
    );
    expect(dupInsert.insertedUnreadDelta).toBe(0);
    expect(dupInsert.nextSnapshot?.pages[0]?.items).toHaveLength(3);

    const readUpdate = applyNotificationReadUpdate(
      snapshot,
      makeNotification({ id: NOTIF_1, is_read: true }),
    );
    expect(readUpdate.unreadDelta).toBe(-1);
    snapshot = readUpdate.nextSnapshot;

    const delUnread = applyNotificationSoftDelete(snapshot, NOTIF_2);
    expect(delUnread.unreadDelta).toBe(-1);
    snapshot = delUnread.nextSnapshot;
    expect(snapshot?.pages[0]?.items.map((i) => i.id)).toEqual([NOTIF_1, NOTIF_3]);

    // Soft-deleting an already-read notification keeps unreadDelta at 0
    const delRead = applyNotificationSoftDelete(snapshot, NOTIF_3);
    expect(delRead.unreadDelta).toBe(0);
    expect(delRead.nextSnapshot?.pages[0]?.items.map((i) => i.id)).toEqual([NOTIF_1]);

    const unreadReinserted = applyRealtimeNotificationInsert(
      delRead.nextSnapshot,
      makeNotification({ id: NOTIF_2, is_read: false }),
    );
    expect(unreadReinserted.insertedUnreadDelta).toBe(1);
    const allRead = applyMarkAllNotificationsRead(
      unreadReinserted.nextSnapshot,
      '2026-11-22T12:30:00.000Z',
    );
    expect(allRead?.pages[0]?.items.every((item) => item.is_read)).toBe(true);
  });

  it('handles 23505 and non-suspended 42501 push token ownership conflicts as non-fatal degraded states without exposing previous owner or bypassing RLS', async () => {
    // 1. 23505 unique constraint violation -> returns degraded_conflict with null token & zero prior owner metadata
    const conflict23505Mock = createTableMockClient({
      authUserId: USER_B,
      resolver: (entry) => {
        if (entry.table === 'device_tokens' && entry.op === 'select') {
          expect(entry.eqFilters.user_id).toBe(USER_B);
          return { data: null, error: null };
        }
        if (entry.table === 'device_tokens' && entry.op === 'insert') {
          expect((entry.payload as Record<string, unknown>).user_id).toBe(USER_B);
          return {
            data: null,
            error: {
              code: '23505',
              message:
                'duplicate key value violates unique constraint "device_tokens_expo_push_token_key"',
            },
          };
        }
        return { data: null, error: null };
      },
    });

    const repo23505 = createNotificationRepository(conflict23505Mock.client);
    const conflictRes = await repo23505.registerDeviceToken({
      expo_push_token: SHARED_TOKEN,
      platform: 'android',
      locale: 'ar',
    });
    expect(conflictRes).toEqual({
      status: 'degraded_conflict',
      reasonCode: 'PUSH_TOKEN_OWNERSHIP_CONFLICT',
      token: null,
    });
    // Ensure client NEVER queries device_tokens without scoping to user_id = auth.uid()
    expect(
      conflict23505Mock.logs.some((l) => l.table === 'device_tokens' && l.op === 'update'),
    ).toBe(false);

    // 2. Non-suspended 42501 on device_tokens -> non-fatal degraded_conflict
    const conflict42501Mock = createTableMockClient({
      authUserId: USER_B,
      resolver: (entry) => {
        if (entry.table === 'device_tokens' && entry.op === 'select') {
          return { data: null, error: null };
        }
        if (entry.table === 'device_tokens' && entry.op === 'insert') {
          return { data: null, error: { code: '42501', message: 'new row violates RLS' } };
        }
        if (entry.table === 'profiles' && entry.op === 'select') {
          return { data: { id: USER_B, account_status: 'pending' }, error: null };
        }
        return { data: null, error: null };
      },
    });

    const syncRes = await syncDevicePushRegistration({
      userId: USER_B,
      accountStatus: 'pending',
      driver: createFakeDriver(),
      registerToken: (input) =>
        createNotificationRepository(conflict42501Mock.client).registerDeviceToken(input),
    });
    expect(syncRes).toEqual({
      pushStatus: 'token_conflict_degraded',
      activeToken: null,
    });

    // 3. Suspended 42501 (empty profile under is_not_suspended()) still fails closed with ACCOUNT_SUSPENDED
    const suspended42501Mock = createTableMockClient({
      authUserId: USER_B,
      resolver: (entry) => {
        if (entry.table === 'device_tokens' && entry.op === 'select') {
          return { data: null, error: null };
        }
        if (entry.table === 'device_tokens' && entry.op === 'insert') {
          return { data: null, error: { code: '42501', message: 'RLS denied' } };
        }
        if (entry.table === 'profiles' && entry.op === 'select') {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
    });

    await expect(
      createNotificationRepository(suspended42501Mock.client).registerDeviceToken({
        expo_push_token: SHARED_TOKEN,
        platform: 'ios',
        locale: 'en',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('deactivates own device tokens on signOut without blocking offline/hanging calls, and handles account switching cleanly', async () => {
    vi.useFakeTimers();
    try {
      // Guest and Suspended are strictly prevented from registering push tokens
      const registerSpy = vi.fn();
      expect(
        await syncDevicePushRegistration({
          userId: USER_A,
          accountStatus: 'guest',
          driver: createFakeDriver(),
          registerToken: registerSpy,
        }),
      ).toEqual({ pushStatus: 'unavailable_or_denied', activeToken: null });
      expect(
        await syncDevicePushRegistration({
          userId: USER_A,
          accountStatus: 'suspended',
          driver: createFakeDriver(),
          registerToken: registerSpy,
        }),
      ).toEqual({ pushStatus: 'unavailable_or_denied', activeToken: null });
      expect(registerSpy).not.toHaveBeenCalled();

      // User A signs in -> registers active token -> signs out -> token deactivated strictly for User A
      const userAMock = createTableMockClient({
        authUserId: USER_A,
        resolver: (entry) => {
          if (entry.table === 'device_tokens' && entry.op === 'select') {
            return { data: null, error: null };
          }
          if (entry.table === 'device_tokens' && entry.op === 'insert') {
            return {
              data: {
                id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
                user_id: USER_A,
                expo_push_token: SHARED_TOKEN,
                platform: 'android',
                device_id: 'pixel-8',
                app_version: '0.1.0',
                locale: 'ar',
                is_active: true,
                last_seen_at: '2026-11-22T12:00:00Z',
                created_at: '2026-11-22T12:00:00Z',
                updated_at: '2026-11-22T12:00:00Z',
              },
              error: null,
            };
          }
          if (entry.table === 'device_tokens' && entry.op === 'update') {
            return { data: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' }], error: null };
          }
          return { data: null, error: null };
        },
      });

      const repoA = createNotificationRepository(userAMock.client);
      const userAReg = await syncDevicePushRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver(),
        registerToken: (input) => repoA.registerDeviceToken(input),
      });
      expect(userAReg).toEqual({ pushStatus: 'active', activeToken: SHARED_TOKEN });

      const deactivatedCount = await repoA.deactivateDeviceToken(SHARED_TOKEN);
      expect(deactivatedCount).toBe(1);
      const updateLog = userAMock.logs.find(
        (l) => l.table === 'device_tokens' && l.op === 'update',
      );
      expect(updateLog?.eqFilters).toEqual({
        user_id: USER_A,
        is_active: true,
        expo_push_token: SHARED_TOKEN,
      });
      expect((updateLog?.payload as Record<string, unknown>).is_active).toBe(false);

      // Simulate switching from Account A (offline sign-out leaving token row owned by User A) to Account B:
      // RLS blocks User B from reading/updating User A's row; UNIQUE token returns 23505 -> non-fatal degraded state.
      const sharedDeviceStore = new Map<string, string>([[SHARED_TOKEN, USER_A]]);
      const userBMock = createTableMockClient({
        authUserId: USER_B,
        resolver: (entry) => {
          if (entry.table === 'device_tokens' && entry.op === 'select') {
            const owner = sharedDeviceStore.get(String(entry.eqFilters.expo_push_token));
            return { data: owner === USER_B ? { id: 'owned' } : null, error: null };
          }
          if (entry.table === 'device_tokens' && entry.op === 'insert') {
            const payload = entry.payload as Record<string, unknown>;
            const tokenKey = String(payload.expo_push_token);
            if (sharedDeviceStore.has(tokenKey)) {
              return { data: null, error: { code: '23505', message: 'duplicate key' } };
            }
            sharedDeviceStore.set(tokenKey, USER_B);
            return { data: { id: 'b1', ...payload }, error: null };
          }
          return { data: null, error: null };
        },
      });
      const userBReg = await syncDevicePushRegistration({
        userId: USER_B,
        accountStatus: 'approved',
        driver: createFakeDriver(),
        registerToken: (input) =>
          createNotificationRepository(userBMock.client).registerDeviceToken(input),
      });
      expect(userBReg).toEqual({ pushStatus: 'token_conflict_degraded', activeToken: null });
      expect(sharedDeviceStore.get(SHARED_TOKEN)).toBe(USER_A);

      // Hanging deactivation cannot block sign-out beyond bounded timeout
      let settled = false;
      const hangPromise = runBoundedPushDeactivation(() => new Promise(() => {}), 50).then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(60);
      await hangPromise;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('subscribes to Realtime INSERT events for the signed-in user and cleans up channels cleanly on teardown', () => {
    let insertedHandler: ((payload: { new?: unknown }) => void) | undefined;
    const unsubscribeSpy = vi.fn();
    const removeChannelSpy = vi.fn();

    const channelStub: RealtimeNotificationChannelLike = {
      on: (_type, filter, cb) => {
        expect(filter.filter).toBe(`user_id=eq.${USER_A}`);
        insertedHandler = cb;
        return channelStub;
      },
      subscribe: () => ({ unsubscribe: unsubscribeSpy }),
    };
    const clientStub: RealtimeNotificationClientLike = {
      channel: (name) => {
        expect(name).toBe(`notifications-inbox-${USER_A}`);
        return channelStub;
      },
      removeChannel: removeChannelSpy,
    };

    const received: MobileNotificationItem[] = [];
    const cleanup = subscribeToUserNotifications({
      client: clientStub,
      userId: USER_A,
      onInsert: (item) => received.push(item),
    });

    insertedHandler?.({
      new: {
        id: NOTIF_1,
        user_id: USER_A,
        sent_by: 'admin-uuid',
        category: 'verification',
        title_ar: 'تم التحقق',
        title_en: 'Verified',
        body_ar: 'تم قبول التوثيق',
        body_en: 'Verification approved',
        deep_link: '/account/verification',
        is_read: false,
        created_at: '2026-11-22T12:15:00Z',
        deleted_at: null,
      },
    });
    // Cross-user spoofed row ignored cleanly
    insertedHandler?.({
      new: { id: NOTIF_2, user_id: USER_B, category: 'security' },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe(NOTIF_1);
    expect(received[0]?.deep_link).toBe('/account/verification');

    cleanup();
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(removeChannelSpy).toHaveBeenCalledWith(channelStub);
  });

  it('permits support requests for pending, rejected, and approved accounts while blocking guests and suspended sessions', async () => {
    expect(isInboxAndSupportAllowedStatus('pending')).toBe(true);
    expect(isInboxAndSupportAllowedStatus('rejected')).toBe(true);
    expect(isInboxAndSupportAllowedStatus('approved')).toBe(true);
    expect(isInboxAndSupportAllowedStatus('guest')).toBe(false);
    expect(isInboxAndSupportAllowedStatus('suspended')).toBe(false);
    expect(isInboxAndSupportAllowedStatus('loading')).toBe(false);

    // Rejected user submitting an appeal succeeds cleanly
    const rejectedClient = createTableMockClient({
      authUserId: USER_A,
      userEmail: 'rejected@shark.test',
      resolver: (entry) => {
        if (entry.table === 'profiles') {
          return {
            data: { id: USER_A, email: 'rejected@shark.test', account_status: 'rejected' },
            error: null,
          };
        }
        if (entry.table === 'support_requests' && entry.op === 'insert') {
          const payload = entry.payload as Record<string, unknown>;
          expect(payload.status).toBe('open');
          expect(payload.user_id).toBe(USER_A);
          return {
            data: {
              id: SUPPORT_1,
              user_id: USER_A,
              contact_email: 'rejected@shark.test',
              category: payload.category,
              subject: payload.subject,
              message: payload.message,
              status: 'open',
              admin_response: null,
              resolved_at: null,
              created_at: '2026-11-22T12:00:00Z',
              updated_at: '2026-11-22T12:00:00Z',
              deleted_at: null,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      },
    });

    const supportRepo = createSupportRepository(rejectedClient.client);
    const createdTicket = await supportRepo.submitSupportRequest({
      category: 'appeal',
      subject: 'Account review appeal',
      message: 'Please re-verify our registration details and updated documents.',
    });
    expect(createdTicket.id).toBe(SUPPORT_1);
    expect(createdTicket.status).toBe('open');

    // Suspended account receives 403 ACCOUNT_SUSPENDED
    const suspendedClient = createTableMockClient({
      authUserId: USER_A,
      resolver: () => ({ data: null, error: null }),
    });
    await expect(
      createSupportRepository(suspendedClient.client).submitSupportRequest({
        category: 'general',
        subject: 'Help needed',
        message: 'Cannot access my suspended account anymore.',
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED', statusCode: 403 });

    // Unauthenticated guest fails with 401 UNAUTHORIZED
    const guestClient = createTableMockClient({
      authUserId: null,
      resolver: () => ({ data: null, error: null }),
    });
    await expect(
      createSupportRepository(guestClient.client).listOwnSupportRequests(),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });

    // Static verification on useAuth & useNotifications hook wiring
    const useAuthSrc = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/hooks/useAuth.tsx'),
      'utf8',
    );
    const useNotificationsSrc = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/hooks/useNotifications.ts'),
      'utf8',
    );
    expect(useAuthSrc).toContain('bestEffortDeactivatePushTokensOnSignOut');
    expect(useNotificationsSrc).toContain('isInboxAndSupportAllowedStatus');
  });
});
