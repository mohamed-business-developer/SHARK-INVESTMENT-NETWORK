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

const PLACEHOLDER_ENV_FRAGMENTS = [
  'your-project-ref',
  'your-public-anon-key',
  'your-service-role-key',
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

function addHttpsIssueIfProduction(
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

function addPlaceholderIssueIfNeeded(value: string, path: string[], ctx: z.RefinementCtx): void {
  if (isPlaceholderEnvValue(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'validation.env.placeholderValue',
      path,
    });
  }
}

export function parseAdminAllowedOriginsList(
  rawOrigins: string,
  appEnv: z.infer<typeof appEnvironmentSchema>,
): readonly string[] | null {
  const parts = rawOrigins
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length === 0) {
    return null;
  }

  const normalized = new Set<string>();
  for (const entry of parts) {
    if (entry === '*' || isPlaceholderEnvValue(entry)) {
      return null;
    }
    if (!z.string().url().safeParse(entry).success) {
      return null;
    }
    const originMatch = /^(https?):\/\/([^/?#@]+)(?:[/?#]|$)/i.exec(entry);
    if (!originMatch || !originMatch[1] || !originMatch[2]) {
      return null;
    }
    const protocol = originMatch[1].toLowerCase();
    if (appEnv === 'production' && protocol !== 'https') {
      return null;
    }
    normalized.add(`${protocol}://${originMatch[2].toLowerCase()}`);
  }

  return Array.from(normalized);
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

/**
 * Fail-closed runtime schema for Admin server-only operations & service-role access.
 */
export const strictAdminServerEnvSchema = adminPublicEnvSchema
  .merge(adminServerEnvSchema)
  .strict()
  .superRefine((data, ctx) => {
    addPlaceholderIssueIfNeeded(data.NEXT_PUBLIC_SUPABASE_URL, ['NEXT_PUBLIC_SUPABASE_URL'], ctx);
    addPlaceholderIssueIfNeeded(
      data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      ctx,
    );
    addPlaceholderIssueIfNeeded(data.NEXT_PUBLIC_SITE_URL, ['NEXT_PUBLIC_SITE_URL'], ctx);
    addPlaceholderIssueIfNeeded(data.SUPABASE_SERVICE_ROLE_KEY, ['SUPABASE_SERVICE_ROLE_KEY'], ctx);
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

    if (
      data.SUPABASE_SERVICE_ROLE_KEY.trim() === data.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim() &&
      data.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.env.serviceKeyMatchesAnonKey',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }

    const parsedOrigins = parseAdminAllowedOriginsList(
      data.ADMIN_ALLOWED_ORIGINS,
      data.NEXT_PUBLIC_APP_ENV,
    );
    if (!parsedOrigins) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          data.NEXT_PUBLIC_APP_ENV === 'production' &&
          data.ADMIN_ALLOWED_ORIGINS.toLowerCase().includes('http://')
            ? 'validation.env.httpsRequired'
            : 'validation.env.missingAllowedOrigins',
        path: ['ADMIN_ALLOWED_ORIGINS'],
      });
    }
  });

export type StrictMobilePublicEnv = z.infer<typeof strictMobilePublicEnvSchema>;
export type StrictAdminPublicEnv = z.infer<typeof strictAdminPublicEnvSchema>;
export type StrictAdminServerEnv = z.infer<typeof strictAdminServerEnvSchema> & {
  readonly allowedOrigins: readonly string[];
};

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
