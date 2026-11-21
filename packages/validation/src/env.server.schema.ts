import { z } from 'zod';
import {
  addHttpsIssueIfProduction,
  addPlaceholderIssueIfNeeded,
  adminPublicEnvSchema,
  appEnvironmentSchema,
  isPlaceholderEnvValue,
} from './env.schema';

/**
 * Admin server-only environment schema — imported exclusively from server-only modules
 * via `@shark/validation/server-env` so secret key names never enter client bundles.
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

const SERVER_PLACEHOLDER_FRAGMENTS = ['your-service-role-key'] as const;

function isAnyServerPlaceholder(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  if (isPlaceholderEnvValue(value)) {
    return true;
  }
  const normalized = value.trim().toLowerCase();
  return SERVER_PLACEHOLDER_FRAGMENTS.some((fragment) => normalized.includes(fragment));
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
    if (entry === '*' || isAnyServerPlaceholder(entry)) {
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
    if (isAnyServerPlaceholder(data.SUPABASE_SERVICE_ROLE_KEY)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.env.placeholderValue',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
      });
    }
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
