import { mobileEnv } from './env';

/**
 * Privacy-hardened PostHog analytics stub (Phase 2).
 * Full opt-in client initialization with autocapture disabled lands in Phase 5 (P5-10).
 */
export interface AnalyticsClient {
  readonly isConfigured: boolean;
  trackEvent: (name: string, properties?: Record<string, string | number | boolean>) => void;
}

export function createAnalyticsStub(): AnalyticsClient {
  const isConfigured = Boolean(mobileEnv.EXPO_PUBLIC_POSTHOG_API_KEY);

  return {
    isConfigured,
    trackEvent: () => {
      // No-op stub in Phase 2 foundation shell; Phase 5 wires opt-in PostHog EU ingestion.
    },
  };
}
