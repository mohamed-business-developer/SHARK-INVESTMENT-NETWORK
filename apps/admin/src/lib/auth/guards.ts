import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminPermissionScope } from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import { getValidatedAdminPublicEnv } from '../env';
import { getValidatedAdminServerEnv } from '../env.server';
import { createAdminServiceClient } from '../supabase/admin';
import { createAdminServerClient } from '../supabase/server';
import { validateAdminOriginHeaders } from './origin-and-middleware';
import {
  assertNotActingOnSelf,
  verifyAdminActorFromClients,
  type AdminActorContext,
  type VerifyAdminClientsOptions,
} from './verify-admin-actor';

export {
  assertNotActingOnSelf,
  verifyAdminActorFromClients,
  type AdminActorContext,
  type VerifyAdminClientsOptions,
};

/**
 * Enforces CSRF Origin / Referer matching against ADMIN_ALLOWED_ORIGINS fail-closed.
 */
export async function assertValidAdminOrigin(requestHeaders?: Headers): Promise<string> {
  const hdrs = requestHeaders ?? (await headers());
  const { allowedOrigins } = getValidatedAdminServerEnv();
  return validateAdminOriginHeaders(hdrs, allowedOrigins);
}

/**
 * Verifies live Admin session + MFA AAL2 policy + governance role + optional permission scope server-side.
 */
export async function requireAdminContext(
  requiredScope?: AdminPermissionScope,
): Promise<AdminActorContext> {
  const publicEnv = getValidatedAdminPublicEnv();
  const authClient = await createAdminServerClient();

  return verifyAdminActorFromClients({
    authClient,
    serviceClient: () => createAdminServiceClient(),
    requiredScope,
    requireMfaAal2: publicEnv.NEXT_PUBLIC_APP_ENV === 'production',
  });
}

/**
 * Server-Component / Layout guard redirecting unauthenticated users to `/login`
 * and unauthorized/suspended/non-admin/MFA-incomplete callers to `/unauthorized`.
 */
export async function requireAdminSessionOrRedirect(
  requiredScope?: AdminPermissionScope,
): Promise<AdminActorContext> {
  try {
    return await requireAdminContext(requiredScope);
  } catch (err) {
    if (err instanceof AppDomainError) {
      if (err.code === 'UNAUTHORIZED' || err.code === 'ENV_MISCONFIGURED') {
        redirect('/login');
      }
      redirect('/unauthorized');
    }
    redirect('/unauthorized');
  }
}
