import 'server-only';
import { AppDomainError } from '@shark/utils';
import {
  assertNoPublicSecretKeys,
  emptyEnvToUndefined,
  parseAdminAllowedOriginsList,
  strictAdminServerEnvSchema,
  type StrictAdminServerEnv,
} from '@shark/validation';

export type RawAdminServerEnvInput = Record<string, string | undefined>;

function readAdminServerRawEnv(): RawAdminServerEnvInput {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ADMIN_ALLOWED_ORIGINS: process.env.ADMIN_ALLOWED_ORIGINS,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
  };
}

/**
 * Pure server-side environment parser with fail-closed secret & origin validation.
 * Exposed alongside `getValidatedAdminServerEnv()` inside `server-only` boundary.
 */
export function parseAdminServerEnv(rawOverrides?: RawAdminServerEnvInput): StrictAdminServerEnv {
  const keysToAudit = Object.keys(rawOverrides ?? process.env);
  try {
    assertNoPublicSecretKeys(keysToAudit);
  } catch {
    throw new AppDomainError({
      code: 'ENV_MISCONFIGURED',
      messageKey: 'errors.envMisconfigured',
      statusCode: 500,
      message: 'validation.env.placeholderValue',
    });
  }

  const source = rawOverrides ?? readAdminServerRawEnv();
  const parsed = strictAdminServerEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    NEXT_PUBLIC_APP_ENV: emptyEnvToUndefined(source.NEXT_PUBLIC_APP_ENV),
    NEXT_PUBLIC_SITE_URL: emptyEnvToUndefined(source.NEXT_PUBLIC_SITE_URL),
    NEXT_PUBLIC_DEFAULT_LOCALE: emptyEnvToUndefined(source.NEXT_PUBLIC_DEFAULT_LOCALE),
    NEXT_PUBLIC_SENTRY_DSN: emptyEnvToUndefined(source.NEXT_PUBLIC_SENTRY_DSN),
    SUPABASE_SERVICE_ROLE_KEY: source.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    ADMIN_ALLOWED_ORIGINS: source.ADMIN_ALLOWED_ORIGINS?.trim(),
    SENTRY_AUTH_TOKEN: emptyEnvToUndefined(source.SENTRY_AUTH_TOKEN),
    SENTRY_ORG: emptyEnvToUndefined(source.SENTRY_ORG),
    SENTRY_PROJECT: emptyEnvToUndefined(source.SENTRY_PROJECT),
  });

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppDomainError({
      code: 'ENV_MISCONFIGURED',
      messageKey: 'errors.envMisconfigured',
      statusCode: 500,
      message: firstIssue?.message ?? 'validation.env.missingServiceRoleKey',
    });
  }

  const allowedOrigins = parseAdminAllowedOriginsList(
    parsed.data.ADMIN_ALLOWED_ORIGINS,
    parsed.data.NEXT_PUBLIC_APP_ENV,
  );

  if (!allowedOrigins) {
    throw new AppDomainError({
      code: 'ENV_MISCONFIGURED',
      messageKey: 'errors.envMisconfigured',
      statusCode: 500,
      message: 'validation.env.missingAllowedOrigins',
    });
  }

  return Object.freeze({
    ...parsed.data,
    allowedOrigins: Object.freeze(allowedOrigins),
  });
}

/**
 * Lazily validates privileged Admin server runtime secrets on server-side access only.
 */
export function getValidatedAdminServerEnv(
  rawOverrides?: RawAdminServerEnvInput,
): StrictAdminServerEnv {
  return parseAdminServerEnv(rawOverrides);
}

export const assertAdminServerEnv = getValidatedAdminServerEnv;
