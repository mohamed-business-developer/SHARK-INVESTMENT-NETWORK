import * as Sentry from '@sentry/react-native';
import { mobileEnv } from './env';

let sentryInitialized = false;

/**
 * Initializes Sentry error monitoring with strict PII redaction defaults (docs/SECURITY.md §7.4).
 */
export function initMobileSentry(): void {
  if (sentryInitialized || !mobileEnv.EXPO_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: mobileEnv.EXPO_PUBLIC_SENTRY_DSN,
    environment: mobileEnv.EXPO_PUBLIC_APP_ENV,
    sendDefaultPii: false,
    enableAutoSessionTracking: false,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization;
        delete event.request.headers.authorization;
        delete event.request.headers.apikey;
      }
      return event;
    },
  });

  sentryInitialized = true;
}
