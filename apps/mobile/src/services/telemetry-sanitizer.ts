import { uuidSchema } from '@shark/validation';

const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';
const REDACTED_PHONE = '[REDACTED_PHONE]';
const REDACTED_JWT = '[REDACTED_JWT]';
const REDACTED_PUSH_TOKEN = '[REDACTED_PUSH_TOKEN]';

const SENSITIVE_ENDPOINT_PATTERNS = [
  '/auth/',
  '/verification',
  '/get-signed-document-url',
  '/delete-own-account',
  '/send-push-notification',
] as const;

const STRIPPED_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'x-api-key',
  'x-supabase-auth',
]);

const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'cookie',
  'apikey',
  'password',
  'passwd',
  'secret',
  'token',
  'signedurl',
  'signed_url',
  'storage_path',
  'storagepath',
  'document_paths',
  'email',
  'phone',
  'mobile',
  'national_id',
  'passport',
  'iban',
  'rejection_reason',
  'suspension_reason',
  'internal_notes',
  'founder_notes',
  'admin_feedback',
  'company_valuation',
  'pre_money_valuation',
  'target_amount',
  'file_name',
] as const;

const ANALYTICS_FORBIDDEN_KEY_FRAGMENTS = [
  ...SENSITIVE_KEY_FRAGMENTS,
  'full_name',
  'first_name',
  'last_name',
  'headline',
  'bio',
  'city',
  'address',
  'url',
  'query',
  'ip',
] as const;

export interface ScrubbableRequest {
  url?: string;
  query_string?: unknown;
  headers?: Record<string, string>;
  cookies?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

export interface ScrubbableUser {
  id?: string | number;
  email?: string;
  username?: string;
  ip_address?: string;
  [key: string]: unknown;
}

export interface ScrubbableBreadcrumb {
  type?: string;
  category?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
  timestamp?: number;
  [key: string]: unknown;
}

export interface ScrubbableEvent {
  message?: string;
  request?: ScrubbableRequest;
  user?: ScrubbableUser;
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  breadcrumbs?: ScrubbableBreadcrumb[];
  exception?: {
    values?: {
      value?: string;
      [key: string]: unknown;
    }[];
  };
  [key: string]: unknown;
}

export type PrimitiveAnalyticsValue = string | number | boolean;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSensitiveKey(key: string, fragments: readonly string[]): boolean {
  const normalized = key.trim().toLowerCase();
  if (normalized === 'id' || normalized.endsWith('_id')) {
    return false;
  }
  return fragments.some((fragment) => normalized.includes(fragment));
}

function isSensitiveEndpoint(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  const lower = url.toLowerCase();
  return SENSITIVE_ENDPOINT_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Redacts query parameters from URLs (replacing `?params` with `?[REDACTED]`) to prevent signed URL or token leakage.
 */
export function scrubUrlQuery(input: string): string {
  return input.replace(/((?:https?:\/\/|\/)[^\s"'<>?#]+)\?([^\s"'<>#]+)/gi, '$1?[REDACTED]');
}

/**
 * Scrubs Bearer tokens, JWTs, signed URL query parameters, push tokens, emails, and phone numbers from free-form text.
 */
const INTL_PHONE_PATTERN =
  /(^|[\s:=(["',])((?:\(\+[1-9]\d{0,3}\)|\+[1-9])(?:[\s.-]*\(?\d{1,5}\)?){1,7})(?=$|[\s),.;"'\]&])/g;

const LOCAL_OR_TRUNK_PHONE_PATTERN =
  /(^|[\s:=(["',])((?:\(0\d{1,4}\)|0\d)(?:[\s-]?\d{1,5}){1,7})(?=$|[\s),.;"'\]&])/g;

function redactMatchedPhone(
  match: string,
  prefix: string,
  candidate: string,
  isIntl: boolean,
): string {
  const digits = candidate.replace(/\D/g, '');
  if (/^0{4,}/.test(digits) || /^\d{8}-\d{4}/.test(candidate)) {
    return match;
  }

  const maxDigits = isIntl || digits.startsWith('00') ? 17 : 15;
  const minDigits = isIntl ? 7 : 9;
  if (digits.length < minDigits || digits.length > maxDigits) {
    return match;
  }

  return `${prefix}${REDACTED_PHONE}`;
}

export function scrubSensitiveText(input: string): string {
  let scrubbed = scrubUrlQuery(input);
  scrubbed = scrubbed.replace(/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, `Bearer ${REDACTED}`);
  scrubbed = scrubbed.replace(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    REDACTED_JWT,
  );
  scrubbed = scrubbed.replace(
    /\b(?:ExponentPushToken|ExpoPushToken)\[[^\]]+\]/g,
    REDACTED_PUSH_TOKEN,
  );
  scrubbed = scrubbed.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED_EMAIL);
  scrubbed = scrubbed.replace(INTL_PHONE_PATTERN, (match, prefix: string, candidate: string) =>
    redactMatchedPhone(match, prefix, candidate, true),
  );
  scrubbed = scrubbed.replace(
    LOCAL_OR_TRUNK_PHONE_PATTERN,
    (match, prefix: string, candidate: string) =>
      redactMatchedPhone(match, prefix, candidate, false),
  );
  return scrubbed;
}

/**
 * Recursively scrubs sensitive keys and inline PII/token patterns across objects and arrays.
 */
export function scrubSensitiveValue(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > 8) {
    return REDACTED;
  }
  if (typeof value === 'string') {
    return scrubSensitiveText(value);
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return REDACTED;
    }
    seen.add(value);
    return value.map((item) => scrubSensitiveValue(item, depth + 1, seen));
  }
  if (isPlainRecord(value)) {
    if (seen.has(value)) {
      return REDACTED;
    }
    seen.add(value);
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSensitiveKey(key, SENSITIVE_KEY_FRAGMENTS)) {
        next[key] = REDACTED;
      } else {
        next[key] = scrubSensitiveValue(entry, depth + 1, seen);
      }
    }
    return next;
  }
  return value;
}

function scrubHeaders(headers: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (STRIPPED_HEADER_NAMES.has(key.trim().toLowerCase())) {
      continue;
    }
    clean[key] = scrubSensitiveText(value);
  }
  return clean;
}

function scrubUser(user: ScrubbableUser | undefined): ScrubbableUser | undefined {
  if (!user) {
    return undefined;
  }
  if (typeof user.id === 'string' && uuidSchema.safeParse(user.id).success) {
    return { id: user.id };
  }
  return undefined;
}

/**
 * Scrubs HTTP headers, cookies, URL query tokens, PII, and confidential payloads from Sentry breadcrumbs.
 */
export function scrubSentryBreadcrumb<T extends ScrubbableBreadcrumb>(breadcrumb: T): T {
  const next = { ...breadcrumb };
  if (typeof next.message === 'string') {
    next.message = scrubSensitiveText(next.message);
  }
  if (isPlainRecord(next.data)) {
    const cleanData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(next.data)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'headers' && isPlainRecord(val)) {
        const stringHeaders: Record<string, string> = {};
        for (const [hk, hv] of Object.entries(val)) {
          if (typeof hv === 'string') {
            stringHeaders[hk] = hv;
          }
        }
        cleanData[key] = scrubHeaders(stringHeaders);
      } else if (isSensitiveKey(key, SENSITIVE_KEY_FRAGMENTS)) {
        cleanData[key] = REDACTED;
      } else if (
        (lowerKey === 'url' || lowerKey === 'from' || lowerKey === 'to') &&
        typeof val === 'string'
      ) {
        cleanData[key] = scrubSensitiveText(val);
      } else {
        cleanData[key] = scrubSensitiveValue(val);
      }
    }
    next.data = cleanData;
  }
  return next;
}

/**
 * Scrubs all PII, auth headers, Signed URLs, and sensitive payloads from Sentry events prior to transmission.
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  const next = { ...event };

  if (typeof next.message === 'string') {
    next.message = scrubSensitiveText(next.message);
  }

  const scrubbedUser = scrubUser(next.user);
  if (scrubbedUser) {
    next.user = scrubbedUser;
  } else {
    delete next.user;
  }

  if (next.request) {
    const req = { ...next.request };
    if (typeof req.url === 'string') {
      req.url = scrubSensitiveText(req.url);
    }
    if (req.headers) {
      req.headers = scrubHeaders(req.headers);
    }
    if ('cookies' in req) {
      delete req.cookies;
    }
    if ('query_string' in req && req.query_string !== undefined) {
      req.query_string = REDACTED;
    }
    if ('data' in req && req.data !== undefined) {
      req.data = isSensitiveEndpoint(next.request.url) ? REDACTED : scrubSensitiveValue(req.data);
    }
    next.request = req;
  }

  if (next.exception?.values) {
    next.exception = {
      ...next.exception,
      values: next.exception.values.map((item) => ({
        ...item,
        ...(typeof item.value === 'string' ? { value: scrubSensitiveText(item.value) } : {}),
      })),
    };
  }

  if (isPlainRecord(next.extra)) {
    next.extra = scrubSensitiveValue(next.extra) as Record<string, unknown>;
  }
  if (isPlainRecord(next.tags)) {
    next.tags = scrubSensitiveValue(next.tags) as Record<string, unknown>;
  }
  if (isPlainRecord(next.contexts)) {
    next.contexts = scrubSensitiveValue(next.contexts) as Record<string, unknown>;
  }
  if (Array.isArray(next.breadcrumbs)) {
    next.breadcrumbs = next.breadcrumbs.map((crumb) => scrubSentryBreadcrumb(crumb));
  }

  return next;
}

/**
 * Builds hardened Sentry initialization options with PII disabled and event/breadcrumb redaction hooks.
 */
export function buildMobileSentryOptions(config: {
  readonly dsn: string;
  readonly environment: string;
}) {
  return {
    dsn: config.dsn,
    environment: config.environment,
    sendDefaultPii: false as const,
    enableAutoSessionTracking: false as const,
    beforeSend<T extends ScrubbableEvent>(event: T): T {
      return scrubSentryEvent(event);
    },
    beforeBreadcrumb<T extends ScrubbableBreadcrumb>(breadcrumb: T): T {
      return scrubSentryBreadcrumb(breadcrumb);
    },
  };
}

/**
 * Validates that PostHog is configured against the EU cloud ingestion host over HTTPS.
 */
export function resolvePostHogEuHost(rawHost: string | undefined): string | null {
  const candidate = rawHost?.trim() || 'https://eu.i.posthog.com';
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isEuHost = host === 'eu.i.posthog.com' || host === 'eu.posthog.com';
    if (parsed.protocol !== 'https:' || !isEuHost) {
      return null;
    }
    return `https://${host}`;
  } catch {
    return null;
  }
}

/**
 * Drops disallowed PII/financial/document keys and scrubs strings in PostHog custom event properties.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, PrimitiveAnalyticsValue> | undefined,
): Record<string, PrimitiveAnalyticsValue> {
  if (!properties) {
    return {};
  }

  const sanitized: Record<string, PrimitiveAnalyticsValue> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (isSensitiveKey(key, ANALYTICS_FORBIDDEN_KEY_FRAGMENTS)) {
      continue;
    }
    if (typeof value === 'string') {
      const cleaned = scrubSensitiveText(value);
      if (
        cleaned.includes(REDACTED) ||
        cleaned.includes(REDACTED_EMAIL) ||
        cleaned.includes(REDACTED_PHONE) ||
        cleaned.includes(REDACTED_JWT) ||
        cleaned.includes(REDACTED_PUSH_TOKEN)
      ) {
        continue;
      }
      sanitized[key] = cleaned.slice(0, 120);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
