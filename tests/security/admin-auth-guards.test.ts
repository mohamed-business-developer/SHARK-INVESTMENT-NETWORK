import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppDomainError } from '@shark/utils';
import {
  isPublicAdminPath,
  resolveAdminMiddlewareDecision,
  sanitizeAdminRedirectPath,
  validateAdminOriginHeaders,
} from '../../apps/admin/src/lib/auth/origin-and-middleware';
import {
  assertNotActingOnSelf,
  verifyAdminActorFromClients,
} from '../../apps/admin/src/lib/auth/verify-admin-actor';

type AdminSupabaseClient = Parameters<typeof verifyAdminActorFromClients>[0]['authClient'];

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const ACTOR_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const TARGET_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

function createMockAdminClients(config: {
  userId?: string | null;
  authError?: boolean;
  aal?: { currentLevel: string; nextLevel: string } | null;
  profile?: Record<string, unknown> | null;
  adminRole?: Record<string, unknown> | null;
}) {
  const authClient = {
    auth: {
      getUser: async () =>
        config.authError || !config.userId
          ? { data: { user: null }, error: { message: 'Invalid JWT' } }
          : { data: { user: { id: config.userId } }, error: null },
      mfa: config.aal
        ? {
            getAuthenticatorAssuranceLevel: async () => ({
              data: config.aal,
              error: null,
            }),
          }
        : undefined,
    },
  } as unknown as AdminSupabaseClient;

  const serviceClient = {
    from: (table: string) => ({
      select: () => ({
        eq: () => {
          const query = {
            eq: () => query,
            is: () => query,
            maybeSingle: async () => ({
              data: table === 'profiles' ? (config.profile ?? null) : (config.adminRole ?? null),
              error: null,
            }),
          };
          return query;
        },
      }),
    }),
  } as unknown as AdminSupabaseClient;

  return { authClient, serviceClient };
}

function walkAdminTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next'].includes(entry.name)) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkAdminTsFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

describe('Admin Triple-Gate, CSRF/Origin validation & client/server isolation (T5-07 / T5-08)', () => {
  it('rejects unauthenticated, pending, suspended, non-admin, MFA-incomplete, and revoked admin callers', async () => {
    const unauth = createMockAdminClients({ userId: null, authError: true });
    await expect(verifyAdminActorFromClients(unauth)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });

    const incompleteMfa = createMockAdminClients({
      userId: ACTOR_ID,
      aal: { currentLevel: 'aal1', nextLevel: 'aal2' },
      profile: { id: ACTOR_ID, role: 'admin', account_status: 'approved', deleted_at: null },
      adminRole: { role_name: 'super_admin', permissions: [], is_active: true, deleted_at: null },
    });
    await expect(verifyAdminActorFromClients(incompleteMfa)).rejects.toMatchObject({
      code: 'MFA_REQUIRED',
      statusCode: 403,
    });

    const suspendedAdmin = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'admin@shark.test',
        role: 'admin',
        account_status: 'suspended',
        deleted_at: null,
      },
      adminRole: { role_name: 'super_admin', permissions: [], is_active: true, deleted_at: null },
    });
    await expect(verifyAdminActorFromClients(suspendedAdmin)).rejects.toMatchObject({
      code: 'ACCOUNT_SUSPENDED',
      messageKey: 'errors.accountSuspended',
      statusCode: 403,
    });

    const approvedInvestor = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'inv@shark.test',
        role: 'investor',
        account_status: 'approved',
        deleted_at: null,
      },
      adminRole: null,
    });
    await expect(verifyAdminActorFromClients(approvedInvestor)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      messageKey: 'errors.adminRequired',
      statusCode: 403,
    });

    const pendingAdmin = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'pending-admin@shark.test',
        role: 'admin',
        account_status: 'pending',
        deleted_at: null,
      },
      adminRole: {
        role_name: 'operations_admin',
        permissions: ['users:read'],
        is_active: true,
        deleted_at: null,
      },
    });
    await expect(verifyAdminActorFromClients(pendingAdmin)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      messageKey: 'errors.adminRequired',
      statusCode: 403,
    });

    const inactiveRoleAdmin = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'revoked@shark.test',
        role: 'admin',
        account_status: 'approved',
        deleted_at: null,
      },
      adminRole: null,
    });
    await expect(verifyAdminActorFromClients(inactiveRoleAdmin)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      messageKey: 'errors.adminRequired',
      statusCode: 403,
    });
  });

  it('enforces granular permission scopes, allows super_admin, and blocks self-targeting actions', async () => {
    const analystClients = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'analyst@shark.test',
        full_name: 'Analyst',
        preferred_language: 'ar',
        role: 'admin',
        account_status: 'approved',
        deleted_at: null,
      },
      adminRole: {
        role_name: 'analyst_readonly',
        permissions: ['analytics:read', 'audit:read'],
        is_active: true,
        deleted_at: null,
      },
    });

    await expect(
      verifyAdminActorFromClients({ ...analystClients, requiredScope: 'users:suspend' }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      messageKey: 'errors.insufficientAdminScope',
      statusCode: 403,
    });

    const allowedAnalyst = await verifyAdminActorFromClients({
      ...analystClients,
      requiredScope: 'audit:read',
    });
    expect(allowedAnalyst.roleName).toBe('analyst_readonly');

    const superAdminClients = createMockAdminClients({
      userId: ACTOR_ID,
      profile: {
        id: ACTOR_ID,
        email: 'super@shark.test',
        full_name: 'Super Admin',
        preferred_language: 'en',
        role: 'admin',
        account_status: 'approved',
        deleted_at: null,
      },
      adminRole: {
        role_name: 'super_admin',
        permissions: [],
        is_active: true,
        deleted_at: null,
      },
    });
    const superCtx = await verifyAdminActorFromClients({
      ...superAdminClients,
      requiredScope: 'roles:manage',
    });
    expect(superCtx.roleName).toBe('super_admin');

    expect(() => assertNotActingOnSelf(ACTOR_ID, ACTOR_ID)).toThrow(AppDomainError);
    expect(() => assertNotActingOnSelf(ACTOR_ID, TARGET_ID)).not.toThrow();
  });

  it('rejects cross-origin, null-origin, and missing Origin/Referer requests fail-closed (CSRF)', () => {
    const allowlist = ['https://admin.shark.network', 'http://localhost:3000'];

    expect(
      validateAdminOriginHeaders(new Headers({ origin: 'HTTPS://Admin.SHARK.network' }), allowlist),
    ).toBe('https://admin.shark.network');

    expect(
      validateAdminOriginHeaders(
        new Headers({ referer: 'http://localhost:3000/login' }),
        allowlist,
      ),
    ).toBe('http://localhost:3000');

    const badHeaders = [
      new Headers(),
      new Headers({ origin: 'null' }),
      new Headers({ origin: 'https://evil.example' }),
      new Headers({ origin: 'http://localhost:3000.evil.com' }),
      new Headers({ referer: 'https://attacker.test/csrf.html' }),
    ];

    for (const hdrs of badHeaders) {
      expect(() => validateAdminOriginHeaders(hdrs, allowlist)).toThrow(AppDomainError);
    }
  });

  it('enforces Admin middleware protection and blocks open-redirect next parameters', () => {
    expect(isPublicAdminPath('/login', 'production')).toBe(true);
    expect(isPublicAdminPath('/unauthorized', 'production')).toBe(true);
    expect(isPublicAdminPath('/design-system', 'development')).toBe(true);
    expect(isPublicAdminPath('/design-system', 'production')).toBe(false);
    expect(isPublicAdminPath('/', 'production')).toBe(false);

    expect(
      resolveAdminMiddlewareDecision({
        pathname: '/users',
        search: '?status=pending',
        hasVerifiedUser: false,
      }),
    ).toEqual({
      action: 'redirect_login',
      redirectTarget: '/login?next=%2Fusers%3Fstatus%3Dpending',
    });

    expect(sanitizeAdminRedirectPath('https://evil.example')).toBe('/');
    expect(sanitizeAdminRedirectPath('//evil.example/admin')).toBe('/');
    expect(sanitizeAdminRedirectPath('/login?next=/users')).toBe('/');
    expect(sanitizeAdminRedirectPath('/users?page=2')).toBe('/users?page=2');
  });

  it('maintains server-only boundaries, bans getSession(), and isolates service-role keys from client code', () => {
    for (const serverFile of [
      'apps/admin/src/lib/env.server.ts',
      'apps/admin/src/lib/supabase/server.ts',
      'apps/admin/src/lib/supabase/admin.ts',
      'apps/admin/src/lib/auth/guards.ts',
    ]) {
      const content = readFileSync(resolve(REPO_ROOT, serverFile), 'utf8');
      expect(content, `${serverFile} must enforce import 'server-only'`).toMatch(
        /import ['"]server-only['"];/,
      );
    }

    const adminFiles = walkAdminTsFiles(resolve(REPO_ROOT, 'apps/admin'));
    for (const file of adminFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Prohibited getSession() call in ${file}`).not.toMatch(/\bgetSession\s*\(/);
      if (content.startsWith("'use client'") || content.startsWith('"use client"')) {
        expect(content, `Server secret import inside client component ${file}`).not.toMatch(
          /from\s+['"][^'"]*(?:env\.server|supabase\/admin|supabase\/server|auth\/guards)['"]/,
        );
        expect(content, `Service key leak inside client component ${file}`).not.toContain(
          'SUPABASE_SERVICE_ROLE_KEY',
        );
      }
    }
  });
});
