import type {
  AppLocale,
  DevicePlatform,
  NotificationCategory,
  SupportRequestCategory,
  SupportRequestStatus,
  UserRole,
} from './enums';

export interface NotificationRow {
  readonly id: string;
  readonly user_id: string;
  readonly sent_by: string | null;
  readonly category: NotificationCategory;
  readonly title_ar: string;
  readonly title_en: string;
  readonly body_ar: string;
  readonly body_en: string;
  readonly deep_link: string | null;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly metadata: Record<string, string | number | boolean | null>;
  readonly is_read: boolean;
  readonly read_at: string | null;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface DeviceTokenRow {
  readonly id: string;
  readonly user_id: string;
  readonly expo_push_token: string;
  readonly platform: DevicePlatform;
  readonly device_id: string | null;
  readonly app_version: string | null;
  readonly locale: AppLocale;
  readonly is_active: boolean;
  readonly last_seen_at: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface SupportRequestRow {
  readonly id: string;
  readonly user_id: string | null;
  readonly contact_email: string | null;
  readonly category: SupportRequestCategory;
  readonly subject: string;
  readonly message: string;
  readonly status: SupportRequestStatus;
  readonly assigned_to: string | null;
  readonly admin_response: string | null;
  readonly resolved_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export type NotificationTargetMode = 'user_ids' | 'role' | 'sector' | 'all_approved';

export interface SendPushNotificationRequest {
  readonly targetMode: NotificationTargetMode;
  readonly userIds?: readonly string[];
  readonly role?: UserRole;
  readonly sectorId?: string;
  readonly category: NotificationCategory;
  readonly titleAr: string;
  readonly titleEn: string;
  readonly bodyAr: string;
  readonly bodyEn: string;
  readonly deepLink?: string;
  readonly entityType?: string;
  readonly entityId?: string;
}
