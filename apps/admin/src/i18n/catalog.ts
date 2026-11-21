import type { AppLocale } from '@shark/shared-types';
import {
  DEFAULT_LOCALE,
  getDirection,
  resolveI18nMessageKey,
  type TextDirection,
} from '@shark/utils';
import ar from './ar.json';
import en from './en.json';

export type AdminTranslationCatalog = typeof ar;

export const adminCatalogs: Record<AppLocale, AdminTranslationCatalog> = {
  ar,
  en,
};

export function getAdminTranslations(locale: AppLocale = DEFAULT_LOCALE): AdminTranslationCatalog {
  return adminCatalogs[locale];
}

export function getAdminDirection(locale: AppLocale = DEFAULT_LOCALE): TextDirection {
  return getDirection(locale);
}

/**
 * Resolves a localized domain error/validation key for the Admin portal,
 * falling back to `errors.unexpected` if the key is unknown.
 */
export function resolveAdminMessage(
  locale: AppLocale = DEFAULT_LOCALE,
  key: string | null | undefined,
  params?: Record<string, string | number>,
): string {
  return resolveI18nMessageKey(adminCatalogs[locale], key, 'errors.unexpected', params);
}
