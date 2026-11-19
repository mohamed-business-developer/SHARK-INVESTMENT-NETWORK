import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type JsonRecord = { [key: string]: string | JsonRecord };

function flattenKeys(obj: JsonRecord, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(fullKey);
    } else {
      keys.push(...flattenKeys(value, fullKey));
    }
  }
  return keys.sort();
}

function loadJson(relativePathFromRepoRoot: string): JsonRecord {
  const repoRoot = resolve(import.meta.dirname, '../..');
  const raw = readFileSync(resolve(repoRoot, relativePathFromRepoRoot), 'utf8');
  return JSON.parse(raw) as JsonRecord;
}

describe('i18n translation dictionary parity', () => {
  it('keeps ar.json and en.json keys identical in apps/mobile', () => {
    const ar = loadJson('apps/mobile/src/i18n/ar.json');
    const en = loadJson('apps/mobile/src/i18n/en.json');
    expect(flattenKeys(ar)).toEqual(flattenKeys(en));
  });

  it('keeps ar.json and en.json keys identical in apps/admin', () => {
    const ar = loadJson('apps/admin/src/i18n/ar.json');
    const en = loadJson('apps/admin/src/i18n/en.json');
    expect(flattenKeys(ar)).toEqual(flattenKeys(en));
  });
});
