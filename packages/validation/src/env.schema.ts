import { z } from 'zod';
import { appLocaleSchema } from './common.schema';

export const appEnvironmentSchema = z.enum(['development', 'staging', 'production']);

/**
 * Mobile public client environment schema — strictly client-safe keys only.
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

const PLACEHOLDER_ENV_FRAGMENTS = [
  'your-project-ref',
  'your-public-anon-key',
  'ci-placeholder',
  'example.supabase.co',
  'replace-me',
  'changeme',
] as const;

export function emptyEnvToUndefined(value: string | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function isPlaceholderEnvValue(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }
  return PLACEHOLDER_ENV_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

export function addHttpsIssueIfProduction(
  env: z.infer<typeof appEnvironmentSchema>,
  urlValue: string,
  path: string[],
  ctx: z.RefinementCtx,
): void {
  if (env === 'production' && !urlValue.toLowerCase().startsWith('https://')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.env.httpsRequired',
      path,
    });
  }
}

export function addPlaceholderIssueIfNeeded(
  value: string,
  path: string[],
  ctx: z.RefinementCtx,
): void {
  if (isPlaceholderEnvValue(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.env.placeholderValue',
      path,
    });
  }
}

/**
 * Fail-closed runtime schema for Mobile Supabase client initialization.
 */
export const strictMobilePublicEnvSchema = mobilePublicEnvSchema.superRefine((data, ctx) => {
  addPlaceholderIssueIfNeeded(data.EXPO_PUBLIC_SUPABASE_URL, ['EXPO_PUBLIC_SUPABASE_URL'], ctx);
  addPlaceholderIssueIfNeeded(
    data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY'],
    ctx,
  );
  addHttpsIssueIfProduction(
    data.EXPO_PUBLIC_APP_ENV,
    data.EXPO_PUBLIC_SUPABASE_URL,
    ['EXPO_PUBLIC_SUPABASE_URL'],
    ctx,
  );
});

/**
 * Fail-closed runtime schema for Admin browser/public Supabase client initialization.
 */
export const strictAdminPublicEnvSchema = adminPublicEnvSchema.superRefine((data, ctx) => {
  addPlaceholderIssueIfNeeded(data.NEXT_PUBLIC_SUPABASE_URL, ['NEXT_PUBLIC_SUPABASE_URL'], ctx);
  addPlaceholderIssueIfNeeded(
    data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ctx,
  );
  addPlaceholderIssueIfNeeded(data.NEXT_PUBLIC_SITE_URL, ['NEXT_PUBLIC_SITE_URL'], ctx);
  addHttpsIssueIfProduction(
    data.NEXT_PUBLIC_APP_ENV,
    data.NEXT_PUBLIC_SUPABASE_URL,
    ['NEXT_PUBLIC_SUPABASE_URL'],
    ctx,
  );
  addHttpsIssueIfProduction(
    data.NEXT_PUBLIC_APP_ENV,
    data.NEXT_PUBLIC_SITE_URL,
    ['NEXT_PUBLIC_SITE_URL'],
    ctx,
  );
});

export type StrictMobilePublicEnv = z.infer<typeof strictMobilePublicEnvSchema>;
export type StrictAdminPublicEnv = z.infer<typeof strictAdminPublicEnvSchema>;
