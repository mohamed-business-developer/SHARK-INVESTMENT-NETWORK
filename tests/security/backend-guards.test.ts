import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyMagicBytes } from '../../supabase/functions/_shared/magic-bytes';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MIGRATIONS_DIR = resolve(REPO_ROOT, 'supabase/migrations');
const FUNCTIONS_DIR = resolve(REPO_ROOT, 'supabase/functions');

const CANONICAL_PUBLIC_TABLES = [
  'profiles',
  'investors',
  'founders',
  'sectors',
  'companies',
  'company_members',
  'pitches',
  'pitch_documents',
  'pitch_reviews',
  'pitch_access_grants',
  'investment_interests',
  'portfolio_companies',
  'saved_items',
  'notifications',
  'device_tokens',
  'verification_requests',
  'admin_roles',
  'activity_logs',
  'system_settings',
  'support_requests',
] as const;

function readAllMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  return files.map((file) => readFileSync(join(MIGRATIONS_DIR, file), 'utf8')).join('\n');
}

describe('Phase 4 database, RLS, storage, and edge security guards', () => {
  const migrationsSql = readAllMigrations();

  it('enforces ENABLE and FORCE ROW LEVEL SECURITY on all 20 canonical public tables', () => {
    for (const table of CANONICAL_PUBLIC_TABLES) {
      expect(migrationsSql, `Missing ENABLE RLS on ${table}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`),
      );
      expect(migrationsSql, `Missing FORCE RLS on ${table}`).toMatch(
        new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY;`),
      );
    }
  });

  it('retains mandatory security triggers, non-PII public views, and internal_notes column revocation', () => {
    const requiredFunctions = [
      'handle_new_user',
      'guard_profile_sensitive_columns',
      'guard_company_integrity',
      'guard_pitch_integrity',
      'guard_admin_roles_integrity',
      'prevent_activity_logs_mutation',
      'try_parse_uuid',
      'admin_execute_user_action',
      'admin_execute_entity_review',
    ];
    for (const fn of requiredFunctions) {
      expect(migrationsSql, `Missing SQL function ${fn}`).toContain(fn);
    }

    expect(migrationsSql).toContain(
      'REVOKE SELECT ON TABLE public.verification_requests FROM PUBLIC, anon, authenticated;',
    );
    expect(migrationsSql).toContain('REVOKE ALL ON TABLE');
    expect(migrationsSql).not.toMatch(
      /GRANT SELECT \([\s\S]*?internal_notes[\s\S]*?\) ON public\.verification_requests/,
    );
    expect(migrationsSql).toContain('CREATE OR REPLACE VIEW public.public_investors_directory');
    expect(migrationsSql).toContain('CREATE OR REPLACE VIEW public.public_companies_directory');
    expect(migrationsSql).not.toMatch(/firebase/i);
  });

  it('keeps confidential storage buckets strictly private with zero client SELECT policies', () => {
    const storageMigration = readFileSync(
      join(MIGRATIONS_DIR, '0008_storage_buckets_and_policies.sql'),
      'utf8',
    );
    const configToml = readFileSync(resolve(REPO_ROOT, 'supabase/config.toml'), 'utf8');

    expect(storageMigration).toMatch(
      /'pitch-documents',\s*\r?\n\s*'pitch-documents',\s*\r?\n\s*false/,
    );
    expect(storageMigration).toMatch(
      /'verification-documents',\s*\r?\n\s*'verification-documents',\s*\r?\n\s*false/,
    );

    const policyBlocks = storageMigration.split(/CREATE POLICY /i).slice(1);
    for (const block of policyBlocks) {
      if (block.includes('pitch-documents') || block.includes('verification-documents')) {
        expect(block, `Unexpected SELECT policy on private bucket: ${block}`).not.toMatch(
          /\bFOR SELECT\b/i,
        );
      }
    }

    expect(configToml).toMatch(/\[storage\.buckets\.pitch-documents\][\s\S]*?public = false/);
    expect(configToml).toMatch(
      /\[storage\.buckets\.verification-documents\][\s\S]*?public = false/,
    );
  });

  it('verifies security controls across all 5 Edge Functions', () => {
    const expectedFunctions = [
      'get-signed-document-url',
      'admin-user-action',
      'admin-review-entity',
      'send-push-notification',
      'delete-own-account',
    ];

    const sharedErrors = readFileSync(join(FUNCTIONS_DIR, '_shared/errors.ts'), 'utf8');
    const sharedAuth = readFileSync(join(FUNCTIONS_DIR, '_shared/auth.ts'), 'utf8');
    const sharedCors = readFileSync(join(FUNCTIONS_DIR, '_shared/cors.ts'), 'utf8');

    expect(sharedErrors).toContain("'Cache-Control': 'no-store'");
    expect(sharedAuth).toContain('authClient.auth.getUser(jwt)');
    expect(sharedCors).not.toContain("'Access-Control-Allow-Origin': '*'");

    for (const fnName of expectedFunctions) {
      const source = readFileSync(join(FUNCTIONS_DIR, fnName, 'index.ts'), 'utf8');
      expect(source, `${fnName} missing OPTIONS CORS handler`).toContain(
        "req.method === 'OPTIONS'",
      );
      expect(source, `${fnName} missing enforceRateLimit`).toContain('enforceRateLimit(');
      expect(source, `${fnName} missing handleEdgeError`).toContain('handleEdgeError(');
      expect(source).not.toMatch(/firebase/i);
    }

    const signedUrlSource = readFileSync(
      join(FUNCTIONS_DIR, 'get-signed-document-url/index.ts'),
      'utf8',
    );
    expect(signedUrlSource).toContain('const ttlSeconds = 60');
    expect(signedUrlSource).toContain('Math.min');

    const reviewEntitySource = readFileSync(
      join(FUNCTIONS_DIR, 'admin-review-entity/index.ts'),
      'utf8',
    );
    const pushSource = readFileSync(join(FUNCTIONS_DIR, 'send-push-notification/index.ts'), 'utf8');
    expect(reviewEntitySource).not.toContain("'company_verification'");
    expect(pushSource).not.toContain("'company_verification'");
    expect(pushSource).not.toMatch(/from\('device_tokens'\)[^;]*deleted_at/);

    expect(migrationsSql).toContain("is_active_admin('roles:manage')");
    expect(migrationsSql).toContain("is_active_admin('companies:verify')");
    expect(migrationsSql).toContain("pd.scan_status <> 'quarantined'");
    expect(migrationsSql).toContain('Admins cannot moderate their own pitch document');
  });

  it('validates uploaded file magic bytes and rejects spoofed SVG/script/executable payloads', () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const svgSpoof = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const exeSpoof = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

    expect(verifyMagicBytes(pdfBytes, 'application/pdf')).toBe(true);
    expect(verifyMagicBytes(pngBytes, 'image/png')).toBe(true);
    expect(verifyMagicBytes(jpegBytes, 'image/jpeg')).toBe(true);
    expect(
      verifyMagicBytes(
        zipBytes,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ),
    ).toBe(true);

    expect(verifyMagicBytes(svgSpoof, 'image/png')).toBe(false);
    expect(verifyMagicBytes(exeSpoof, 'application/pdf')).toBe(false);
    expect(verifyMagicBytes(pngBytes, 'application/pdf')).toBe(false);
  });
});
