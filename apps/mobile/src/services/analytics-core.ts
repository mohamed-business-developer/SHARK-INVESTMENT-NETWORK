import { isPlaceholderEnvValue, uuidSchema } from '@shark/validation';
import {
  resolvePostHogEuHost,
  sanitizeAnalyticsProperties,
  scrubUrlQuery,
  type PrimitiveAnalyticsValue,
} from './telemetry-sanitizer';

export interface AnalyticsDriver {
  optIn: () => Promise<void> | void;
  optOut: () => Promise<void> | void;
  identify: (distinctId: string) => void;
  capture: (eventName: string, properties?: Record<string, PrimitiveAnalyticsValue>) => void;
  screen: (screenName: string, properties?: Record<string, PrimitiveAnalyticsValue>) => void;
  reset: () => void;
  shutdown?: () => Promise<void> | void;
}

export interface AnalyticsConsentState {
  readonly enabled: boolean;
  readonly userId?: string | null;
}

export interface AnalyticsClient {
  readonly isConfigured: boolean;
  readonly isEnabled: () => boolean;
  readonly syncConsent: (state: AnalyticsConsentState) => Promise<void>;
  readonly trackEvent: (name: string, properties?: Record<string, PrimitiveAnalyticsValue>) => void;
  readonly trackScreen: (
    screenName: string,
    properties?: Record<string, PrimitiveAnalyticsValue>,
  ) => void;
  readonly reset: () => Promise<void>;
}

export interface CreateAnalyticsServiceOptions {
  readonly apiKey?: string;
  readonly host?: string;
  readonly teardownTimeoutMs?: number;
  readonly createDriver?: (config: {
    readonly apiKey: string;
    readonly host: string;
  }) => AnalyticsDriver;
}

export interface PostHogCaptureEnvelope {
  uuid?: string;
  event: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Final PostHog `before_send` sanitizer preserving the ingestion `token` while stripping
 * person-trait objects and query/PII fields.
 */
export function scrubPostHogBeforeSend<T extends PostHogCaptureEnvelope>(event: T): T {
  const next = { ...event };
  if ('$set' in next) {
    delete next.$set;
  }
  if ('$set_once' in next) {
    delete next.$set_once;
  }
  if (next.properties) {
    const projectToken = next.properties.token;
    const primitives: Record<string, PrimitiveAnalyticsValue> = {};
    for (const [k, v] of Object.entries(next.properties)) {
      if (k === 'token') {
        continue;
      }
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        primitives[k] = v;
      }
    }
    const cleanProps: Record<string, unknown> = sanitizeAnalyticsProperties(primitives);
    if (typeof next.properties.$current_url === 'string') {
      cleanProps.$current_url = scrubUrlQuery(next.properties.$current_url);
    }
    if (typeof projectToken === 'string') {
      // Preserve PostHog's internal project ingestion token per @posthog/core BeforeSendFn contract.
      cleanProps.token = projectToken;
    }
    next.properties = cleanProps;
  }
  return next;
}

/**
 * Builds hardened PostHog EU initialization options with all autocapture and replay disabled.
 */
export function buildPostHogEuOptions(host: string) {
  return {
    host,
    defaultOptIn: false,
    persistence: 'memory' as const,
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    disableRemoteConfig: true,
    capturePushNotificationSubscriptions: false,
    capturePushNotificationOpened: false,
    rageClickConfig: { enabled: false },
    before_send: scrubPostHogBeforeSend,
  };
}

/**
 * Creates a privacy-hardened, strictly opt-in PostHog EU analytics client.
 * Never instantiates PostHog or dispatches events before explicit `analytics_opt_in === true`,
 * and stops immediately when consent is withdrawn or the user signs out.
 */
async function withBoundedTimeout(
  operation: () => void | Promise<void> | undefined,
  timeoutMs: number,
): Promise<void> {
  let result: void | Promise<void> | undefined;
  try {
    result = operation();
  } catch {
    return;
  }

  if (!result || typeof result.then !== 'function') {
    return;
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      result.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

export function createAnalyticsService(options?: CreateAnalyticsServiceOptions): AnalyticsClient {
  const rawKey = options?.apiKey?.trim();
  const apiKey = rawKey && !isPlaceholderEnvValue(rawKey) ? rawKey : undefined;
  const euHost = resolvePostHogEuHost(options?.host);
  const isConfigured = Boolean(apiKey && euHost);
  const buildDriver = options?.createDriver;
  const teardownTimeoutMs = Math.max(10, Math.min(options?.teardownTimeoutMs ?? 250, 5000));

  let consented = false;
  let consentGeneration = 0;
  let identifiedUserId: string | null = null;
  let driver: AnalyticsDriver | null = null;

  const teardownDriver = async (): Promise<void> => {
    consentGeneration += 1;
    consented = false;
    const active = driver;
    driver = null;
    identifiedUserId = null;
    if (!active) {
      return;
    }

    try {
      active.reset();
    } catch {
      // Ignore reset errors on teardown so sign-out never fails or stalls.
    }

    const startedAt = Date.now();
    await withBoundedTimeout(() => active.optOut(), teardownTimeoutMs);
    const remainingMs = Math.max(10, teardownTimeoutMs - (Date.now() - startedAt));
    await withBoundedTimeout(() => active.shutdown?.(), remainingMs);
  };

  return {
    isConfigured,

    isEnabled: () => consented && isConfigured && driver !== null,

    async syncConsent(state: AnalyticsConsentState): Promise<void> {
      if (!state.enabled || !isConfigured || !apiKey || !euHost || !buildDriver) {
        await teardownDriver();
        return;
      }

      const generation = ++consentGeneration;
      consented = true;
      if (!driver) {
        driver = buildDriver({ apiKey, host: euHost });
      }
      await driver.optIn();

      if (generation !== consentGeneration || !consented || !driver) {
        return;
      }

      const validUserId =
        state.userId && uuidSchema.safeParse(state.userId).success ? state.userId : null;
      if (!validUserId) {
        if (identifiedUserId !== null) {
          driver.reset();
          identifiedUserId = null;
        }
        return;
      }

      if (validUserId !== identifiedUserId) {
        if (identifiedUserId !== null) {
          driver.reset();
        }
        driver.identify(validUserId);
        identifiedUserId = validUserId;
      }
    },

    trackEvent(name: string, properties?: Record<string, PrimitiveAnalyticsValue>): void {
      if (!consented || !driver) {
        return;
      }
      const trimmedName = name.trim();
      if (trimmedName.length === 0) {
        return;
      }
      driver.capture(trimmedName, sanitizeAnalyticsProperties(properties));
    },

    trackScreen(screenName: string, properties?: Record<string, PrimitiveAnalyticsValue>): void {
      if (!consented || !driver) {
        return;
      }
      const cleanScreen = scrubUrlQuery(screenName.trim());
      if (cleanScreen.length === 0) {
        return;
      }
      driver.screen(cleanScreen, sanitizeAnalyticsProperties(properties));
    },

    async reset(): Promise<void> {
      await teardownDriver();
    },
  };
}
