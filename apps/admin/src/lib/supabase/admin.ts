import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getValidatedAdminServerEnv } from '../env.server';

/**
 * Privileged service-role Supabase client strictly restricted to verified server-only governance paths.
 */
export function createAdminServiceClient(): SupabaseClient {
  const env = getValidatedAdminServerEnv();
  const projectUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  return createClient(projectUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
