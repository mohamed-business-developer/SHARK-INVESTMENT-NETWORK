import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { I18nManager, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import type { AppLocale } from '@shark/shared-types';
import {
  getDirection,
  isRtlLocale,
  persistLocale,
  resolvePersistedLocale,
  type TextDirection,
} from '@shark/utils';
import { mobileEnv } from '@/services/env';
import {
  getMobileDirection,
  getMobileTranslations,
  mobileCatalogs,
  type MobileTranslationCatalog,
} from './catalog';
import { mobileLocaleStorage } from './locale-storage';

export interface LocaleContextValue {
  readonly locale: AppLocale;
  readonly direction: TextDirection;
  readonly isRtl: boolean;
  readonly isReady: boolean;
  readonly nativeReloadPending: boolean;
  readonly t: MobileTranslationCatalog;
  readonly setLocale: (
    nextLocale: AppLocale,
    options?: { reloadNative?: boolean },
  ) => Promise<void>;
  readonly toggleLocale: () => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export { getMobileDirection, getMobileTranslations, type MobileTranslationCatalog };

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const fallbackLocale = mobileEnv.EXPO_PUBLIC_DEFAULT_LOCALE;
  const [locale, setLocaleState] = useState<AppLocale>(fallbackLocale);
  const [isReady, setIsReady] = useState(false);
  const [nativeReloadPending, setNativeReloadPending] = useState(false);

  const syncNativeRtlFlag = useCallback((targetLocale: AppLocale) => {
    const shouldBeRtl = isRtlLocale(targetLocale);
    I18nManager.allowRTL(true);
    if (Platform.OS !== 'web' && I18nManager.isRTL !== shouldBeRtl) {
      I18nManager.forceRTL(shouldBeRtl);
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let active = true;
    resolvePersistedLocale(mobileLocaleStorage, fallbackLocale)
      .then((initialLocale) => {
        if (!active) {
          return;
        }
        setLocaleState(initialLocale);
        const changedNative = syncNativeRtlFlag(initialLocale);
        setNativeReloadPending(changedNative);
      })
      .finally(() => {
        if (active) {
          setIsReady(true);
        }
      });

    return () => {
      active = false;
    };
  }, [fallbackLocale, syncNativeRtlFlag]);

  const setLocale = useCallback(
    async (nextLocale: AppLocale, options?: { reloadNative?: boolean }) => {
      const saved = await persistLocale(mobileLocaleStorage, nextLocale);
      setLocaleState(saved);

      const changedNative = syncNativeRtlFlag(saved);
      setNativeReloadPending(changedNative);

      if (changedNative && options?.reloadNative !== false && Platform.OS !== 'web') {
        try {
          if (Updates.isEnabled) {
            await Updates.reloadAsync();
          }
        } catch {
          // In Expo Go / local dev client without EAS Updates enabled, nativeReloadPending alerts UI safely.
        }
      }
    },
    [syncNativeRtlFlag],
  );

  const toggleLocale = useCallback(async () => {
    await setLocale(locale === 'ar' ? 'en' : 'ar');
  }, [locale, setLocale]);

  const value = useMemo<LocaleContextValue>(() => {
    return {
      locale,
      direction: getDirection(locale),
      isRtl: isRtlLocale(locale),
      isReady,
      nativeReloadPending,
      t: mobileCatalogs[locale],
      setLocale,
      toggleLocale,
    };
  }, [isReady, locale, nativeReloadPending, setLocale, toggleLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used inside LocaleProvider');
  }
  return ctx;
}
