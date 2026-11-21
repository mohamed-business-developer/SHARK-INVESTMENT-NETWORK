import { z } from 'zod';
import { AppDomainError } from '@shark/utils';
import {
  appLocaleSchema,
  emptyEnvToUndefined,
  strictMobilePublicEnvSchema,
  type StrictMobilePublicEnv,
} from '@shark/validation';

const mobileEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  EXPO_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  EXPO_PUBLIC_DEFAULT_LOCALE: appLocaleSchema.default('ar'),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
  EXPO_PUBLIC_POSTHOG_API_KEY: z.string().optional(),
  EXPO_PUBLIC_POSTHOG_HOST: z.string().default('https://eu.i.posthog.com'),
  EXPO_PUBLIC_EAS_PROJECT_ID: z.string().optional(),
});

export type MobileEnv = z.infer<typeof mobileEnvSchema>;
export type RawMobilePublicEnvInput = Record<string, string | undefined>;

/**
 * Accesses EXPO_PUBLIC_* statically so Metro inline replacement works at bundle time.
 */
function readStaticMobileEnv(): RawMobilePublicEnvInput {
  return {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
    EXPO_PUBLIC_DEFAULT_LOCALE: process.env.EXPO_PUBLIC_DEFAULT_LOCALE,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_POSTHOG_API_KEY: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
    EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    EXPO_PUBLIC_EAS_PROJECT_ID: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  };
}

/**
 * Build- and shell-safe snapshot for early UI context initialization (e.g., default locale).
 * Runtime Supabase operations MUST call `getValidatedMobileSupabaseEnv()` lazily.
 */
export const mobileEnv: MobileEnv = mobileEnvSchema.parse(readStaticMobileEnv());

/**
 * Lazily validates public Supabase credentials fail-closed before any backend client use.
 */
export function getValidatedMobileSupabaseEnv(
  rawOverrides?: RawMobilePublicEnvInput,
): StrictMobilePublicEnv {
  const source = rawOverrides ?? readStaticMobileEnv();
  const parsed = strictMobilePublicEnvSchema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: source.EXPO_PUBLIC_SUPABASE_URL?.trim(),
    EXPO_PUBLIC_SUPABASE_ANON_KEY: source.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    EXPO_PUBLIC_APP_ENV: emptyEnvToUndefined(source.EXPO_PUBLIC_APP_ENV),
    EXPO_PUBLIC_DEFAULT_LOCALE: emptyEnvToUndefined(source.EXPO_PUBLIC_DEFAULT_LOCALE),
    EXPO_PUBLIC_SENTRY_DSN: emptyEnvToUndefined(source.EXPO_PUBLIC_SENTRY_DSN),
    EXPO_PUBLIC_POSTHOG_API_KEY: emptyEnvToUndefined(source.EXPO_PUBLIC_POSTHOG_API_KEY),
    EXPO_PUBLIC_POSTHOG_HOST: emptyEnvToUndefined(source.EXPO_PUBLIC_POSTHOG_HOST),
    EXPO_PUBLIC_EAS_PROJECT_ID: emptyEnvToUndefined(source.EXPO_PUBLIC_EAS_PROJECT_ID),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppDomainError({
      code: 'ENV_MISCONFIGURED',
      messageKey: 'errors.envMisconfigured',
      statusCode: 500,
      message: firstIssue?.message ?? 'validation.env.invalidSupabaseUrl',
    });
  }

  return parsed.data;
}

export const assertMobileSupabaseEnv = getValidatedMobileSupabaseEnv;
