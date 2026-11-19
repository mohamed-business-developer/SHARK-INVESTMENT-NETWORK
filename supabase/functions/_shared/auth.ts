import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { EdgeFunctionError } from './errors.ts';

export interface LiveActorContext {
  readonly userId: string;
  readonly email: string;
  readonly role: 'investor' | 'founder' | 'member' | 'admin';
  readonly accountStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  readonly adminRole: {
    readonly roleName: string;
    readonly permissions: readonly string[];
  } | null;
}

export function createServiceAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new EdgeFunctionError(500, 'MISCONFIGURED', 'errors.unexpected');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonAuthClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new EdgeFunctionError(500, 'MISCONFIGURED', 'errors.unexpected');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAuthenticatedActor(
  req: Request,
  adminClient: SupabaseClient,
): Promise<LiveActorContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new EdgeFunctionError(401, 'UNAUTHORIZED', 'errors.unauthorized');
  }
  const jwt = authHeader.slice('Bearer '.length).trim();
  if (!jwt) {
    throw new EdgeFunctionError(401, 'UNAUTHORIZED', 'errors.unauthorized');
  }

  const authClient = createAnonAuthClient();
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(jwt);

  if (authError || !user) {
    throw new EdgeFunctionError(401, 'UNAUTHORIZED', 'errors.unauthorized');
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, email, role, account_status, deleted_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile || profile.deleted_at !== null) {
    throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.profileNotFound');
  }

  if (profile.account_status === 'suspended') {
    throw new EdgeFunctionError(403, 'ACCOUNT_SUSPENDED', 'errors.accountSuspended');
  }

  let adminRole: LiveActorContext['adminRole'] = null;
  if (profile.role === 'admin' && profile.account_status === 'approved') {
    const { data: roleRow } = await adminClient
      .from('admin_roles')
      .select('role_name, permissions, is_active, deleted_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (roleRow) {
      adminRole = {
        roleName: roleRow.role_name as string,
        permissions: (roleRow.permissions as string[]) ?? [],
      };
    }
  }

  return {
    userId: profile.id as string,
    email: profile.email as string,
    role: profile.role as LiveActorContext['role'],
    accountStatus: profile.account_status as LiveActorContext['accountStatus'],
    adminRole,
  };
}

export function assertActiveAdminScope(actor: LiveActorContext, requiredScope: string): void {
  if (actor.role !== 'admin' || actor.accountStatus !== 'approved' || !actor.adminRole) {
    throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.adminRequired');
  }

  const hasScope =
    actor.adminRole.roleName === 'super_admin' ||
    actor.adminRole.permissions.includes(requiredScope);

  if (!hasScope) {
    throw new EdgeFunctionError(403, 'FORBIDDEN', 'errors.insufficientAdminScope');
  }
}
