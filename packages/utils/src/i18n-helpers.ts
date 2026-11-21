/**
 * Shared Localization Resolution & Language Persistence Abstractions.
 * Arabic ('ar', RTL) is always the default fallback locale.
 */

import type { AppLocale } from '@shark/shared-types';

export const DEFAULT_LOCALE: AppLocale = 'ar';
export const SUPPORTED_LOCALES: readonly AppLocale[] = ['ar', 'en'] as const;
export const LOCALE_STORAGE_KEY = 'shark_locale' as const;

export function parseLocale(value: unknown, fallback: AppLocale = DEFAULT_LOCALE): AppLocale {
  if (value === 'ar' || value === 'en') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized.startsWith('ar')) {
      return 'ar';
    }
    if (normalized.startsWith('en')) {
      return 'en';
    }
  }
  return fallback;
}

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return Object.entries(params).reduce((acc, [key, val]) => {
    return acc.replaceAll(`{{${key}}}`, String(val));
  }, template);
}

export interface LocaleStorageAdapter {
  getLocale: () => Promise<AppLocale | null> | AppLocale | null;
  setLocale: (locale: AppLocale) => Promise<void> | void;
}

export async function resolvePersistedLocale(
  adapter: LocaleStorageAdapter,
  fallback: AppLocale = DEFAULT_LOCALE,
): Promise<AppLocale> {
  try {
    const stored = await adapter.getLocale();
    return parseLocale(stored, fallback);
  } catch {
    return fallback;
  }
}

export async function persistLocale(
  adapter: LocaleStorageAdapter,
  locale: AppLocale,
): Promise<AppLocale> {
  const safeLocale = parseLocale(locale);
  try {
    await adapter.setLocale(safeLocale);
  } catch {
    // Non-fatal storage write failure falls back to in-memory locale state
  }
  return safeLocale;
}

function lookupNestedString(root: unknown, key: string): string | null {
  if (!key || typeof key !== 'string') {
    return null;
  }
  const segments = key.split('.');
  let current: unknown = root;
  for (const segment of segments) {
    if (
      typeof current !== 'object' ||
      current === null ||
      Array.isArray(current) ||
      !Object.prototype.hasOwnProperty.call(current, segment)
    ) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' && current.length > 0 ? current : null;
}

/**
 * Resolves a dot-delimited i18n message key (`errors.*` or `validation.*`) against a locale catalog,
 * safely falling back to `fallbackKey` (`errors.unexpected`) when the key is missing or unsafe.
 */
export function resolveI18nMessageKey(
  catalog: unknown,
  key: string | null | undefined,
  fallbackKey = 'errors.unexpected',
  params?: Record<string, string | number>,
): string {
  const direct = key ? lookupNestedString(catalog, key) : null;
  const resolved = direct ?? lookupNestedString(catalog, fallbackKey) ?? fallbackKey;
  return interpolate(resolved, params);
}
