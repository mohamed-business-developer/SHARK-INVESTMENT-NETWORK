import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StrictMobilePublicEnv } from '@shark/validation';
import { getValidatedMobileSupabaseEnv } from './env';
import { getMobileSecureStorage } from './native-secure-store';
import type { SupportedAuthStorage } from './secure-storage';

let cachedMobileClient: SupabaseClient | null = null;

/**
 * Instantiates a typed anon-key Mobile Supabase client using PKCE and chunked SecureStore persistence.
 */
export function createMobileSupabaseClient(
  env: Pick<StrictMobilePublicEnv, 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'>,
  storage: SupportedAuthStorage,
): SupabaseClient {
  return createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

/**
 * Lazily returns the validated Mobile Supabase client, failing closed when env configuration is missing/invalid.
 */
export function getMobileSupabaseClient(): SupabaseClient {
  if (!cachedMobileClient) {
    const env = getValidatedMobileSupabaseEnv();
    cachedMobileClient = createMobileSupabaseClient(env, getMobileSecureStorage());
  }
  return cachedMobileClient;
}

/**
 * Returns the configured Supabase client when public env vars are present, or null during offline UI preview.
 */
export function tryGetMobileSupabaseClient(): SupabaseClient | null {
  if (cachedMobileClient) {
    return cachedMobileClient;
  }
  try {
    return getMobileSupabaseClient();
  } catch {
    return null;
  }
}
