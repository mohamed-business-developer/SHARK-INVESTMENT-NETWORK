import { z } from 'zod';
import { AppDomainError } from '@shark/utils';
import {
  appLocaleSchema,
  emptyEnvToUndefined,
  strictAdminPublicEnvSchema,
  type StrictAdminPublicEnv,
} from '@shark/validation';

const publicAdminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_DEFAULT_LOCALE: appLocaleSchema.default('ar'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type PublicAdminEnv = z.infer<typeof publicAdminEnvSchema>;
export type RawAdminPublicEnvInput = Record<string, string | undefined>;

function readStaticAdminPublicEnv(): RawAdminPublicEnvInput {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
}

/**
 * Build- and SSR-layout-safe public snapshot.
 * Browser/SSR Supabase helpers MUST invoke `getValidatedAdminPublicEnv()` lazily.
 */
export const publicAdminEnv: PublicAdminEnv = publicAdminEnvSchema.parse(
  readStaticAdminPublicEnv(),
);

/**
 * Lazily validates public Admin Supabase configuration fail-closed without blocking CI `next build`.
 */
export function getValidatedAdminPublicEnv(
  rawOverrides?: RawAdminPublicEnvInput,
): StrictAdminPublicEnv {
  const source = rawOverrides ?? readStaticAdminPublicEnv();
  const parsed = strictAdminPublicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    NEXT_PUBLIC_APP_ENV: emptyEnvToUndefined(source.NEXT_PUBLIC_APP_ENV),
    NEXT_PUBLIC_SITE_URL: emptyEnvToUndefined(source.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_DEFAULT_LOCALE: emptyEnvToUndefined(source.NEXT_PUBLIC_DEFAULT_LOCALE),
    NEXT_PUBLIC_SENTRY_DSN: emptyEnvToUndefined(source.NEXT_PUBLIC_SENTRY_DSN),
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

export const assertAdminPublicEnv = getValidatedAdminPublicEnv;
