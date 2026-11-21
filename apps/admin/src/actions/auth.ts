'use server';

import { AppDomainError } from '@shark/utils';
import { loginSchema } from '@shark/validation';
import { assertValidAdminOrigin, verifyAdminActorFromClients } from '@/lib/auth/guards';
import { sanitizeAdminRedirectPath } from '@/lib/auth/origin-and-middleware';
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
 * Triple-Gate live role verification, and immutable `activity_logs` recording.
 */
export async function adminLoginAction(input: AdminLoginInput): Promise<AdminAuthActionResult> {
  try {
    await assertValidAdminOrigin();
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

  let authClient: Awaited<ReturnType<typeof createAdminServerClient>>;
  let serviceClient: ReturnType<typeof createAdminServiceClient>;

  try {
    authClient = await createAdminServerClient();
    serviceClient = createAdminServiceClient();
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

  try {
    const actor = await verifyAdminActorFromClients({
      authClient,
      serviceClient,
    });

    const { error: auditError } = await serviceClient.from('activity_logs').insert({
      actor_id: actor.userId,
      actor_role: 'admin',
      actor_admin_role: actor.roleName,
      action: 'admin.login',
      entity_type: 'auth_session',
      entity_id: actor.userId,
      metadata: { portal: 'admin' },
    });

    if (auditError) {
      await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);
      return { ok: false, messageKey: 'errors.auditWriteFailed' };
    }

    return {
      ok: true,
      redirectTo: sanitizeAdminRedirectPath(input.next, '/'),
    };
  } catch (err) {
    await authClient.auth.signOut({ scope: 'local' }).catch(() => undefined);

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
 * Signs out the active Admin session with CSRF Origin verification.
 */
export async function adminLogoutAction(): Promise<AdminAuthActionResult> {
  try {
    await assertValidAdminOrigin();
  } catch (err) {
    if (err instanceof AppDomainError) {
      return { ok: false, messageKey: err.messageKey };
    }
    return { ok: false, messageKey: 'errors.originForbidden' };
  }

  try {
    const authClient = await createAdminServerClient();
    await authClient.auth.signOut({ scope: 'local' });
  } catch {
    // Best-effort local signOut returns cleanly to login
  }

  return { ok: true, redirectTo: '/login' };
}
