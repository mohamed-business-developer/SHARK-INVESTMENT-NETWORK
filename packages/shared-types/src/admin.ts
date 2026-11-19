import type { AdminPermissionScope, AdminRoleName, UserRole } from './enums';

export interface SectorRow {
  readonly id: string;
  readonly slug: string;
  readonly name_ar: string;
  readonly name_en: string;
  readonly description_ar: string | null;
  readonly description_en: string | null;
  readonly icon_name: string | null;
  readonly sort_order: number;
  readonly is_active: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface AdminRoleRow {
  readonly id: string;
  readonly user_id: string;
  readonly role_name: AdminRoleName;
  readonly permissions: readonly AdminPermissionScope[];
  readonly is_active: boolean;
  readonly assigned_by: string | null;
  readonly revoked_by: string | null;
  readonly revoked_at: string | null;
  readonly notes: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface ActivityLogRow {
  readonly id: string;
  readonly actor_id: string | null;
  readonly actor_role: UserRole | null;
  readonly actor_admin_role: AdminRoleName | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly previous_state: Record<string, unknown> | null;
  readonly new_state: Record<string, unknown> | null;
  readonly reason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly request_id: string | null;
  readonly ip_hash: string | null;
  readonly created_at: string;
}

export interface SystemSettingRow {
  readonly id: string;
  readonly setting_key: string;
  readonly value: Record<string, unknown> | string | number | boolean;
  readonly description_ar: string | null;
  readonly description_en: string | null;
  readonly is_public: boolean;
  readonly updated_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type AdminUserActionType =
  'approve' | 'reject' | 'suspend' | 'reactivate' | 'change_role' | 'assign_admin_role';

export interface AdminUserActionRequest {
  readonly action: AdminUserActionType;
  readonly targetUserId: string;
  readonly role?: UserRole;
  readonly adminRole?: AdminRoleName;
  readonly permissions?: readonly AdminPermissionScope[];
  readonly reason?: string;
}

export type AdminReviewEntityType = 'company' | 'verification_request' | 'pitch' | 'pitch_document';

export interface AdminReviewEntityRequest {
  readonly entityType: AdminReviewEntityType;
  readonly entityId: string;
  readonly decision: string;
  readonly reason?: string;
  readonly feedbackAr?: string;
  readonly feedbackEn?: string;
  readonly checklist?: Record<string, boolean | string | number>;
  readonly isInternal?: boolean;
}

export interface ApiErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly messageKey: string;
    readonly requestId: string;
  };
}
