import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppDomainError } from '@shark/utils';
import { getValidatedAdminPublicEnv } from '../../apps/admin/src/lib/env';
import { getValidatedAdminServerEnv } from '../../apps/admin/src/lib/env.server';
import { getValidatedMobileSupabaseEnv } from '../../apps/mobile/src/services/env';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const VALID_ANON_JWT_SHAPE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_anon_payload_123456';
const VALID_SERVICE_JWT_SHAPE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test_service_payload_654321';

function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.expo' || entry === '.next') {
      continue;
    }
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectFiles(fullPath));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Environment & client secret hygiene', () => {
  it('never exposes SUPABASE_SERVICE_ROLE_KEY in apps/mobile source or env template', () => {
    const mobileEnvExample = readFileSync(resolve(REPO_ROOT, 'apps/mobile/.env.example'), 'utf8');
    expect(mobileEnvExample).not.toMatch(/SERVICE_ROLE/i);

    const mobileFiles = collectFiles(resolve(REPO_ROOT, 'apps/mobile'));
    for (const file of mobileFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden reference in ${file}`).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('never prefixes server secrets with NEXT_PUBLIC_ in apps/admin/.env.example', () => {
    const adminEnvExample = readFileSync(resolve(REPO_ROOT, 'apps/admin/.env.example'), 'utf8');
    expect(adminEnvExample).not.toMatch(/NEXT_PUBLIC_.*SERVICE_ROLE/);
    expect(adminEnvExample).not.toMatch(/NEXT_PUBLIC_.*SENTRY_AUTH_TOKEN/);
  });

  it('enforces server-only boundary on apps/admin/src/lib/env.server.ts', () => {
    const serverEnvSource = readFileSync(
      resolve(REPO_ROOT, 'apps/admin/src/lib/env.server.ts'),
      'utf8',
    );
    expect(serverEnvSource).toMatch(/import ['"]server-only['"];/);
  });

  it('lazily rejects missing, placeholder, and non-HTTPS production mobile env fail-closed', () => {
    expect(() =>
      getValidatedMobileSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: '',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
      }),
    ).toThrow(AppDomainError);

    expect(() =>
      getValidatedMobileSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://your-project-ref.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
      }),
    ).toThrow(/validation\.env\.placeholderValue/);

    expect(() =>
      getValidatedMobileSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
        EXPO_PUBLIC_APP_ENV: 'production',
      }),
    ).toThrow(/validation\.env\.httpsRequired/);

    const localValid = getValidatedMobileSupabaseEnv({
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
      EXPO_PUBLIC_APP_ENV: 'development',
    });
    expect(localValid.EXPO_PUBLIC_SUPABASE_URL).toBe('http://127.0.0.1:54321');
    expect(localValid.EXPO_PUBLIC_DEFAULT_LOCALE).toBe('ar');
  });

  it('lazily rejects CI placeholders and enforces server-only secret separation in Admin', () => {
    expect(() =>
      getValidatedAdminPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'ci-placeholder-anon-key',
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      }),
    ).toThrow(/validation\.env\.placeholderValue/);

    expect(() =>
      getValidatedAdminServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
        SUPABASE_SERVICE_ROLE_KEY: VALID_ANON_JWT_SHAPE,
        ADMIN_ALLOWED_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrow(/validation\.env\.serviceKeyMatchesAnonKey/);

    expect(() =>
      getValidatedAdminServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
        SUPABASE_SERVICE_ROLE_KEY: VALID_SERVICE_JWT_SHAPE,
        ADMIN_ALLOWED_ORIGINS: '*',
      }),
    ).toThrow(/validation\.env\.missingAllowedOrigins/);

    expect(() =>
      getValidatedAdminServerEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
        NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: VALID_SERVICE_JWT_SHAPE,
        SUPABASE_SERVICE_ROLE_KEY: VALID_SERVICE_JWT_SHAPE,
        ADMIN_ALLOWED_ORIGINS: 'http://localhost:3000',
      }),
    ).toThrow(AppDomainError);

    const serverValid = getValidatedAdminServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: VALID_ANON_JWT_SHAPE,
      NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
      NEXT_PUBLIC_APP_ENV: 'development',
      SUPABASE_SERVICE_ROLE_KEY: VALID_SERVICE_JWT_SHAPE,
      ADMIN_ALLOWED_ORIGINS: 'http://localhost:3000, http://127.0.0.1:3000/admin',
    });
    expect(serverValid.allowedOrigins).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
  });

  it('keeps @shark/validation client entrypoint free of server secret env schema keys', () => {
    for (const relPath of [
      'packages/validation/src/index.ts',
      'packages/validation/src/env.schema.ts',
    ]) {
      const content = readFileSync(resolve(REPO_ROOT, relPath), 'utf8');
      for (const secretName of [
        'SUPABASE_SERVICE_ROLE_KEY',
        'ADMIN_ALLOWED_ORIGINS',
        'EXPO_ACCESS_TOKEN',
        'SENTRY_AUTH_TOKEN',
        'INTERNAL_EDGE_SECRET',
      ]) {
        expect(
          content,
          `Server secret identifier ${secretName} leaked into client barrel ${relPath}`,
        ).not.toContain(secretName);
      }
    }
  });
});
