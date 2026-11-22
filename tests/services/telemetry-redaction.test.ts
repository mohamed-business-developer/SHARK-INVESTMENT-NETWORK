import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  buildPostHogEuOptions,
  createAnalyticsService,
  scrubPostHogBeforeSend,
  type AnalyticsDriver,
} from '../../apps/mobile/src/services/analytics-core';
import {
  buildMobileSentryOptions,
  resolvePostHogEuHost,
  sanitizeAnalyticsProperties,
  scrubSensitiveText,
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubUrlQuery,
} from '../../apps/mobile/src/services/telemetry-sanitizer';

const USER_UUID = '11111111-1111-4111-8111-111111111104';

describe('T5-16 Sentry PII Redaction & Opt-In PostHog EU Telemetry (P5-U05)', () => {
  it('scrubs Signed URLs, auth headers, cookies, JWTs, emails, phones, and push tokens from Sentry events & breadcrumbs', () => {
    const rawSignedUrl =
      'https://demo.supabase.co/storage/v1/object/sign/pitch-documents/22222222-2222-4222-8222-222222222201/deck.pdf?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig12345';
    const rawJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.c2lnbmF0dXJl';

    expect(scrubUrlQuery(rawSignedUrl)).toBe(
      'https://demo.supabase.co/storage/v1/object/sign/pitch-documents/22222222-2222-4222-8222-222222222201/deck.pdf?[REDACTED]',
    );

    const textScrubbed = scrubSensitiveText(
      `User founder@shark.test (+966501234567) Bearer ${rawJwt} token ExponentPushToken[abc123] uuid ${USER_UUID} url ${rawSignedUrl}`,
    );
    expect(textScrubbed).not.toContain('founder@shark.test');
    expect(textScrubbed).not.toContain('+966501234567');
    expect(textScrubbed).not.toContain('sig12345');
    expect(textScrubbed).not.toContain(rawJwt);
    expect(textScrubbed).not.toContain('ExponentPushToken[abc123]');
    expect(textScrubbed).toContain(USER_UUID);

    const sentryOptions = buildMobileSentryOptions({
      dsn: 'https://public123@o1.ingest.sentry.io/123',
      environment: 'staging',
    });
    expect(sentryOptions.sendDefaultPii).toBe(false);
    expect(sentryOptions.enableAutoSessionTracking).toBe(false);

    const cleanedEvent = sentryOptions.beforeSend({
      message: `Signed fetch failed for investor@shark.test at ${rawSignedUrl}`,
      user: {
        id: USER_UUID,
        email: 'investor@shark.test',
        username: 'investor_real_name',
        ip_address: '203.0.113.99',
      },
      request: {
        url: 'https://demo.supabase.co/functions/v1/get-signed-document-url?apikey=secret',
        query_string: 'token=abc',
        cookies: 'sb-access-token=xyz',
        headers: {
          Authorization: `Bearer ${rawJwt}`,
          authorization: `Bearer ${rawJwt}`,
          Cookie: 'session=abc',
          'Set-Cookie': 'session=abc',
          apikey: 'anon-key-leak',
          'x-supabase-auth': 'jwt-leak',
          'content-type': 'application/json',
        },
        data: { password: 'MySecretPassword', documentId: USER_UUID },
      },
      extra: {
        signedUrl: rawSignedUrl,
        founder_notes: 'Confidential board memo',
        request_id: USER_UUID,
      },
      exception: {
        values: [{ value: `Failed auth for founder@shark.test using ${rawJwt}` }],
      },
      breadcrumbs: [
        {
          category: 'http',
          message: `POST ${rawSignedUrl}`,
          data: {
            url: rawSignedUrl,
            headers: {
              Authorization: `Bearer ${rawJwt}`,
              apikey: 'leak',
              accept: 'application/json',
            },
            email: 'founder@shark.test',
          },
        },
      ],
    });

    expect(cleanedEvent.user).toEqual({ id: USER_UUID });
    expect(cleanedEvent.request?.headers).toEqual({ 'content-type': 'application/json' });
    expect(cleanedEvent.request?.cookies).toBeUndefined();
    expect(cleanedEvent.request?.query_string).toBe('[REDACTED]');
    expect(cleanedEvent.request?.data).toBe('[REDACTED]');
    expect(cleanedEvent.request?.url).toBe(
      'https://demo.supabase.co/functions/v1/get-signed-document-url?[REDACTED]',
    );
    expect(cleanedEvent.extra?.signedUrl).toBe('[REDACTED]');
    expect(cleanedEvent.extra?.founder_notes).toBe('[REDACTED]');
    expect(cleanedEvent.extra?.request_id).toBe(USER_UUID);

    const serialized = JSON.stringify(cleanedEvent);
    expect(serialized).not.toContain('investor@shark.test');
    expect(serialized).not.toContain('founder@shark.test');
    expect(serialized).not.toContain('203.0.113.99');
    expect(serialized).not.toContain('MySecretPassword');
    expect(serialized).not.toContain('Confidential board memo');
    expect(serialized).not.toContain('sig12345');
    expect(serialized).not.toContain(rawJwt);
    expect(serialized).not.toContain('anon-key-leak');

    const cleanedCrumb = sentryOptions.beforeBreadcrumb(
      scrubSentryBreadcrumb({
        category: 'navigation',
        message: `Opened /pitches/${USER_UUID}?token=leak&email=user@shark.test`,
        data: {
          to: `https://example.com/view?signedUrl=${rawSignedUrl}`,
          phone: '+966509998888',
        },
      }),
    );
    const crumbJson = JSON.stringify(cleanedCrumb);
    expect(crumbJson).not.toContain('token=leak');
    expect(crumbJson).not.toContain('user@shark.test');
    expect(crumbJson).not.toContain('+966509998888');
    expect(crumbJson).not.toContain('sig12345');

    // Non-UUID user objects must be completely removed
    expect(scrubSentryEvent({ user: { id: 'not-a-uuid', email: 'a@b.com' } }).user).toBeUndefined();
  });

  it('enforces EU PostHog host, zero events before opt-in, immediate stop on withdrawal, and autocapture disabled', async () => {
    expect(resolvePostHogEuHost(undefined)).toBe('https://eu.i.posthog.com');
    expect(resolvePostHogEuHost('https://eu.posthog.com/')).toBe('https://eu.posthog.com');
    expect(resolvePostHogEuHost('https://us.i.posthog.com')).toBeNull();
    expect(resolvePostHogEuHost('http://eu.i.posthog.com')).toBeNull();
    expect(resolvePostHogEuHost('https://evil.example.com')).toBeNull();

    const driverCalls: string[] = [];
    const createdConfigs: Array<{ apiKey: string; host: string }> = [];
    const mockDriver: AnalyticsDriver = {
      optIn: vi.fn(() => {
        driverCalls.push('optIn');
      }),
      optOut: vi.fn(() => {
        driverCalls.push('optOut');
        throw new Error('Simulated network failure on teardown');
      }),
      identify: vi.fn((id: string) => {
        driverCalls.push(`identify:${id}`);
      }),
      capture: vi.fn((name: string, props) => {
        driverCalls.push(`capture:${name}:${JSON.stringify(props ?? {})}`);
      }),
      screen: vi.fn((name: string) => {
        driverCalls.push(`screen:${name}`);
      }),
      reset: vi.fn(() => {
        driverCalls.push('reset');
      }),
      shutdown: vi.fn(async () => {
        driverCalls.push('shutdown');
      }),
    };

    const analytics = createAnalyticsService({
      apiKey: 'phc_live_non_placeholder_key',
      host: 'https://eu.i.posthog.com',
      createDriver: (cfg) => {
        createdConfigs.push(cfg);
        return mockDriver;
      },
    });

    // 1. Before opt-in: ZERO driver instantiation, ZERO events captured
    analytics.trackEvent('screen_viewed', { tab: 'discovery' });
    analytics.trackScreen('/(tabs)/discovery');
    expect(analytics.isEnabled()).toBe(false);
    expect(createdConfigs).toHaveLength(0);
    expect(driverCalls).toHaveLength(0);

    // Explicitly opted out
    await analytics.syncConsent({ enabled: false, userId: USER_UUID });
    analytics.trackEvent('screen_viewed', { tab: 'discovery' });
    expect(createdConfigs).toHaveLength(0);
    expect(driverCalls).toHaveLength(0);

    // 2. Explicit opt-in enables EU PostHog and strips PII properties
    await analytics.syncConsent({ enabled: true, userId: USER_UUID });
    expect(analytics.isEnabled()).toBe(true);
    expect(createdConfigs).toEqual([
      { apiKey: 'phc_live_non_placeholder_key', host: 'https://eu.i.posthog.com' },
    ]);

    analytics.trackEvent('filter_applied', {
      sector_slug: 'fintech',
      email: 'should-drop@shark.test',
      signedUrl: 'https://x.supabase.co/obj?token=abc',
      company_valuation: 5000000,
      note: 'Reach out at founder@shark.test',
    });
    expect(mockDriver.identify).toHaveBeenCalledWith(USER_UUID);
    expect(mockDriver.capture).toHaveBeenCalledWith('filter_applied', { sector_slug: 'fintech' });

    // 3. Consent withdrawal stops immediately and never throws on network/driver error
    await analytics.syncConsent({ enabled: false, userId: USER_UUID });
    expect(analytics.isEnabled()).toBe(false);
    expect(driverCalls).toContain('optOut');
    expect(driverCalls).toContain('reset');
    expect(driverCalls).toContain('shutdown');

    const callCountAfterOptOut = driverCalls.length;
    analytics.trackEvent('filter_applied', { sector_slug: 'ai' });
    analytics.trackScreen('/(tabs)/pitches');
    expect(driverCalls).toHaveLength(callCountAfterOptOut);

    // 4. Hardened PostHog EU option builder + before_send validation
    const phOptions = buildPostHogEuOptions('https://eu.i.posthog.com');
    expect(phOptions.host).toBe('https://eu.i.posthog.com');
    expect(phOptions.defaultOptIn).toBe(false);
    expect(phOptions.captureAppLifecycleEvents).toBe(false);
    expect(phOptions.enableSessionReplay).toBe(false);
    expect(phOptions.preloadFeatureFlags).toBe(false);
    expect(phOptions.sendFeatureFlagEvent).toBe(false);
    expect(phOptions.disableRemoteConfig).toBe(true);
    expect(phOptions.capturePushNotificationSubscriptions).toBe(false);
    expect(phOptions.capturePushNotificationOpened).toBe(false);
    expect(phOptions.rageClickConfig).toEqual({ enabled: false });
    expect(phOptions.persistence).toBe('memory');

    const scrubbedPh = scrubPostHogBeforeSend({
      event: 'screen_viewed',
      $set: { email: 'leak@shark.test' },
      $set_once: { phone: '+966501234567' },
      properties: {
        token: 'phc_real_key_123456',
        $current_url: 'https://shark.app/pitches/1?token=signed',
        email: 'leak@shark.test',
        tab: 'pitches',
      },
    });
    expect(scrubbedPh.$set).toBeUndefined();
    expect(scrubbedPh.$set_once).toBeUndefined();
    expect(scrubbedPh.properties?.token).toBe('phc_real_key_123456');
    expect(scrubbedPh.properties?.$current_url).toBe('https://shark.app/pitches/1?[REDACTED]');
    expect(scrubbedPh.properties?.email).toBeUndefined();
    expect(scrubbedPh.properties?.tab).toBe('pitches');

    // Placeholder / non-EU host stays disabled
    const usRejected = createAnalyticsService({
      apiKey: 'phc_live_key',
      host: 'https://us.i.posthog.com',
      createDriver: () => mockDriver,
    });
    expect(usRejected.isConfigured).toBe(false);
    await usRejected.syncConsent({ enabled: true, userId: USER_UUID });
    expect(usRejected.isEnabled()).toBe(false);

    expect(
      sanitizeAnalyticsProperties({
        stage: 'seed',
        phone: '+966501112222',
        query_token: 'abc',
      }),
    ).toEqual({ stage: 'seed' });

    // Static verification on runtime bindings (sentry.ts, analytics.ts, useAuth.tsx)
    const sentrySource = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/services/sentry.ts'),
      'utf8',
    );
    const analyticsSource = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/services/analytics.ts'),
      'utf8',
    );
    const useAuthSource = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/hooks/useAuth.tsx'),
      'utf8',
    );

    expect(sentrySource).toContain('buildMobileSentryOptions');
    expect(sentrySource).toContain('setUser({ id: userId })');
    expect(analyticsSource).toContain('buildPostHogEuOptions');
    expect(useAuthSource).toContain('mobileAnalytics.syncConsent');
    expect(useAuthSource).toContain('mobileAnalytics.reset()');
    expect(useAuthSource).toContain('setSentryUserId');
    expect(useAuthSource).toContain('authState.profile?.analytics_opt_in === true');
  });

  it('scrubs international spaced/hyphenated and common local phone formats without corrupting UUIDs, decimals, or ISO dates', () => {
    const safeUuid1 = '11111111-1111-4111-8111-111111111104';
    const safeUuid2 = '05012345-1234-4111-8111-111111111104';
    const safeIsoDate = '2026-11-22T15:30:00Z';
    const safeDecimal = '0.123456789';

    const phoneSamples = [
      '+966501234567',
      '+966 50 123 4567',
      '+971-50-123-4567',
      '+1 (415) 555-2671',
      '(+966) 50 123 4567',
      '00966501234567',
      '00966 50 123 4567',
      '0501234567',
      '050 123 4567',
      '050-123-4567',
      '(050) 123 4567',
      '01012345678',
      '010 1234 5678',
      '011-234-5678',
    ];

    for (const phone of phoneSamples) {
      const scrubbed = scrubSensitiveText(`Contact ${phone} regarding ref ${safeUuid2}`);
      expect(scrubbed).not.toContain(phone);
      expect(scrubbed).toContain('[REDACTED_PHONE]');
      expect(scrubbed).toContain(safeUuid2);
    }

    const safePayload = scrubSensitiveText(
      `ids=${safeUuid1},${safeUuid2} ts=${safeIsoDate} ratio=${safeDecimal} code=042`,
    );
    expect(safePayload).toContain(safeUuid1);
    expect(safePayload).toContain(safeUuid2);
    expect(safePayload).toContain(safeIsoDate);
    expect(safePayload).toContain(safeDecimal);
    expect(safePayload).toContain('code=042');
    expect(safePayload).not.toContain('[REDACTED_PHONE]');
  });

  it('guarantees non-blocking bounded teardown on hanging or failing drivers, resets identity across account switching, and dispatches zero events without opt-in', async () => {
    vi.useFakeTimers();
    try {
      const USER_A = '11111111-1111-4111-8111-111111111104';
      const USER_B = '11111111-1111-4111-8111-111111111105';

      // 1. No analytics events ever dispatched when analytics_opt_in !== true
      const callLog: string[] = [];
      const trackingDriver: AnalyticsDriver = {
        identify: (id) => callLog.push(`identify:${id}`),
        capture: (name) => callLog.push(`capture:${name}`),
        screen: (name) => callLog.push(`screen:${name}`),
        optIn: async () => {
          callLog.push('optIn');
        },
        optOut: async () => {
          callLog.push('optOut');
        },
        reset: () => callLog.push('reset'),
        shutdown: async () => {
          callLog.push('shutdown');
        },
      };

      const optedOutService = createAnalyticsService({
        apiKey: 'phc_live_eu_key_999',
        host: 'https://eu.i.posthog.com',
        createDriver: () => trackingDriver,
      });

      await optedOutService.syncConsent({ enabled: false, userId: USER_A });
      optedOutService.trackEvent('pitch_viewed', { pitch_id: 'p1' });
      optedOutService.trackScreen('/pitches');
      expect(optedOutService.isEnabled()).toBe(false);
      expect(callLog).toEqual([]);

      // 2. Account switching (User A -> User B -> signed out / opt-out) resets identity before re-identifying
      await optedOutService.syncConsent({ enabled: true, userId: USER_A });
      await optedOutService.syncConsent({ enabled: true, userId: USER_B });
      await optedOutService.syncConsent({ enabled: false, userId: null });
      optedOutService.trackEvent('should_not_send', {});

      expect(callLog).toEqual([
        'optIn',
        `identify:${USER_A}`,
        'optIn',
        'reset',
        `identify:${USER_B}`,
        'reset',
        'optOut',
        'shutdown',
      ]);
      expect(optedOutService.isEnabled()).toBe(false);

      // 3. Hanging custom driver teardown cannot block sign-out indefinitely
      const hangDriverReset = vi.fn();
      const hangingDriver: AnalyticsDriver = {
        identify: vi.fn(),
        capture: vi.fn(),
        screen: vi.fn(),
        optIn: async () => undefined,
        optOut: () => new Promise<void>(() => {}),
        reset: hangDriverReset,
        shutdown: () => new Promise<void>(() => {}),
      };

      const hangingService = createAnalyticsService({
        apiKey: 'phc_live_eu_key_999',
        host: 'https://eu.i.posthog.com',
        teardownTimeoutMs: 50,
        createDriver: () => hangingDriver,
      });

      await hangingService.syncConsent({ enabled: true, userId: USER_A });
      expect(hangingService.isEnabled()).toBe(true);

      let resetSettled = false;
      const resetPromise = hangingService.reset().then(() => {
        resetSettled = true;
      });
      // Immediately disabled synchronously before timers even finish
      expect(hangingService.isEnabled()).toBe(false);
      expect(hangDriverReset).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(110);
      await resetPromise;
      expect(resetSettled).toBe(true);

      // 4. Failing custom driver & withdrawal during pending optIn() cannot throw or re-identify user
      const identifySpy = vi.fn();
      let resolveOptIn!: () => void;
      const throwingDriver: AnalyticsDriver = {
        identify: identifySpy,
        capture: vi.fn(),
        screen: vi.fn(),
        optIn: () =>
          new Promise<void>((resolve) => {
            resolveOptIn = resolve;
          }),
        optOut: async () => {
          throw new Error('network error');
        },
        reset: () => {
          throw new Error('reset exploded');
        },
        shutdown: async () => {
          throw new Error('shutdown exploded');
        },
      };

      const raceService = createAnalyticsService({
        apiKey: 'phc_live_eu_key_999',
        host: 'https://eu.i.posthog.com',
        teardownTimeoutMs: 50,
        createDriver: () => throwingDriver,
      });

      const pendingSync = raceService.syncConsent({ enabled: true, userId: USER_A });
      const resetPromiseRace = raceService.reset();
      resolveOptIn();
      await Promise.all([pendingSync, resetPromiseRace]);
      expect(identifySpy).not.toHaveBeenCalled();
      expect(raceService.isEnabled()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
