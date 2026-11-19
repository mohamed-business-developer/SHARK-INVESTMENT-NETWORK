import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function collectTsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.expo') {
      continue;
    }
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectTsxFiles(fullPath));
    } else if (entry.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Bilingual RTL/LTR & Token Hygiene', () => {
  it('bans physical directional Tailwind utilities in apps/admin TSX files', () => {
    const adminTsxFiles = collectTsxFiles(resolve(REPO_ROOT, 'apps/admin/src'));
    const bannedPattern =
      /(?:^|[\s"'`])(?:ml|mr|pl|pr|left|right|text-left|text-right|rounded-l|rounded-r|border-l|border-r)-[a-z0-9[\]]+/g;

    for (const file of adminTsxFiles) {
      const content = readFileSync(file, 'utf8');
      const matches = content.match(bannedPattern);
      expect(matches, `Banned physical directional Tailwind utility in ${file}`).toBeNull();
    }
  });

  it('bans physical directional style keys and hardcoded hex literals in apps/mobile TSX files', () => {
    const mobileFiles = [
      ...collectTsxFiles(resolve(REPO_ROOT, 'apps/mobile/src')),
      ...collectTsxFiles(resolve(REPO_ROOT, 'apps/mobile/app')),
    ];
    const bannedPhysicalStyle =
      /\b(marginLeft|marginRight|paddingLeft|paddingRight|borderLeftWidth|borderRightWidth|borderLeftColor|borderRightColor)\b/;
    const rawHexPattern = /#[0-9A-Fa-f]{6}\b/;

    for (const file of mobileFiles) {
      const content = readFileSync(file, 'utf8');
      expect(content, `Banned physical style property in ${file}`).not.toMatch(bannedPhysicalStyle);
      expect(content, `Hardcoded hex literal found in ${file}`).not.toMatch(rawHexPattern);
    }
  });
});
