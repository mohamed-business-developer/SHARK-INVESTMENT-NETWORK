import type { AppLocale } from '@shark/shared-types';
import {
  DEFAULT_LOCALE,
  getDirection,
  resolveI18nMessageKey,
  type TextDirection,
} from '@shark/utils';
import ar from './ar.json';
import en from './en.json';

export type MobileTranslationCatalog = typeof ar;

export const mobileCatalogs: Record<AppLocale, MobileTranslationCatalog> = {
  ar,
  en,
};

export function getMobileTranslations(
  locale: AppLocale = DEFAULT_LOCALE,
): MobileTranslationCatalog {
  return mobileCatalogs[locale];
}

export function getMobileDirection(locale: AppLocale = DEFAULT_LOCALE): TextDirection {
  return getDirection(locale);
}

/**
 * Resolves a localized domain error/validation key for the Mobile app,
 * falling back to `errors.unexpected` if the key is unknown.
 */
export function resolveMobileMessage(
  locale: AppLocale = DEFAULT_LOCALE,
  key: string | null | undefined,
  params?: Record<string, string | number>,
): string {
  return resolveI18nMessageKey(mobileCatalogs[locale], key, 'errors.unexpected', params);
}
