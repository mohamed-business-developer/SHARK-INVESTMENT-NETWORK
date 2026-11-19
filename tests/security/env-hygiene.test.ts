import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

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
});
