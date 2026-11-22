import { Platform } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppLocale, DevicePlatform } from '@shark/shared-types';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { MobileAuthStatus } from '../hooks/auth-state';
import { createNotificationRepository } from '../repositories/notification.repository';
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
  type DeviceTokenRegistrationResult,
  type MobileNotificationItem,
  type NotificationPagesSnapshot,
  type PushNotificationDriver,
  type PushRegistrationStatus,
  type PushRegistrationSyncResult,
  type RealtimeNotificationChannelLike,
  type RealtimeNotificationClientLike,
  type RegisterDeviceTokenCommand,
} from './notifications-core';

export {
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
  type DeviceTokenRegistrationResult,
  type MobileNotificationItem,
  type NotificationPagesSnapshot,
  type PushNotificationDriver,
  type PushRegistrationStatus,
  type PushRegistrationSyncResult,
  type RealtimeNotificationChannelLike,
  type RealtimeNotificationClientLike,
  type RegisterDeviceTokenCommand,
};

let activeRegisteredPushToken: string | null = null;
let foregroundHandlerConfigured = false;

export function getActiveRegisteredPushToken(): string | null {
  return activeRegisteredPushToken;
}

export function setActiveRegisteredPushToken(token: string | null): void {
  activeRegisteredPushToken = token;
}

export function configureForegroundNotificationHandler(): void {
  if (foregroundHandlerConfigured || Platform.OS === 'web') {
    return;
  }
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  foregroundHandlerConfigured = true;
}

function resolveExpoProjectId(): string | undefined {
  const extraConfig = Constants.expoConfig?.extra as
    { readonly eas?: { readonly projectId?: unknown } } | undefined;
  const fromExtra =
    typeof extraConfig?.eas?.projectId === 'string' && extraConfig.eas.projectId.trim().length > 0
      ? extraConfig.eas.projectId.trim()
      : undefined;
  if (fromExtra) {
    return fromExtra;
  }
  const fromEas = Constants.easConfig?.projectId?.trim();
  return fromEas && fromEas.length > 0 ? fromEas : undefined;
}

function resolvePlatform(): DevicePlatform {
  if (Platform.OS === 'ios') {
    return 'ios';
  }
  if (Platform.OS === 'android') {
    return 'android';
  }
  return 'web';
}

export function createNativePushNotificationDriver(locale: AppLocale): PushNotificationDriver {
  const platform = resolvePlatform();

  return {
    isPhysicalDevice: Device.isDevice && platform !== 'web',
    platform,
    locale,
    deviceId: Device.osInternalBuildId ?? Device.osBuildId ?? null,
    appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? null,
    async requestPermissionsAndGetToken(): Promise<string | null> {
      configureForegroundNotificationHandler();

      if (platform === 'android') {
        await Notifications.setNotificationChannelAsync('shark-default', {
          name: 'SHARK Notifications',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const existingPermissions = await Notifications.getPermissionsAsync();
      let finalStatus = existingPermissions.status;
      if (finalStatus !== 'granted') {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
      }
      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId = resolveExpoProjectId();
      const tokenResponse = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      return tokenResponse.data || null;
    },
  };
}

export async function syncNativeDevicePushRegistration(params: {
  readonly client: SupabaseClient;
  readonly userId: string;
  readonly accountStatus: MobileAuthStatus;
  readonly locale: AppLocale;
}): Promise<PushRegistrationSyncResult> {
  const repo = createNotificationRepository(params.client);
  const result = await syncDevicePushRegistration({
    userId: params.userId,
    accountStatus: params.accountStatus,
    driver: createNativePushNotificationDriver(params.locale),
    registerToken: (input) => repo.registerDeviceToken(input),
  });
  activeRegisteredPushToken = result.activeToken;
  return result;
}

/**
 * Best-effort deactivation of the current account's device push tokens before sign-out clears the JWT.
 * Bounded strictly so offline/revoked sign-outs never hang or fail.
 */
export async function bestEffortDeactivatePushTokensOnSignOut(
  client: SupabaseClient,
  timeoutMs = 500,
): Promise<void> {
  const tokenToDeactivate = activeRegisteredPushToken;
  activeRegisteredPushToken = null;
  const repo = createNotificationRepository(client);
  await runBoundedPushDeactivation(() => repo.deactivateDeviceToken(tokenToDeactivate), timeoutMs);
}

export function extractSafeDeepLinkFromNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const rawData = response?.notification.request.content.data as
    Record<string, unknown> | undefined;
  const candidate = typeof rawData?.deepLink === 'string' ? rawData.deepLink : null;
  return sanitizeNotificationDeepLink(candidate);
}

export function subscribeToNotificationResponseDeepLinks(
  onDeepLink: (relativePath: string) => void,
): () => void {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const safePath = extractSafeDeepLinkFromNotificationResponse(response);
    if (safePath) {
      onDeepLink(safePath);
    }
  });

  return () => {
    sub.remove();
  };
}
