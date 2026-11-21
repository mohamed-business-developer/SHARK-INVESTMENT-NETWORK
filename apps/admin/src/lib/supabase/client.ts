'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidatedAdminPublicEnv } from '../env';

/**
 * Browser-safe Admin Supabase client backed exclusively by the public anon key & SSR cookies.
 * Never imports server secrets (`env.server.ts`).
 */
export function createAdminBrowserClient(): SupabaseClient {
  const env = getValidatedAdminPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
