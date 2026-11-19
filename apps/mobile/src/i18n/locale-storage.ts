import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AppLocale } from '@shark/shared-types';
import { LOCALE_STORAGE_KEY, parseLocale, type LocaleStorageAdapter } from '@shark/utils';

export const mobileLocaleStorage: LocaleStorageAdapter = {
  async getLocale(): Promise<AppLocale | null> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
        return stored ? parseLocale(stored) : null;
      }
      return null;
    }

    const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY);
    return stored ? parseLocale(stored) : null;
  },

  async setLocale(locale: AppLocale): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      }
      return;
    }

    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, locale);
  },
};
