import type { SupabaseClient } from '@supabase/supabase-js';
import type { CursorPageResponse, DeviceTokenRow, NotificationCategory } from '@shark/shared-types';
import { buildCursorPage } from '@shark/utils';
import {
  expoPushTokenSchema,
  paginationQuerySchema,
  registerDeviceTokenSchema,
  uuidSchema,
} from '@shark/validation';
import { z } from 'zod';
import { NOTIFICATION_CATEGORIES } from '@shark/shared-types';
import {
  sanitizeNotificationDeepLink,
  type DeviceTokenRegistrationResult,
  type MobileNotificationItem,
} from '../services/notifications-core';
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
 * Explicit inbox projection for `public.notifications`; intentionally omits `sent_by`.
 */
export const NOTIFICATION_SELECT_COLUMNS = [
  'id',
  'user_id',
  'category',
  'title_ar',
  'title_en',
  'body_ar',
  'body_en',
  'deep_link',
  'entity_type',
  'entity_id',
  'metadata',
  'is_read',
  'read_at',
  'created_at',
  'deleted_at',
].join(', ');

/**
 * Explicit self-owned device token projection (`0007` restricts all ops strictly to `user_id = auth.uid()`).
 */
export const DEVICE_TOKEN_SELECT_COLUMNS = [
  'id',
  'user_id',
  'expo_push_token',
  'platform',
  'device_id',
  'app_version',
  'locale',
  'is_active',
  'last_seen_at',
  'created_at',
  'updated_at',
].join(', ');

const notificationCategoryFilterSchema = z.enum(NOTIFICATION_CATEGORIES);

export type RegisterDeviceTokenInput = z.input<typeof registerDeviceTokenSchema>;

export interface ListNotificationsOptions {
  readonly unreadOnly?: boolean;
  readonly category?: NotificationCategory;
  readonly cursor?: string | null;
  readonly limit?: number;
}

export interface MobileNotificationRepository {
  readonly listNotifications: (
    options?: ListNotificationsOptions,
  ) => Promise<CursorPageResponse<MobileNotificationItem>>;
  readonly getUnreadCount: () => Promise<number>;
  readonly markNotificationAsRead: (notificationId: string) => Promise<MobileNotificationItem>;
  readonly markAllNotificationsAsRead: () => Promise<number>;
  readonly softDeleteNotification: (notificationId: string) => Promise<void>;
  readonly registerDeviceToken: (
    input: RegisterDeviceTokenInput,
  ) => Promise<DeviceTokenRegistrationResult>;
  readonly deactivateDeviceToken: (expoPushToken?: string | null) => Promise<number>;
}

function normalizeNotificationRow(row: MobileNotificationItem): MobileNotificationItem {
  return {
    ...row,
    deep_link: sanitizeNotificationDeepLink(row.deep_link),
  };
}

function extractRawErrorCode(err: unknown): { code?: string } {
  if (typeof err !== 'object' || err === null) {
    return {};
  }
  const rec = err as Record<string, unknown>;
  return {
    code: typeof rec.code === 'string' ? rec.code : undefined,
  };
}

/**
 * Notifications inbox & push token lifecycle repository.
 * Accessible to authenticated non-suspended users (`pending`, `rejected`, `approved`) under RLS.
 */
export function createNotificationRepository(client: SupabaseClient): MobileNotificationRepository {
  return {
    async listNotifications(
      options?: ListNotificationsOptions,
    ): Promise<CursorPageResponse<MobileNotificationItem>> {
      const pageParams = parseRepositoryInput(paginationQuerySchema, {
        cursor: options?.cursor ?? null,
        limit: options?.limit ?? 20,
      });
      const validCategory = options?.category
        ? parseRepositoryInput(notificationCategoryFilterSchema, options.category)
        : undefined;
      const decodedCursor = resolveCursorOrThrow(pageParams.cursor);
      const limit = clampPageLimit(pageParams.limit, 20);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        let query = client
          .from('notifications')
          .select(NOTIFICATION_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .is('deleted_at', null);

        if (options?.unreadOnly === true) {
          query = query.eq('is_read', false);
        }
        if (validCategory) {
          query = query.eq('category', validCategory);
        }

        query = applyCreatedAtCursorFilter(query, decodedCursor);

        const result = await query
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(limit + 1);

        const rows = (await assertSupabaseResult(result)) ?? [];
        const normalizedRows = (rows as unknown as MobileNotificationItem[]).map(
          normalizeNotificationRow,
        );
        return buildCursorPage(normalizedRows, limit, (item) => ({
          ts: item.created_at,
          id: item.id,
        }));
      });
    },

    async getUnreadCount(): Promise<number> {
      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false)
          .is('deleted_at', null);

        await assertSupabaseResult({ data: null, error: result.error });
        return result.count ?? 0;
      });
    },

    async markNotificationAsRead(notificationId: string): Promise<MobileNotificationItem> {
      const validId = parseRepositoryInput(uuidSchema, notificationId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .eq('id', validId)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .select(NOTIFICATION_SELECT_COLUMNS)
          .maybeSingle();

        const row = requireEntityRow(
          await assertSupabaseResult(result),
        ) as unknown as MobileNotificationItem;
        return normalizeNotificationRow(row);
      });
    },

    async markAllNotificationsAsRead(): Promise<number> {
      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('notifications')
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('is_read', false)
          .is('deleted_at', null)
          .select('id');

        const rows = (await assertSupabaseResult(result)) ?? [];
        return (rows as unknown[]).length;
      });
    },

    async softDeleteNotification(notificationId: string): Promise<void> {
      const validId = parseRepositoryInput(uuidSchema, notificationId);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const result = await client
          .from('notifications')
          .update({
            deleted_at: new Date().toISOString(),
          })
          .eq('id', validId)
          .eq('user_id', user.id)
          .is('deleted_at', null)
          .select('id')
          .maybeSingle();

        requireEntityRow(await assertSupabaseResult(result));
      });
    },

    async registerDeviceToken(
      input: RegisterDeviceTokenInput,
    ): Promise<DeviceTokenRegistrationResult> {
      const parsed = parseRepositoryInput(registerDeviceTokenSchema, input);

      return executeServiceCall(async () => {
        const user = await requireAuthenticatedUser(client);
        const nowIso = new Date().toISOString();

        // Check strictly within caller's own RLS-scoped rows; never query other accounts.
        const existingRes = await client
          .from('device_tokens')
          .select(DEVICE_TOKEN_SELECT_COLUMNS)
          .eq('user_id', user.id)
          .eq('expo_push_token', parsed.expo_push_token)
          .maybeSingle();

        const existingRow = (await assertSupabaseResult(
          existingRes,
        )) as unknown as DeviceTokenRow | null;

        const writeResult = existingRow
          ? await client
              .from('device_tokens')
              .update({
                platform: parsed.platform,
                device_id: parsed.device_id ?? null,
                app_version: parsed.app_version ?? null,
                locale: parsed.locale,
                is_active: true,
                last_seen_at: nowIso,
              })
              .eq('id', existingRow.id)
              .eq('user_id', user.id)
              .select(DEVICE_TOKEN_SELECT_COLUMNS)
              .single()
          : await client
              .from('device_tokens')
              .insert({
                user_id: user.id,
                expo_push_token: parsed.expo_push_token,
                platform: parsed.platform,
                device_id: parsed.device_id ?? null,
                app_version: parsed.app_version ?? null,
                locale: parsed.locale,
                is_active: true,
                last_seen_at: nowIso,
              })
              .select(DEVICE_TOKEN_SELECT_COLUMNS)
              .single();

        if (writeResult.error) {
          const { code } = extractRawErrorCode(writeResult.error);
          if (code === '23505') {
            // Verified SQLSTATE 23505 unique_violation on expo_push_token; non-fatal degraded conflict without owner disclosure.
            return {
              status: 'degraded_conflict',
              reasonCode: 'PUSH_TOKEN_OWNERSHIP_CONFLICT',
              token: null,
            };
          }
        }

        const saved = requireEntityRow(
          await assertSupabaseResult(writeResult),
        ) as unknown as DeviceTokenRow;
        return {
          status: 'registered',
          token: saved,
        };
      });
    },

    async deactivateDeviceToken(expoPushToken?: string | null): Promise<number> {
      const safeToken =
        typeof expoPushToken === 'string' ? expoPushTokenSchema.safeParse(expoPushToken) : null;
      if (!safeToken || !safeToken.success) {
        // Explicit validated current-device token is required; never deactivate other devices when absent.
        return 0;
      }

      return executeServiceCall(async () => {
        const { data: userData, error: authError } = await client.auth.getUser();
        if (authError || !userData.user) {
          return 0;
        }

        const result = await client
          .from('device_tokens')
          .update({
            is_active: false,
            last_seen_at: new Date().toISOString(),
          })
          .eq('user_id', userData.user.id)
          .eq('expo_push_token', safeToken.data)
          .eq('is_active', true)
          .select('id');

        const rows = (await assertSupabaseResult(result)) ?? [];
        return (rows as unknown[]).length;
      });
    },
  };
}
