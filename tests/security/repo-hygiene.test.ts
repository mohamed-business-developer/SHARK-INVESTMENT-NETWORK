import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function collectTsFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.expo', 'dist'].includes(entry.name)) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('P5-U04 Repository, Service & Hook Security Hygiene', () => {
  const mobileRepoFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/mobile/src/repositories'));
  const mobileHookFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/mobile/src/hooks'));
  const adminRepoFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/admin/src/repositories'));
  const adminActionFiles = collectTsFiles(resolve(REPO_ROOT, 'apps/admin/src/actions'));

  it('forbids unbounded .select(*) across all Mobile & Admin repositories', () => {
    expect(mobileRepoFiles.length).toBeGreaterThanOrEqual(3);

    for (const file of [...mobileRepoFiles, ...adminRepoFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden .select('*') in ${file}`).not.toMatch(/\.select\(\s*['"]\*['"]/);
    }
  });

  it('prevents Mobile from referencing internal_notes, server-only Admin clients, service role keys, or private bucket getPublicUrl()', () => {
    for (const file of [...mobileRepoFiles, ...mobileHookFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden internal_notes reference in ${file}`).not.toContain(
        'internal_notes',
      );
      expect(content, `Forbidden SUPABASE_SERVICE_ROLE_KEY reference in ${file}`).not.toContain(
        'SUPABASE_SERVICE_ROLE_KEY',
      );
      expect(content, `Forbidden admin client import in ${file}`).not.toMatch(
        /lib\/supabase\/admin/,
      );
      expect(content, `Forbidden private bucket getPublicUrl() call in ${file}`).not.toMatch(
        /from\(\s*['"](?:pitch-documents|verification-documents)['"]\s*\)\.getPublicUrl/,
      );
    }
  });

  it('keeps public discovery & search hooks strictly free of pitches and private raw tables', () => {
    for (const hookFile of [
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/useDiscovery.ts'),
      resolve(REPO_ROOT, 'apps/mobile/src/hooks/useSearch.ts'),
      resolve(REPO_ROOT, 'apps/mobile/src/repositories/directory.repository.ts'),
    ]) {
      const content = readFileSync(hookFile, 'utf8');
      expect(content, `Discovery/search file ${hookFile} must not query pitches`).not.toMatch(
        /\.from\(\s*['"](?:pitches|pitch_documents|verification_requests|profiles|activity_logs)['"]\s*\)/,
      );
    }
  });

  it('keeps Admin server boundaries and Origin/AdminContext guards intact', () => {
    for (const serverFile of [
      'apps/admin/src/lib/supabase/admin.ts',
      'apps/admin/src/lib/env.server.ts',
      'apps/admin/src/lib/auth/guards.ts',
      'apps/admin/src/lib/auth/audit.ts',
    ]) {
      const content = readFileSync(resolve(REPO_ROOT, serverFile), 'utf8');
      expect(content, `${serverFile} missing 'server-only'`).toMatch(/import ['"]server-only['"];/);
    }

    for (const file of [...adminRepoFiles, ...adminActionFiles]) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Forbidden getSession() in ${file}`).not.toMatch(/\bgetSession\s*\(/);
    }
  });
});
