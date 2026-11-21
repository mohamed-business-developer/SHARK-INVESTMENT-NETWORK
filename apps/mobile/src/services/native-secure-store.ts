import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Sentry from '@sentry/react-native';
import {
  createChunkedSecureStorage,
  type SecureKeyValueDriver,
  type SupportedAuthStorage,
} from './secure-storage';

const memoryFallbackStore = new Map<string, string>();

function createWebStorageDriver(): SecureKeyValueDriver {
  return {
    async getItemAsync(key: string): Promise<string | null> {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryFallbackStore.get(key) ?? null;
    },
    async setItemAsync(key: string, value: string): Promise<void> {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      memoryFallbackStore.set(key, value);
    },
    async deleteItemAsync(key: string): Promise<void> {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      memoryFallbackStore.delete(key);
    },
  };
}

function createNativeSecureStoreDriver(): SecureKeyValueDriver {
  if (Platform.OS === 'web') {
    return createWebStorageDriver();
  }
  return {
    getItemAsync: (key: string) => SecureStore.getItemAsync(key),
    setItemAsync: (key: string, value: string) => SecureStore.setItemAsync(key, value),
    deleteItemAsync: (key: string) => SecureStore.deleteItemAsync(key),
  };
}

let cachedAdapter: SupportedAuthStorage | null = null;

/**
 * Returns the platform-safe chunked SecureStore adapter with scrubbed corruption telemetry.
 */
export function getMobileSecureStorage(): SupportedAuthStorage {
  if (!cachedAdapter) {
    cachedAdapter = createChunkedSecureStorage(createNativeSecureStoreDriver(), {
      onCorruption: ({ storageKey, reason }) => {
        Sentry.addBreadcrumb({
          category: 'auth.storage',
          level: 'warning',
          message: `Recovered corrupted auth storage (${reason})`,
          data: { storageKey },
        });
      },
    });
  }
  return cachedAdapter;
}
