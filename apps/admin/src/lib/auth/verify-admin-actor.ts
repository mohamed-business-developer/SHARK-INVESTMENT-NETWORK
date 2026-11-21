import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminPermissionScope, AdminRoleName, AppLocale } from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';

export interface AdminActorContext {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly preferredLanguage: AppLocale;
  readonly roleName: AdminRoleName;
  readonly permissions: readonly AdminPermissionScope[];
}

export interface VerifyAdminClientsOptions {
  readonly authClient: SupabaseClient;
  readonly serviceClient: SupabaseClient;
  readonly requiredScope?: AdminPermissionScope;
}

const ADMIN_PROFILE_SELECT_COLUMNS =
  'id, email, full_name, full_name_ar, full_name_en, preferred_language, role, account_status, deleted_at';

const ADMIN_ROLE_SELECT_COLUMNS = 'role_name, permissions, is_active, deleted_at';

/**
 * Blocks administrators from moderating, suspending, or altering their own account.
 */
export function assertNotActingOnSelf(actorUserId: string, targetUserId: string): void {
  if (actorUserId === targetUserId) {
    throw new AppDomainError({
      code: 'SELF_ACTION_FORBIDDEN',
      messageKey: 'errors.cannotActOnSelf',
      statusCode: 403,
    });
  }
}

/**
 * Pure server-side Triple-Gate verification core:
 * 1) Verified JWT exclusively via `authClient.auth.getUser()` + MFA `aal2` if enrolled.
 * 2) Live PostgreSQL `profiles` (`role === 'admin'`, `account_status === 'approved'`, `deleted_at IS NULL`).
 * 3) Live active `admin_roles` row (`is_active === true`, `deleted_at IS NULL`) + scope match.
 */
export async function verifyAdminActorFromClients(
  options: VerifyAdminClientsOptions,
): Promise<AdminActorContext> {
  const { authClient, serviceClient, requiredScope } = options;

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    throw new AppDomainError({
      code: 'UNAUTHORIZED',
      messageKey: 'errors.unauthorized',
      statusCode: 401,
    });
  }

  if (typeof authClient.auth.mfa?.getAuthenticatorAssuranceLevel === 'function') {
    const { data: aalData, error: aalError } =
      await authClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) {
      throw new AppDomainError({
        code: 'FORBIDDEN',
        messageKey: 'errors.adminRequired',
        statusCode: 403,
      });
    }
    if (aalData?.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
      throw new AppDomainError({
        code: 'MFA_REQUIRED',
        messageKey: 'errors.adminRequired',
        statusCode: 403,
      });
    }
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select(ADMIN_PROFILE_SELECT_COLUMNS)
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.deleted_at !== null) {
    throw new AppDomainError({
      code: 'FORBIDDEN',
      messageKey: 'errors.profileNotFound',
      statusCode: 403,
    });
  }

  if (profile.account_status === 'suspended') {
    throw new AppDomainError({
      code: 'ACCOUNT_SUSPENDED',
      messageKey: 'errors.accountSuspended',
      statusCode: 403,
    });
  }

  if (profile.role !== 'admin' || profile.account_status !== 'approved') {
    throw new AppDomainError({
      code: 'FORBIDDEN',
      messageKey: 'errors.adminRequired',
      statusCode: 403,
    });
  }

  const { data: adminRoleRow, error: roleError } = await serviceClient
    .from('admin_roles')
    .select(ADMIN_ROLE_SELECT_COLUMNS)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  if (roleError || !adminRoleRow) {
    throw new AppDomainError({
      code: 'FORBIDDEN',
      messageKey: 'errors.adminRequired',
      statusCode: 403,
    });
  }

  const roleName = adminRoleRow.role_name as AdminRoleName;
  const permissions = Array.isArray(adminRoleRow.permissions)
    ? (adminRoleRow.permissions as AdminPermissionScope[])
    : [];

  if (requiredScope && roleName !== 'super_admin' && !permissions.includes(requiredScope)) {
    throw new AppDomainError({
      code: 'FORBIDDEN',
      messageKey: 'errors.insufficientAdminScope',
      statusCode: 403,
    });
  }

  return Object.freeze({
    userId: String(profile.id),
    email: String(profile.email),
    fullName: String(profile.full_name ?? ''),
    preferredLanguage: profile.preferred_language === 'en' ? 'en' : 'ar',
    roleName,
    permissions: Object.freeze([...permissions]),
  });
}
