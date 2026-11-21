'use server';

import { headers } from 'next/headers';
import { AppDomainError } from '@shark/utils';
import { loginSchema } from '@shark/validation';
import { recordVerifiedAdminAuthAudit } from '@/lib/auth/audit';
import { assertValidAdminOrigin, verifyAdminActorFromClients } from '@/lib/auth/guards';
import { sanitizeAdminRedirectPath } from '@/lib/auth/origin-and-middleware';
import { getValidatedAdminPublicEnv } from '@/lib/env';
import { createAdminServiceClient } from '@/lib/supabase/admin';
import { createAdminServerClient } from '@/lib/supabase/server';

export interface AdminLoginInput {
  readonly email: string;
  readonly password: string;
  readonly next?: string;
}

export interface AdminAuthActionResult {
  readonly ok: boolean;
  readonly messageKey?: string;
  readonly redirectTo?: string;
}

/**
 * Authenticates an Admin portal caller through Origin/CSRF checks, password verification,
 * Triple-Gate live role verification, MFA policy enforcement, and immutable `activity_logs` recording.
 */
export async function adminLoginAction(input: AdminLoginInput): Promise<AdminAuthActionResult> {
  const requestHeaders = await headers();

  try {
    await assertValidAdminOrigin(requestHeaders);
  } catch (err) {
    if (err instanceof AppDomainError) {
      return { ok: false, messageKey: err.messageKey };
    }
    return { ok: false, messageKey: 'errors.originForbidden' };
  }

  const parsed = loginSchema.safeParse({
    email: input.email,
    password: input.password,
  });
  if (!parsed.success) {
    return {
      ok: false,
      messageKey: parsed.error.issues[0]?.message ?? 'errors.validationFailed',
    };
  }

  let publicEnv: ReturnType<typeof getValidatedAdminPublicEnv>;
  let authClient: Awaited<ReturnType<typeof createAdminServerClient>>;

  try {
    publicEnv = getValidatedAdminPublicEnv();
    authClient = await createAdminServerClient();
  } catch (err) {
    if (err instanceof AppDomainError) {
      return { ok: false, messageKey: err.messageKey };
    }
    return { ok: false, messageKey: 'errors.envMisconfigured' };
  }

  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (signInError || !signInData.user) {
    return { ok: false, messageKey: 'errors.invalidCredentials' };
  }

  // Instantiate service-role client strictly AFTER password authentication succeeds.
  let serviceClient: ReturnType<typeof createAdminServiceClient>;
  try {
    serviceClient = createAdminServiceClient();
  } catch (err) {
    await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
    if (err instanceof AppDomainError) {
      return { ok: false, messageKey: err.messageKey };
    }
    return { ok: false, messageKey: 'errors.envMisconfigured' };
  }

  try {
    const actor = await verifyAdminActorFromClients({
      authClient,
      serviceClient,
      requireMfaAal2: publicEnv.NEXT_PUBLIC_APP_ENV === 'production',
    });

    await recordVerifiedAdminAuthAudit(serviceClient, {
      actor,
      action: 'admin.login',
      metadata: { portal: 'admin', aal: actor.aal },
      requestHeaders,
    });

    return {
      ok: true,
      redirectTo: sanitizeAdminRedirectPath(input.next, '/'),
    };
  } catch (err) {
    await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);

    if (err instanceof AppDomainError && err.code === 'AUDIT_PERSISTENCE_FAILED') {
      return { ok: false, messageKey: err.messageKey };
    }

    const deniedReasonCode = err instanceof AppDomainError ? err.code : 'ADMIN_REQUIRED';
    await recordVerifiedAdminAuthAudit(serviceClient, {
      actor: null,
      fallbackActorId: signInData.user.id,
      action: 'admin.login_denied',
      metadata: { portal: 'admin', reason_code: deniedReasonCode },
      requestHeaders,
    }).catch(() => undefined);

    if (err instanceof AppDomainError) {
      return {
        ok: false,
        messageKey: err.messageKey,
        redirectTo: err.statusCode === 403 ? '/unauthorized' : undefined,
      };
    }

    return { ok: false, messageKey: 'errors.adminRequired', redirectTo: '/unauthorized' };
  }
}

/**
 * Signs out the active session with CSRF Origin verification and audited logout for active admins.
 */
export async function adminLogoutAction(): Promise<AdminAuthActionResult> {
  const requestHeaders = await headers();

  try {
    await assertValidAdminOrigin(requestHeaders);
  } catch (err) {
    if (err instanceof AppDomainError) {
      return { ok: false, messageKey: err.messageKey };
    }
    return { ok: false, messageKey: 'errors.originForbidden' };
  }

  try {
    const publicEnv = getValidatedAdminPublicEnv();
    const authClient = await createAdminServerClient();
    const serviceClient = createAdminServiceClient();

    try {
      const actor = await verifyAdminActorFromClients({
        authClient,
        serviceClient,
        requireMfaAal2: publicEnv.NEXT_PUBLIC_APP_ENV === 'production',
      });
      await recordVerifiedAdminAuthAudit(serviceClient, {
        actor,
        action: 'admin.logout',
        metadata: { portal: 'admin' },
        requestHeaders,
      });
    } catch (err) {
      if (err instanceof AppDomainError && err.code === 'AUDIT_PERSISTENCE_FAILED') {
        return { ok: false, messageKey: err.messageKey };
      }
      // Non-admin or unverified users clicking sign-out from /unauthorized still clear cookies cleanly
    }

    await authClient.auth.signOut({ scope: 'local' });
  } catch {
    // Fallback ensures stale auth cookies are not left active if logout fails unexpectedly
  }

  return { ok: true, redirectTo: '/login' };
}
