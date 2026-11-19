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
