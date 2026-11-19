'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import type { AppLocale } from '@shark/shared-types';
import {
  DEFAULT_LOCALE,
  getDirection,
  isRtlLocale,
  persistLocale,
  type TextDirection,
} from '@shark/utils';
import {
  adminCatalogs,
  getAdminDirection,
  getAdminTranslations,
  type AdminTranslationCatalog,
} from './catalog';
import { adminBrowserLocaleStorage } from './locale-cookie';

export { getAdminDirection, getAdminTranslations, type AdminTranslationCatalog };

export interface AdminLocaleContextValue {
  readonly locale: AppLocale;
  readonly direction: TextDirection;
  readonly isRtl: boolean;
  readonly t: AdminTranslationCatalog;
  readonly setLocale: (nextLocale: AppLocale) => Promise<void>;
  readonly toggleLocale: () => Promise<void>;
}

const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale = DEFAULT_LOCALE,
  children,
}: {
  readonly initialLocale?: AppLocale;
  readonly children: ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = getDirection(locale);
    }
  }, [locale]);

  const setLocale = useCallback(
    async (nextLocale: AppLocale) => {
      const saved = await persistLocale(adminBrowserLocaleStorage, nextLocale);
      setLocaleState(saved);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = saved;
        document.documentElement.dir = getDirection(saved);
      }
      router.refresh();
    },
    [router],
  );

  const toggleLocale = useCallback(async () => {
    await setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const value = useMemo<AdminLocaleContextValue>(() => {
    return {
      locale,
      direction: getDirection(locale),
      isRtl: isRtlLocale(locale),
      t: adminCatalogs[locale],
      setLocale,
      toggleLocale,
    };
  }, [locale, setLocale, toggleLocale]);

  return <AdminLocaleContext.Provider value={value}>{children}</AdminLocaleContext.Provider>;
}

export function useLocale(): AdminLocaleContextValue {
  const ctx = useContext(AdminLocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return ctx;
}
