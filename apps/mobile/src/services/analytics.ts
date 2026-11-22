import PostHog from 'posthog-react-native';
import {
  buildPostHogEuOptions,
  createAnalyticsService,
  scrubPostHogBeforeSend,
  type AnalyticsClient,
  type AnalyticsConsentState,
  type AnalyticsDriver,
  type CreateAnalyticsServiceOptions,
} from './analytics-core';
import { mobileEnv } from './env';

export {
  buildPostHogEuOptions,
  createAnalyticsService,
  scrubPostHogBeforeSend,
  type AnalyticsClient,
  type AnalyticsConsentState,
  type AnalyticsDriver,
  type CreateAnalyticsServiceOptions,
};

function createDefaultPostHogDriver(config: {
  readonly apiKey: string;
  readonly host: string;
}): AnalyticsDriver {
  const phOptions = buildPostHogEuOptions(config.host);
  const client = new PostHog(config.apiKey, phOptions as ConstructorParameters<typeof PostHog>[1]);

  return {
    optIn: () => client.optIn(),
    optOut: () => client.optOut(),
    identify: (distinctId: string) => {
      client.identify(distinctId);
    },
    capture: (eventName: string, properties) => {
      client.capture(eventName, properties);
    },
    screen: (screenName: string, properties) => {
      void client.screen(screenName, properties);
    },
    reset: () => {
      client.reset();
    },
    shutdown: () => client.shutdown(),
  };
}

export const mobileAnalytics: AnalyticsClient = createAnalyticsService({
  apiKey: mobileEnv.EXPO_PUBLIC_POSTHOG_API_KEY,
  host: mobileEnv.EXPO_PUBLIC_POSTHOG_HOST,
  createDriver: createDefaultPostHogDriver,
});

export function createAnalyticsStub(): AnalyticsClient {
  return createAnalyticsService();
}
