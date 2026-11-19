import { z } from 'zod';
import { appLocaleSchema } from './common.schema';

export const appEnvironmentSchema = z.enum(['development', 'staging', 'production']);

/**
 * Mobile public client environment schema — NEVER includes service role or server tokens.
 */
export const mobilePublicEnvSchema = z
  .object({
    EXPO_PUBLIC_SUPABASE_URL: z.string().url('validation.env.invalidSupabaseUrl'),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'validation.env.missingAnonKey'),
    EXPO_PUBLIC_APP_ENV: appEnvironmentSchema.default('development'),
    EXPO_PUBLIC_DEFAULT_LOCALE: appLocaleSchema.default('ar'),
    EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
    EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
    EXPO_PUBLIC_POSTHOG_HOST: z.string().url().default('https://eu.i.posthog.com'),
    EXPO_PUBLIC_EAS_PROJECT_ID: z.string().optional(),
  })
  .strict();

/**
 * Admin browser-safe environment schema.
 */
export const adminPublicEnvSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('validation.env.invalidSupabaseUrl'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'validation.env.missingAnonKey'),
    NEXT_PUBLIC_APP_ENV: appEnvironmentSchema.default('development'),
    NEXT_PUBLIC_SITE_URL: z.string().url('validation.env.invalidSiteUrl'),
    NEXT_PUBLIC_DEFAULT_LOCALE: appLocaleSchema.default('ar'),
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  })
  .strict();

/**
 * Admin server-only environment schema (imported exclusively in server-only modules).
 */
export const adminServerEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'validation.env.missingServiceRoleKey'),
    ADMIN_ALLOWED_ORIGINS: z.string().min(1, 'validation.env.missingAllowedOrigins'),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
  })
  .strict();

/**
 * Supabase Edge Functions environment schema.
 */
export const edgeFunctionEnvSchema = z
  .object({
    SUPABASE_URL: z.string().url('validation.env.invalidSupabaseUrl'),
    SUPABASE_ANON_KEY: z.string().min(20, 'validation.env.missingAnonKey'),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'validation.env.missingServiceRoleKey'),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(120).default(120),
    EXPO_ACCESS_TOKEN: z.string().optional(),
    APP_ENV: appEnvironmentSchema.default('development'),
    SENTRY_DSN: z.string().optional(),
  })
  .strict();

const FORBIDDEN_PUBLIC_KEY_FRAGMENTS = [
  'SERVICE_ROLE',
  'DB_URL',
  'POSTGRES_PASSWORD',
  'SENTRY_AUTH_TOKEN',
  'EXPO_ACCESS_TOKEN',
] as const;

export function assertNoPublicSecretKeys(envKeys: readonly string[]): void {
  for (const key of envKeys) {
    if (key.startsWith('EXPO_PUBLIC_') || key.startsWith('NEXT_PUBLIC_')) {
      for (const fragment of FORBIDDEN_PUBLIC_KEY_FRAGMENTS) {
        if (key.toUpperCase().includes(fragment)) {
          throw new Error(`Forbidden secret key exposed with public prefix: ${key}`);
        }
      }
    }
  }
}
