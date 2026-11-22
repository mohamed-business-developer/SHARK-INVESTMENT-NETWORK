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
  createPushLifecycleCoordinator,
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

  it('handles 23505 as degraded conflict while keeping 42501 fail-closed even for non-suspended profiles without exposing previous owner or bypassing RLS', async () => {
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
    expect('user_id' in conflictRes).toBe(false);
    // Ensure client NEVER queries or updates device_tokens across other accounts
    expect(
      conflict23505Mock.logs.some((l) => l.table === 'device_tokens' && l.op === 'update'),
    ).toBe(false);

    // 2. Arbitrary 42501 RLS/permission denial stays fail-closed (403 FORBIDDEN) EVEN if profile is active/approved
    const perm42501Mock = createTableMockClient({
      authUserId: USER_B,
      resolver: (entry) => {
        if (entry.table === 'device_tokens' && entry.op === 'select') {
          return { data: null, error: null };
        }
        if (entry.table === 'device_tokens' && entry.op === 'insert') {
          return {
            data: null,
            error: { code: '42501', message: 'new row violates row-level security policy' },
          };
        }
        if (entry.table === 'profiles' && entry.op === 'select') {
          return { data: { id: USER_B, account_status: 'approved' }, error: null };
        }
        return { data: null, error: null };
      },
    });

    await expect(
      createNotificationRepository(perm42501Mock.client).registerDeviceToken({
        expo_push_token: SHARED_TOKEN,
        platform: 'android',
        locale: 'ar',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    // Ensure repository never queried `profiles` to downgrade a 42501 into a token conflict
    expect(perm42501Mock.logs.some((l) => l.table === 'profiles')).toBe(false);

    // 3. Suspended 42501 likewise remains fail-closed (403)
    const suspended42501Mock = createTableMockClient({
      authUserId: USER_B,
      resolver: (entry) => {
        if (entry.table === 'device_tokens' && entry.op === 'select') {
          return { data: null, error: null };
        }
        if (entry.table === 'device_tokens' && entry.op === 'insert') {
          return { data: null, error: { code: '42501', message: 'RLS denied' } };
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

  it('requires explicit current-device token on signOut deactivation, cancels stale async registrations across logout and account switches, and isolates multi-account tokens', async () => {
    vi.useFakeTimers();
    try {
      // 1. Null, undefined, or malformed token on deactivateDeviceToken NEVER issues any UPDATE (multi-device safety)
      const nullTokenMock = createTableMockClient({
        authUserId: USER_A,
        resolver: () => ({ data: [], error: null }),
      });
      const nullRepo = createNotificationRepository(nullTokenMock.client);
      expect(await nullRepo.deactivateDeviceToken(null)).toBe(0);
      expect(await nullRepo.deactivateDeviceToken(undefined)).toBe(0);
      expect(await nullRepo.deactivateDeviceToken('')).toBe(0);
      expect(await nullRepo.deactivateDeviceToken('invalid-token-format')).toBe(0);
      expect(nullTokenMock.logs).toHaveLength(0);

      // Coordinator with no active token on signOut issues zero DB deactivation updates
      const coordinatorNoToken = createPushLifecycleCoordinator();
      const deactivateSpy = vi.fn(async () => 1);
      expect(
        await coordinatorNoToken.deactivateOnSignOut({
          deactivateToken: deactivateSpy,
          verifyActiveUser: async () => USER_A,
        }),
      ).toBe(0);
      expect(deactivateSpy).not.toHaveBeenCalled();

      // 2. Guest and Suspended are strictly prevented from registering push tokens
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

      // 3. Explicit token deactivation targets ONLY (user_id, currentDeviceToken) and leaves other users untouched
      const userADevices = new Map<string, { userId: string; isActive: boolean }>([
        [SHARED_TOKEN, { userId: USER_A, isActive: true }],
        ['ExponentPushToken[user_a_tablet_99999]', { userId: USER_A, isActive: true }],
      ]);

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
            const targetToken = String(entry.eqFilters.expo_push_token);
            const row = userADevices.get(targetToken);
            if (row && row.userId === entry.eqFilters.user_id && row.isActive) {
              row.isActive = false;
              return { data: [{ id: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1' }], error: null };
            }
            return { data: [], error: null };
          }
          return { data: null, error: null };
        },
      });

      const coordinator = createPushLifecycleCoordinator();
      const repoA = createNotificationRepository(userAMock.client);
      const userAReg = await coordinator.syncRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver(),
        registerToken: (input) => repoA.registerDeviceToken(input),
      });
      expect(userAReg).toEqual({ pushStatus: 'active', activeToken: SHARED_TOKEN });
      expect(coordinator.getState().activeToken).toBe(SHARED_TOKEN);

      const deactivatedCount = await coordinator.deactivateOnSignOut({
        deactivateToken: (tok) => repoA.deactivateDeviceToken(tok),
        verifyActiveUser: async () => USER_A,
      });
      expect(deactivatedCount).toBe(1);
      expect(coordinator.getState().activeToken).toBeNull();
      expect(coordinator.getState().activeUserId).toBeNull();
      expect(userADevices.get(SHARED_TOKEN)?.isActive).toBe(false);
      // User A's secondary device token remains untouched
      expect(userADevices.get('ExponentPushToken[user_a_tablet_99999]')?.isActive).toBe(true);

      // User B calling deactivateDeviceToken with User A's token cannot modify User A's record
      const userBOwnedDeactivate = new Map<string, { userId: string; isActive: boolean }>([
        [SHARED_TOKEN, { userId: USER_A, isActive: true }],
      ]);
      const userBDeactivateMock = createTableMockClient({
        authUserId: USER_B,
        resolver: (entry) => {
          if (entry.table === 'device_tokens' && entry.op === 'update') {
            expect(entry.eqFilters.user_id).toBe(USER_B);
            const row = userBOwnedDeactivate.get(String(entry.eqFilters.expo_push_token));
            if (row && row.userId === USER_B) {
              row.isActive = false;
              return { data: [{ id: 'row' }], error: null };
            }
            return { data: [], error: null };
          }
          return { data: null, error: null };
        },
      });
      expect(
        await createNotificationRepository(userBDeactivateMock.client).deactivateDeviceToken(
          SHARED_TOKEN,
        ),
      ).toBe(0);
      expect(userBOwnedDeactivate.get(SHARED_TOKEN)?.isActive).toBe(true);

      // 4. Stale async registration race: User A starts registration, logs out BEFORE completion -> memory stays clean
      let resolveUserAPerm!: (t: string | null) => void;
      let registerCallsA = 0;
      const raceCoordinator = createPushLifecycleCoordinator();
      const pendingUserAPromise = raceCoordinator.syncRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver({
          requestPermissionsAndGetToken: () =>
            new Promise<string | null>((resolve) => {
              resolveUserAPerm = resolve;
            }),
        }),
        registerToken: async (input) => {
          registerCallsA += 1;
          return {
            status: 'registered',
            token: {
              id: 't1',
              user_id: USER_A,
              expo_push_token: input.expo_push_token,
              platform: input.platform,
              device_id: input.device_id ?? null,
              app_version: input.app_version ?? null,
              locale: input.locale,
              is_active: true,
              last_seen_at: '2026-11-22T12:00:00Z',
              created_at: '2026-11-22T12:00:00Z',
              updated_at: '2026-11-22T12:00:00Z',
            },
          };
        },
      });

      const staleSignOut = raceCoordinator.deactivateOnSignOut({
        deactivateToken: vi.fn(async () => 0),
        verifyActiveUser: async () => USER_A,
        timeoutMs: 25,
      });
      await vi.advanceTimersByTimeAsync(40);
      await staleSignOut;
      resolveUserAPerm(SHARED_TOKEN);
      const staleLogoutOutcome = await pendingUserAPromise;
      expect(staleLogoutOutcome).toEqual({ pushStatus: 'idle', activeToken: null });
      expect(registerCallsA).toBe(0);
      expect(raceCoordinator.getState().activeToken).toBeNull();
      expect(raceCoordinator.getState().activeUserId).toBeNull();

      // 5. Async registration race across account switch (User A HTTP write still pending while User B activates)
      const USER_B_TOKEN = 'ExponentPushToken[user_b_unique_token_67890]';
      let resolveUserADbInsert!: (res: {
        status: 'registered';
        token: {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: 'android';
          device_id: null;
          app_version: null;
          locale: 'ar';
          is_active: true;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
      }) => void;

      const userARacePromise = raceCoordinator.syncRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver(),
        registerToken: () =>
          new Promise((resolve) => {
            resolveUserADbInsert = resolve;
          }),
      });
      await Promise.resolve();

      // User B becomes active immediately
      const userBRaceResult = await raceCoordinator.syncRegistration({
        userId: USER_B,
        accountStatus: 'approved',
        driver: createFakeDriver({
          requestPermissionsAndGetToken: async () => USER_B_TOKEN,
        }),
        registerToken: async (input) => ({
          status: 'registered',
          token: {
            id: 'tb',
            user_id: USER_B,
            expo_push_token: input.expo_push_token,
            platform: input.platform,
            device_id: null,
            app_version: null,
            locale: input.locale,
            is_active: true,
            last_seen_at: '2026-11-22T12:05:00Z',
            created_at: '2026-11-22T12:05:00Z',
            updated_at: '2026-11-22T12:05:00Z',
          },
        }),
      });
      expect(userBRaceResult).toEqual({ pushStatus: 'active', activeToken: USER_B_TOKEN });

      // Now User A's stale DB response resolves -> MUST NOT overwrite User B's active token/user
      resolveUserADbInsert({
        status: 'registered',
        token: {
          id: 'ta',
          user_id: USER_A,
          expo_push_token: SHARED_TOKEN,
          platform: 'android',
          device_id: null,
          app_version: null,
          locale: 'ar',
          is_active: true,
          last_seen_at: '2026-11-22T12:00:00Z',
          created_at: '2026-11-22T12:00:00Z',
          updated_at: '2026-11-22T12:00:00Z',
        },
      });
      expect(await userARacePromise).toEqual({ pushStatus: 'idle', activeToken: null });
      expect(raceCoordinator.getState().activeToken).toBe(USER_B_TOKEN);
      expect(raceCoordinator.getState().activeUserId).toBe(USER_B);

      // 6. Account switching where Account A stays registered on server -> Account B receives 23505 non-fatal degraded conflict
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
      const userBReg = await raceCoordinator.syncRegistration({
        userId: USER_B,
        accountStatus: 'approved',
        driver: createFakeDriver(),
        registerToken: (input) =>
          createNotificationRepository(userBMock.client).registerDeviceToken(input),
      });
      expect(userBReg).toEqual({ pushStatus: 'token_conflict_degraded', activeToken: null });
      expect(raceCoordinator.getState().activeToken).toBeNull();
      expect(sharedDeviceStore.get(SHARED_TOKEN)).toBe(USER_A);

      // 7. Hanging deactivation cannot block sign-out beyond bounded timeout
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

  it('prevents and compensates stale delayed DB writes using stateful RLS DB checks without ever acting as User B on User A rows', async () => {
    interface StatefulDeviceRow {
      id: string;
      user_id: string;
      expo_push_token: string;
      platform: 'android' | 'ios' | 'web';
      device_id: string | null;
      app_version: string | null;
      locale: 'ar' | 'en';
      is_active: boolean;
      last_seen_at: string;
      created_at: string;
      updated_at: string;
    }

    const createStatefulRlsDb = () => {
      let currentSessionUserId: string | null = USER_A;
      let nextId = 1;
      const rows: StatefulDeviceRow[] = [];
      const crossUserAttempts: Array<{ actor: string | null; targetOwner: string; op: string }> =
        [];

      let delayedGate: Promise<void> | null = null;
      let rejectGateOnAbort = true;
      let onInsertDispatched: (() => void) | null = null;

      const client = {
        auth: {
          getUser: async () =>
            currentSessionUserId
              ? {
                  data: {
                    user: { id: currentSessionUserId, email: `${currentSessionUserId}@shark.test` },
                  },
                  error: null,
                }
              : { data: { user: null }, error: null },
        },
        from(table: string) {
          const opState: {
            op: 'select' | 'insert' | 'update';
            payload?: Record<string, unknown>;
            filters: Record<string, unknown>;
            signal?: AbortSignal;
          } = {
            op: 'select',
            filters: {},
          };

          const execute = async (): Promise<{ data: unknown; error: unknown }> => {
            if (table !== 'device_tokens') {
              return { data: null, error: null };
            }
            const actorUid = currentSessionUserId;

            // Only delay the INSERT write for USER_A when test installs a delayedGate
            if (opState.op === 'insert' && actorUid === USER_A && delayedGate) {
              const capturedActor = actorUid;
              const gate = delayedGate;
              const signal = opState.signal;
              onInsertDispatched?.();
              onInsertDispatched = null;
              await new Promise<void>((resolve, reject) => {
                let done = false;
                const onAbort = () => {
                  if (done || !rejectGateOnAbort) {
                    return;
                  }
                  done = true;
                  reject(new DOMException('The operation was aborted', 'AbortError'));
                };
                if (signal?.aborted && rejectGateOnAbort) {
                  onAbort();
                  return;
                }
                signal?.addEventListener('abort', onAbort, { once: true });
                void gate.then(() => {
                  if (!done) {
                    done = true;
                    signal?.removeEventListener('abort', onAbort);
                    resolve();
                  }
                });
              });

              const payload = opState.payload!;
              const token = String(payload.expo_push_token);
              if (rows.some((r) => r.expo_push_token === token)) {
                return { data: null, error: { code: '23505', message: 'duplicate key' } };
              }
              const inserted: StatefulDeviceRow = {
                id: `dev-${nextId++}`,
                user_id: capturedActor,
                expo_push_token: token,
                platform: payload.platform as 'android',
                device_id: (payload.device_id as string | null) ?? null,
                app_version: (payload.app_version as string | null) ?? null,
                locale: payload.locale as 'ar',
                is_active: true,
                last_seen_at: String(payload.last_seen_at),
                created_at: String(payload.last_seen_at),
                updated_at: String(payload.last_seen_at),
              };
              rows.push(inserted);
              return { data: inserted, error: null };
            }

            if (opState.op === 'select') {
              const match = rows.find(
                (r) =>
                  r.user_id === actorUid &&
                  (!opState.filters.expo_push_token ||
                    r.expo_push_token === opState.filters.expo_push_token),
              );
              return { data: match ?? null, error: null };
            }

            if (opState.op === 'insert') {
              if (!actorUid) {
                return { data: null, error: { code: '42501', message: 'unauthenticated' } };
              }
              const payload = opState.payload!;
              const token = String(payload.expo_push_token);
              if (rows.some((r) => r.expo_push_token === token)) {
                return { data: null, error: { code: '23505', message: 'duplicate key' } };
              }
              const inserted: StatefulDeviceRow = {
                id: `dev-${nextId++}`,
                user_id: actorUid,
                expo_push_token: token,
                platform: payload.platform as 'android',
                device_id: (payload.device_id as string | null) ?? null,
                app_version: (payload.app_version as string | null) ?? null,
                locale: payload.locale as 'ar',
                is_active: true,
                last_seen_at: String(payload.last_seen_at),
                created_at: String(payload.last_seen_at),
                updated_at: String(payload.last_seen_at),
              };
              rows.push(inserted);
              return { data: inserted, error: null };
            }

            if (opState.op === 'update') {
              const targetByToken = rows.filter(
                (r) =>
                  !opState.filters.expo_push_token ||
                  r.expo_push_token === opState.filters.expo_push_token,
              );
              for (const candidate of targetByToken) {
                if (candidate.user_id !== actorUid) {
                  crossUserAttempts.push({
                    actor: actorUid,
                    targetOwner: candidate.user_id,
                    op: 'update',
                  });
                }
              }
              const updated: StatefulDeviceRow[] = [];
              for (const row of rows) {
                const matchUser = row.user_id === actorUid && opState.filters.user_id === actorUid;
                const matchToken =
                  !opState.filters.expo_push_token ||
                  row.expo_push_token === opState.filters.expo_push_token;
                const matchActive =
                  opState.filters.is_active === undefined ||
                  row.is_active === opState.filters.is_active;
                if (matchUser && matchToken && matchActive) {
                  Object.assign(row, opState.payload);
                  updated.push(row);
                }
              }
              return { data: updated, error: null };
            }

            return { data: null, error: null };
          };

          const builder = {
            select() {
              return builder;
            },
            insert(payload: Record<string, unknown>) {
              opState.op = 'insert';
              opState.payload = payload;
              return builder;
            },
            update(payload: Record<string, unknown>) {
              opState.op = 'update';
              opState.payload = payload;
              return builder;
            },
            eq(col: string, val: unknown) {
              opState.filters[col] = val;
              return builder;
            },
            abortSignal(signal: AbortSignal) {
              opState.signal = signal;
              return builder;
            },
            maybeSingle: () => execute(),
            single: () => execute(),
            then(
              onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) {
              return execute().then(onFulfilled, onRejected);
            },
          };

          return builder;
        },
      };

      return {
        client: client as unknown as Parameters<typeof createNotificationRepository>[0],
        rows,
        crossUserAttempts,
        setSessionUser: (uid: string | null) => {
          currentSessionUserId = uid;
        },
        setDelay: (gate: Promise<void> | null, abortable = true, onDispatched?: () => void) => {
          delayedGate = gate;
          rejectGateOnAbort = abortable;
          onInsertDispatched = onDispatched ?? null;
        },
      };
    };

    const verifyUid = async (c: Parameters<typeof createNotificationRepository>[0]) => {
      const { data } = await c.auth.getUser();
      return data.user?.id ?? null;
    };

    // --- Scenario A: AbortSignal cancels User A's delayed write on signOut before DB commit -> User A row stays inactive/absent, User B active ---
    {
      const db = createStatefulRlsDb();
      const repo = createNotificationRepository(db.client);
      const coordinator = createPushLifecycleCoordinator();

      let releaseDelayedInsert!: () => void;
      db.setDelay(
        new Promise<void>((r) => {
          releaseDelayedInsert = r;
        }),
        true,
      );

      const userATask = coordinator.syncRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver({ requestPermissionsAndGetToken: async () => SHARED_TOKEN }),
        registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
      });
      await Promise.resolve();

      // User A signs out -> aborts delayed request before JWT purge, then clears session and switches to User B
      await coordinator.deactivateOnSignOut({
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
      });
      db.setSessionUser(USER_B);
      db.setDelay(null);
      releaseDelayedInsert();

      const USER_B_TOKEN = 'ExponentPushToken[user_b_own_device_88888]';
      const userBRes = await coordinator.syncRegistration({
        userId: USER_B,
        accountStatus: 'approved',
        driver: createFakeDriver({ requestPermissionsAndGetToken: async () => USER_B_TOKEN }),
        registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
      });
      expect(await userATask).toEqual({ pushStatus: 'idle', activeToken: null });
      expect(userBRes).toEqual({ pushStatus: 'active', activeToken: USER_B_TOKEN });
      expect(db.rows.filter((r) => r.user_id === USER_A && r.is_active)).toHaveLength(0);
      expect(db.rows.filter((r) => r.user_id === USER_B && r.is_active)).toHaveLength(1);
      expect(db.crossUserAttempts).toHaveLength(0);
    }

    // --- Scenario B: DB already committed in-flight write despite abort inside signOut window -> User A session compensates BEFORE User B signs in ---
    {
      const db = createStatefulRlsDb();
      const repo = createNotificationRepository(db.client);
      const coordinator = createPushLifecycleCoordinator();

      let releaseDelayedInsert!: () => void;
      let markInsertDispatched!: () => void;
      const insertDispatched = new Promise<void>((r) => {
        markInsertDispatched = r;
      });
      db.setDelay(
        new Promise<void>((r) => {
          releaseDelayedInsert = r;
        }),
        false, // DB commits despite client abortSignal
        markInsertDispatched,
      );

      const userATask = coordinator.syncRegistration({
        userId: USER_A,
        accountStatus: 'approved',
        driver: createFakeDriver({ requestPermissionsAndGetToken: async () => SHARED_TOKEN }),
        registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
      });
      await insertDispatched;

      // SignOut begins while User A JWT is still live; delayed DB commit settles shortly after -> compensated as User A
      const signOutPromise = coordinator.deactivateOnSignOut({
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
        timeoutMs: 500,
      });
      releaseDelayedInsert();
      const compensated = await signOutPromise;
      expect(compensated).toBe(1);
      expect(await userATask).toEqual({ pushStatus: 'idle', activeToken: null });

      // Session now clears and User B becomes active cleanly
      db.setSessionUser(USER_B);
      db.setDelay(null);
      const USER_B_TOKEN = 'ExponentPushToken[user_b_compensated_99999]';
      await coordinator.syncRegistration({
        userId: USER_B,
        accountStatus: 'approved',
        driver: createFakeDriver({ requestPermissionsAndGetToken: async () => USER_B_TOKEN }),
        registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser: () => verifyUid(db.client),
      });

      const userARows = db.rows.filter((r) => r.user_id === USER_A);
      const userBRows = db.rows.filter((r) => r.user_id === USER_B);
      expect(userARows).toHaveLength(1);
      expect(userARows[0]?.is_active).toBe(false);
      expect(userBRows).toHaveLength(1);
      expect(userBRows[0]?.is_active).toBe(true);
      expect(userBRows[0]?.expo_push_token).toBe(USER_B_TOKEN);
      expect(db.crossUserAttempts).toHaveLength(0);
    }

    // --- Scenario C: Stale write exceeds signOut timeout & completes AFTER User B is active -> NEVER uses User B session on User A row & protects User B state ---
    {
      vi.useFakeTimers();
      try {
        const db = createStatefulRlsDb();
        const repo = createNotificationRepository(db.client);
        const coordinator = createPushLifecycleCoordinator();

        let releaseVeryLateInsert!: () => void;
        let markVeryLateDispatched!: () => void;
        const veryLateDispatched = new Promise<void>((r) => {
          markVeryLateDispatched = r;
        });
        db.setDelay(
          new Promise<void>((r) => {
            releaseVeryLateInsert = r;
          }),
          false,
          markVeryLateDispatched,
        );

        const userATask = coordinator.syncRegistration({
          userId: USER_A,
          accountStatus: 'approved',
          driver: createFakeDriver({ requestPermissionsAndGetToken: async () => SHARED_TOKEN }),
          registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
          deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
          verifyActiveUser: () => verifyUid(db.client),
        });
        await veryLateDispatched;

        // Bounded signOut finishes at 50ms timeout without hanging forever
        const signOutPromise = coordinator.deactivateOnSignOut({
          deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
          verifyActiveUser: () => verifyUid(db.client),
          timeoutMs: 50,
        });
        await vi.advanceTimersByTimeAsync(60);
        await signOutPromise;

        // Session switches to User B and User B activates on same client
        db.setSessionUser(USER_B);
        db.setDelay(null);
        const USER_B_TOKEN = 'ExponentPushToken[user_b_isolated_77777]';
        const userBResult = await coordinator.syncRegistration({
          userId: USER_B,
          accountStatus: 'approved',
          driver: createFakeDriver({ requestPermissionsAndGetToken: async () => USER_B_TOKEN }),
          registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
          deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
          verifyActiveUser: () => verifyUid(db.client),
        });
        expect(userBResult).toEqual({ pushStatus: 'active', activeToken: USER_B_TOKEN });

        // Now User A's very-late server write finally returns while User B is signed in
        releaseVeryLateInsert();
        expect(await userATask).toEqual({ pushStatus: 'idle', activeToken: null });

        // User B's in-memory token, DB record, and session remain untouched; zero cross-user cleanup calls occurred
        expect(coordinator.getState().activeUserId).toBe(USER_B);
        expect(coordinator.getState().activeToken).toBe(USER_B_TOKEN);
        expect(db.rows.find((r) => r.user_id === USER_B)?.is_active).toBe(true);
        expect(db.crossUserAttempts).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    }
  });

  it('handles delayed-write failures after User A signOut and User B activation cleanly with zero active User A tokens and untouched User B records', async () => {
    let currentUid: string | null = USER_A;
    const dbRows: { id: string; user_id: string; expo_push_token: string; is_active: boolean }[] =
      [];
    const userBUpdateAttemptsOnA: string[] = [];

    let rejectUserADelayedWrite!: (err: unknown) => void;
    let notifyFailInsertDispatched!: () => void;
    const failInsertDispatched = new Promise<void>((r) => {
      notifyFailInsertDispatched = r;
    });

    const repoClient = {
      auth: {
        getUser: async () =>
          currentUid
            ? { data: { user: { id: currentUid, email: `${currentUid}@shark.test` } }, error: null }
            : { data: { user: null }, error: null },
      },
      from() {
        let op = 'select';
        let payload: Record<string, unknown> = {};
        const filters: Record<string, unknown> = {};

        const finish = async (): Promise<{ data: unknown; error: unknown }> => {
          if (op === 'select') {
            return { data: null, error: null };
          }
          if (op === 'insert' && currentUid === USER_A) {
            return new Promise((_, reject) => {
              rejectUserADelayedWrite = reject;
              notifyFailInsertDispatched();
            });
          }
          if (op === 'insert' && currentUid === USER_B) {
            const row = {
              id: 'b-fail-path',
              user_id: USER_B,
              expo_push_token: String(payload.expo_push_token),
              is_active: true,
            };
            dbRows.push(row);
            return { data: row, error: null };
          }
          if (op === 'update') {
            if (filters.user_id !== currentUid) {
              userBUpdateAttemptsOnA.push(String(filters.user_id));
            }
            return { data: [], error: null };
          }
          return { data: null, error: null };
        };

        const b = {
          select: () => b,
          insert(p: Record<string, unknown>) {
            op = 'insert';
            payload = p;
            return b;
          },
          update(p: Record<string, unknown>) {
            op = 'update';
            payload = p;
            return b;
          },
          eq(c: string, v: unknown) {
            filters[c] = v;
            return b;
          },
          abortSignal: () => b,
          maybeSingle: () => finish(),
          single: () => finish(),
          then(
            onFulfilled?: (v: { data: unknown; error: unknown }) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) {
            return finish().then(onFulfilled, onRejected);
          },
        };
        return b;
      },
    } as unknown as Parameters<typeof createNotificationRepository>[0];

    const repo = createNotificationRepository(repoClient);
    const coordinator = createPushLifecycleCoordinator();
    const verifyActiveUser = async () => {
      const { data } = await repoClient.auth.getUser();
      return data.user?.id ?? null;
    };

    const userAPending = coordinator.syncRegistration({
      userId: USER_A,
      accountStatus: 'approved',
      driver: createFakeDriver({ requestPermissionsAndGetToken: async () => SHARED_TOKEN }),
      registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
      deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
      verifyActiveUser,
    });
    await failInsertDispatched;

    vi.useFakeTimers();
    try {
      const signOutPromise = coordinator.deactivateOnSignOut({
        deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
        verifyActiveUser,
        timeoutMs: 30,
      });
      await vi.advanceTimersByTimeAsync(40);
      await signOutPromise;
    } finally {
      vi.useRealTimers();
    }

    currentUid = USER_B;
    const USER_B_TOKEN = 'ExponentPushToken[user_b_after_fail_55555]';
    const userBOutcome = await coordinator.syncRegistration({
      userId: USER_B,
      accountStatus: 'approved',
      driver: createFakeDriver({ requestPermissionsAndGetToken: async () => USER_B_TOKEN }),
      registerToken: (input, opts) => repo.registerDeviceToken(input, opts),
      deactivateToken: (tok) => repo.deactivateDeviceToken(tok),
      verifyActiveUser,
    });
    expect(userBOutcome).toEqual({ pushStatus: 'active', activeToken: USER_B_TOKEN });

    // Now User A's delayed DB write rejects after User B is active
    rejectUserADelayedWrite(new Error('network timeout'));
    expect(await userAPending).toEqual({ pushStatus: 'idle', activeToken: null });

    expect(dbRows.filter((r) => r.user_id === USER_A)).toHaveLength(0);
    expect(dbRows.filter((r) => r.user_id === USER_B && r.is_active)).toHaveLength(1);
    expect(coordinator.getState().activeUserId).toBe(USER_B);
    expect(coordinator.getState().activeToken).toBe(USER_B_TOKEN);
    expect(userBUpdateAttemptsOnA).toHaveLength(0);
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
    expect(useAuthSrc).toContain('invalidatePushLifecycle');
    expect(useNotificationsSrc).toContain('isInboxAndSupportAllowedStatus');
    expect(useNotificationsSrc).toContain('invalidatePushLifecycle');
    expect(useNotificationsSrc).toContain('isCurrentSession');
  });
});
