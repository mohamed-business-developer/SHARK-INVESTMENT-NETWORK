import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getValidatedAdminPublicEnv } from '../env';

/**
 * Per-request SSR cookie-aware Supabase client bound to caller's verified cookie session.
 */
export async function createAdminServerClient(): Promise<SupabaseClient> {
  const env = getValidatedAdminPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Ignored during read-only Server Component renders where middleware owns cookie writes
        }
      },
    },
  });
}
