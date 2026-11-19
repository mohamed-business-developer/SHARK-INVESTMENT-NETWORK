import type { AppLocale } from '@shark/shared-types';
import { DEFAULT_LOCALE, getDirection, type TextDirection } from '@shark/utils';
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
