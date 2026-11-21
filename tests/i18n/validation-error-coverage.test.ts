import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveI18nMessageKey } from '@shark/utils';
import { resolveAdminMessage } from '../../apps/admin/src/i18n/catalog';
import { resolveMobileMessage } from '../../apps/mobile/src/i18n/catalog';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', '.expo', 'dist'].includes(entry.name)) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function extractCodebaseMessageKeys(): string[] {
  const keys = new Set<string>();
  const boundedPrefixes = new Set<string>();

  for (const folder of ['packages', 'supabase/functions', 'apps']) {
    for (const file of collectTsFiles(resolve(REPO_ROOT, folder))) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(/['"`]((?:validation|errors)\.[a-zA-Z0-9_.]+)['"`]/g)) {
        const key = match[1];
        if (key) {
          keys.add(key);
        }
      }
      for (const match of content.matchAll(
        /boundedTextSchema\([^,]+,[^,]+,\s*['"`](validation\.[a-zA-Z0-9_.]+)['"`]/g,
      )) {
        const prefix = match[1];
        if (prefix) {
          boundedPrefixes.add(prefix);
        }
      }
      for (const match of content.matchAll(
        /trimmedText\([^,]+,[^,]+,\s*['"`](validation\.[a-zA-Z0-9_.]+)['"`]/g,
      )) {
        const prefix = match[1];
        if (prefix) {
          boundedPrefixes.add(prefix);
        }
      }
    }
  }

  for (const prefix of boundedPrefixes) {
    keys.delete(prefix);
    keys.add(`${prefix}.tooShort`);
    keys.add(`${prefix}.tooLong`);
  }

  return Array.from(keys).sort();
}

function readCatalog(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(REPO_ROOT, relativePath), 'utf8')) as Record<
    string,
    unknown
  >;
}

describe('Bilingual errors.* & validation.* coverage and safe key lookup (T5-02)', () => {
  const extractedKeys = extractCodebaseMessageKeys();

  const catalogs = [
    { name: 'mobile/ar', data: readCatalog('apps/mobile/src/i18n/ar.json') },
    { name: 'mobile/en', data: readCatalog('apps/mobile/src/i18n/en.json') },
    { name: 'admin/ar', data: readCatalog('apps/admin/src/i18n/ar.json') },
    { name: 'admin/en', data: readCatalog('apps/admin/src/i18n/en.json') },
  ] as const;

  it('extracts every validation.* and errors.* key across packages, Edge Functions, and apps', () => {
    expect(extractedKeys.length).toBeGreaterThanOrEqual(140);
    expect(extractedKeys).toContain('errors.auditWriteFailed');
    expect(extractedKeys).toContain('errors.envMisconfigured');
    expect(extractedKeys).toContain('validation.notification.tooManyRecipients');
    expect(extractedKeys).toContain('validation.env.placeholderValue');

    for (const catalog of catalogs) {
      expect(resolveI18nMessageKey(catalog.data, 'errors.originForbidden')).not.toBe(
        resolveI18nMessageKey(catalog.data, 'errors.unexpected'),
      );
    }
  });

  it('resolves 100% of extracted keys in Mobile and Admin ar/en catalogs without fallback', () => {
    for (const catalog of catalogs) {
      const unexpectedFallback = resolveI18nMessageKey(catalog.data, 'errors.unexpected');
      expect(unexpectedFallback.length).toBeGreaterThan(0);

      for (const key of extractedKeys) {
        const resolved = resolveI18nMessageKey(catalog.data, key);
        expect(resolved, `Missing key ${key} in ${catalog.name}`).toBeTruthy();
        if (key !== 'errors.unexpected') {
          expect(resolved, `Key ${key} unexpectedly hit fallback in ${catalog.name}`).not.toBe(
            unexpectedFallback,
          );
        }
      }
    }
  });

  it('falls back cleanly to errors.unexpected on unknown, null, empty, or prototype keys', () => {
    expect(resolveMobileMessage('ar', 'errors.nonExistentKey')).toBe(
      resolveMobileMessage('ar', 'errors.unexpected'),
    );
    expect(resolveMobileMessage('en', null)).toBe(resolveMobileMessage('en', 'errors.unexpected'));
    expect(resolveAdminMessage('ar', '__proto__.polluted')).toBe(
      resolveAdminMessage('ar', 'errors.unexpected'),
    );
    expect(resolveAdminMessage('en', 'constructor.prototype')).toBe(
      resolveAdminMessage('en', 'errors.unexpected'),
    );
  });

  it('supports template parameter interpolation in shared helper', () => {
    const sampleCatalog = { errors: { custom: 'Retry in {{seconds}}s' }, validation: {} };
    expect(
      resolveI18nMessageKey(sampleCatalog, 'errors.custom', 'errors.unexpected', { seconds: 30 }),
    ).toBe('Retry in 30s');
  });
});
