import type { AppLocale } from '@shark/shared-types';
import { LOCALE_STORAGE_KEY, parseLocale, type LocaleStorageAdapter } from '@shark/utils';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readCookieLocale(): AppLocale | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LOCALE_STORAGE_KEY}=`));
  if (!match) {
    return null;
  }
  const rawValue = match.slice(LOCALE_STORAGE_KEY.length + 1);
  return parseLocale(decodeURIComponent(rawValue));
}

export function writeCookieLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(locale)}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export const adminBrowserLocaleStorage: LocaleStorageAdapter = {
  getLocale: () => readCookieLocale(),
  setLocale: (locale) => {
    writeCookieLocale(locale);
  },
};
