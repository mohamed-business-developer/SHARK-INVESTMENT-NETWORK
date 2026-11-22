import * as Sentry from '@sentry/react-native';
import { isPlaceholderEnvValue, uuidSchema } from '@shark/validation';
import { mobileEnv } from './env';
import {
  buildMobileSentryOptions,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  type ScrubbableBreadcrumb,
} from './telemetry-sanitizer';

let sentryInitialized = false;

export { scrubSentryBreadcrumb, scrubSentryEvent };

/**
 * Initializes Sentry error monitoring with strict PII redaction defaults (`docs/SECURITY.md` §7.4).
 */
export function initMobileSentry(): void {
  const dsn = mobileEnv.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (sentryInitialized || !dsn || isPlaceholderEnvValue(dsn)) {
    return;
  }

  const options = buildMobileSentryOptions({
    dsn,
    environment: mobileEnv.EXPO_PUBLIC_APP_ENV,
  });

  Sentry.init(options as Parameters<typeof Sentry.init>[0]);
  sentryInitialized = true;
}

/**
 * Sets opaque user UUID on Sentry scope (never email, phone, or profile attributes).
 */
export function setSentryUserId(userId: string | null): void {
  if (!sentryInitialized) {
    return;
  }
  if (userId && uuidSchema.safeParse(userId).success) {
    Sentry.setUser({ id: userId });
    return;
  }
  Sentry.setUser(null);
}

/**
 * Records a scrubbed breadcrumb without leaking tokens, URLs, or PII.
 */
export function addScrubbedBreadcrumb(breadcrumb: ScrubbableBreadcrumb): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.addBreadcrumb(
    scrubSentryBreadcrumb(breadcrumb) as Parameters<typeof Sentry.addBreadcrumb>[0],
  );
}
