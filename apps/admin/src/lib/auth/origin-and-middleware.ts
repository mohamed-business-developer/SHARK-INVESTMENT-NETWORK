import { AppDomainError } from '@shark/utils';

const ALWAYS_PUBLIC_ADMIN_PATHS = ['/login', '/unauthorized'] as const;

export function isPublicAdminPath(
  pathname: string,
  nodeEnv: string = process.env.NODE_ENV ?? 'development',
): boolean {
  if (
    ALWAYS_PUBLIC_ADMIN_PATHS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  if (
    nodeEnv !== 'production' &&
    (pathname === '/design-system' || pathname.startsWith('/design-system/'))
  ) {
    return true;
  }

  return false;
}

function hasControlOrWhitespaceIssues(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Prevents open redirects, double-encoding bypasses, userinfo SSRF, and self-redirect loops.
 */
export function sanitizeAdminRedirectPath(
  rawNext: string | null | undefined,
  fallback = '/',
): string {
  if (!rawNext || typeof rawNext !== 'string') {
    return fallback;
  }
  const trimmed = rawNext.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 256 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    trimmed.includes('@') ||
    /%2e|%2f|%5c|%25/i.test(trimmed) ||
    hasControlOrWhitespaceIssues(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, 'https://admin.local');
    if (
      parsed.origin !== 'https://admin.local' ||
      !parsed.pathname.startsWith('/') ||
      parsed.pathname.startsWith('//')
    ) {
      return fallback;
    }

    const normalizedPath = parsed.pathname.toLowerCase();
    if (
      normalizedPath === '/login' ||
      normalizedPath.startsWith('/login/') ||
      normalizedPath === '/unauthorized' ||
      normalizedPath.startsWith('/unauthorized/')
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function parseHttpOrigin(
  rawHeaderValue: string | null,
  options: { readonly allowPath: boolean },
): string | null {
  if (!rawHeaderValue) {
    return null;
  }
  const trimmed = rawHeaderValue.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === 'null') {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== ''
    ) {
      return null;
    }
    if (
      !options.allowPath &&
      (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '')
    ) {
      return null;
    }
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Pure fail-closed CSRF / Origin header verifier against explicit `ADMIN_ALLOWED_ORIGINS`.
 */
export function validateAdminOriginHeaders(
  requestHeaders: Pick<Headers, 'get'>,
  allowedOrigins: readonly string[],
): string {
  const normalizedAllowlist = new Set(allowedOrigins.map((origin) => origin.toLowerCase()));
  if (normalizedAllowlist.size === 0) {
    throw new AppDomainError({
      code: 'ENV_MISCONFIGURED',
      messageKey: 'errors.envMisconfigured',
      statusCode: 500,
    });
  }

  const secFetchSite = requestHeaders.get('sec-fetch-site')?.trim().toLowerCase();
  if (secFetchSite === 'cross-site') {
    throw new AppDomainError({
      code: 'ORIGIN_FORBIDDEN',
      messageKey: 'errors.originForbidden',
      statusCode: 403,
    });
  }

  const originHeader = requestHeaders.get('origin');
  if (originHeader !== null) {
    const parsedOrigin = parseHttpOrigin(originHeader, { allowPath: false });
    if (!parsedOrigin || !normalizedAllowlist.has(parsedOrigin)) {
      throw new AppDomainError({
        code: 'ORIGIN_FORBIDDEN',
        messageKey: 'errors.originForbidden',
        statusCode: 403,
      });
    }
    return parsedOrigin;
  }

  const refererOrigin = parseHttpOrigin(requestHeaders.get('referer'), { allowPath: true });
  if (refererOrigin && normalizedAllowlist.has(refererOrigin)) {
    return refererOrigin;
  }

  throw new AppDomainError({
    code: 'ORIGIN_FORBIDDEN',
    messageKey: 'errors.originForbidden',
    statusCode: 403,
  });
}

export interface MiddlewareDecision {
  readonly action: 'allow' | 'redirect_login';
  readonly redirectTarget?: string;
}

export function resolveAdminMiddlewareDecision(params: {
  readonly pathname: string;
  readonly search?: string;
  readonly hasVerifiedUser: boolean;
  readonly nodeEnv?: string;
}): MiddlewareDecision {
  const { pathname, search = '', hasVerifiedUser, nodeEnv } = params;

  if (isPublicAdminPath(pathname, nodeEnv) || hasVerifiedUser) {
    return { action: 'allow' };
  }

  const candidateNext = sanitizeAdminRedirectPath(`${pathname}${search}`, '');
  const redirectTarget =
    candidateNext.length > 0 ? `/login?next=${encodeURIComponent(candidateNext)}` : '/login';

  return {
    action: 'redirect_login',
    redirectTarget,
  };
}
