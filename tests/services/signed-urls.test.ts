import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GetSignedDocumentUrlResponse } from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import {
  computeSignedUrlRefreshDelayMs,
  createSignedUrlController,
  MAX_CONFIDENTIAL_SIGNED_URL_TTL_SECONDS,
  MAX_STANDARD_SIGNED_URL_TTL_SECONDS,
  requestSignedDocumentUrl,
  SIGNED_URL_MEMORY_ONLY_POLICY,
} from '../../apps/mobile/src/services/signed-urls';

const DOC_ID = '44444444-4444-4444-8444-444444444401';
const VERIF_ID = '88888888-8888-4888-8888-888888888801';
const USER_ID = '11111111-1111-4111-8111-111111111103';

type InvokeSupabaseClient = Parameters<typeof requestSignedDocumentUrl>[0];

function createEdgeMockClient(config: {
  authUserId?: string | null;
  invokeImpl: (
    fnName: string,
    opts: { body: unknown },
  ) => Promise<{ data: unknown; error: unknown }>;
}) {
  const invokeCalls: { fnName: string; body: unknown }[] = [];

  const client = {
    auth: {
      getUser: async () =>
        config.authUserId
          ? { data: { user: { id: config.authUserId } }, error: null }
          : { data: { user: null }, error: { status: 401, message: 'Unauthorized' } },
    },
    functions: {
      invoke: async (fnName: string, opts: { body: unknown }) => {
        invokeCalls.push({ fnName, body: opts.body });
        return config.invokeImpl(fnName, opts);
      },
    },
  };

  return {
    invokeCalls,
    client: client as unknown as InvokeSupabaseClient,
  };
}

function makeEdgeHttpError(status: number, code: string, messageKey: string) {
  return {
    context: new Response(
      JSON.stringify({
        error: { code, messageKey, requestId: 'req_test' },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    ),
  };
}

describe('T5-14 Signed URL Service & Auto-Refresh Lifecycle (P5-I05 / P5-S03 prep)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('invokes get-signed-document-url with Zod validation, clamps TTL caps, and drops storagePath for pitch-documents', async () => {
    const nowMs = Date.parse('2026-11-22T12:00:00.000Z');
    const mock = createEdgeMockClient({
      authUserId: USER_ID,
      invokeImpl: async (_fn, opts) => {
        const body = opts.body as { bucket: string };
        const ttl = body.bucket === 'verification-documents' ? 999 : 250; // test strict server/client cap
        return {
          data: {
            signedUrl: `https://example.supabase.co/storage/v1/object/sign/${body.bucket}/obj.pdf?token=secret`,
            expiresAt: new Date(nowMs + ttl * 1000).toISOString(),
            ttlSeconds: Math.min(ttl, 120),
            contentType: 'application/pdf',
            fileName: 'deck.pdf',
          },
          error: null,
        };
      },
    });

    // Reject traversal / bad UUID / invalid bucket before Edge call
    await expect(
      requestSignedDocumentUrl(mock.client, {
        bucket: 'public-assets' as unknown as 'pitch-documents',
        documentId: DOC_ID,
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(mock.invokeCalls).toHaveLength(0);

    // For pitch-documents, storagePath is intentionally omitted (server resolves from documentId)
    const pitchUrl = await requestSignedDocumentUrl(
      mock.client,
      {
        bucket: 'pitch-documents',
        documentId: DOC_ID,
        storagePath: 'ignored/by/client.pdf',
      },
      nowMs,
    );
    expect(mock.invokeCalls[0]).toEqual({
      fnName: 'get-signed-document-url',
      body: { bucket: 'pitch-documents', documentId: DOC_ID },
    });
    expect(pitchUrl.ttlSeconds).toBeLessThanOrEqual(MAX_STANDARD_SIGNED_URL_TTL_SECONDS);
    expect(Date.parse(pitchUrl.expiresAt)).toBe(nowMs + MAX_STANDARD_SIGNED_URL_TTL_SECONDS * 1000);

    // For verification-documents, TTL capped at 60s and validated storagePath is forwarded
    const verifUrl = await requestSignedDocumentUrl(
      mock.client,
      {
        bucket: 'verification-documents',
        documentId: VERIF_ID,
        storagePath: `${USER_ID}/${VERIF_ID}/kyc.pdf`,
      },
      nowMs,
    );
    expect(mock.invokeCalls[1]).toEqual({
      fnName: 'get-signed-document-url',
      body: {
        bucket: 'verification-documents',
        documentId: VERIF_ID,
        storagePath: `${USER_ID}/${VERIF_ID}/kyc.pdf`,
      },
    });
    expect(verifUrl.ttlSeconds).toBeLessThanOrEqual(MAX_CONFIDENTIAL_SIGNED_URL_TTL_SECONDS);
    expect(Date.parse(verifUrl.expiresAt)).toBe(
      nowMs + MAX_CONFIDENTIAL_SIGNED_URL_TTL_SECONDS * 1000,
    );

    // Rejects unsafe non-HTTPS remote URL schemes (e.g., javascript:, file:, remote http)
    const unsafeMock = createEdgeMockClient({
      authUserId: USER_ID,
      invokeImpl: async () => ({
        data: {
          signedUrl: 'javascript:alert(1)',
          expiresAt: new Date(nowMs + 60_000).toISOString(),
          ttlSeconds: 60,
          contentType: 'application/pdf',
          fileName: 'deck.pdf',
        },
        error: null,
      }),
    });
    await expect(
      requestSignedDocumentUrl(
        unsafeMock.client,
        { bucket: 'pitch-documents', documentId: DOC_ID },
        nowMs,
      ),
    ).rejects.toMatchObject({ code: 'SIGNED_URL_FAILED', statusCode: 500 });

    // Local Docker Supabase URL (127.0.0.1) is permitted for Tier 2 integration tests
    const localMock = createEdgeMockClient({
      authUserId: USER_ID,
      invokeImpl: async () => ({
        data: {
          signedUrl:
            'http://127.0.0.1:54321/storage/v1/object/sign/pitch-documents/a.pdf?token=local',
          expiresAt: new Date(nowMs + 60_000).toISOString(),
          ttlSeconds: 60,
          contentType: 'application/pdf',
          fileName: 'a.pdf',
        },
        error: null,
      }),
    });
    const localRes = await requestSignedDocumentUrl(
      localMock.client,
      { bucket: 'pitch-documents', documentId: DOC_ID },
      nowMs,
    );
    expect(localRes.signedUrl).toContain('127.0.0.1:54321');
  });

  it('normalizes 403 quarantined / forbidden / 404 / 429 Edge Function responses cleanly', async () => {
    const quarantinedClient = createEdgeMockClient({
      authUserId: USER_ID,
      invokeImpl: async () => ({
        data: null,
        error: makeEdgeHttpError(403, 'DOCUMENT_QUARANTINED', 'errors.documentQuarantined'),
      }),
    });
    await expect(
      requestSignedDocumentUrl(quarantinedClient.client, {
        bucket: 'pitch-documents',
        documentId: DOC_ID,
      }),
    ).rejects.toMatchObject({
      code: 'DOCUMENT_QUARANTINED',
      messageKey: 'errors.documentQuarantined',
      statusCode: 403,
    });

    const rateLimitClient = createEdgeMockClient({
      authUserId: USER_ID,
      invokeImpl: async () => ({
        data: null,
        error: makeEdgeHttpError(429, 'RATE_LIMITED', 'errors.rateLimited'),
      }),
    });
    await expect(
      requestSignedDocumentUrl(rateLimitClient.client, {
        bucket: 'pitch-documents',
        documentId: DOC_ID,
      }),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      messageKey: 'errors.rateLimited',
      statusCode: 429,
    });

    const unauthClient = createEdgeMockClient({
      authUserId: null,
      invokeImpl: async () => ({ data: null, error: null }),
    });
    await expect(
      requestSignedDocumentUrl(unauthClient.client, {
        bucket: 'pitch-documents',
        documentId: DOC_ID,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
    expect(unauthClient.invokeCalls).toHaveLength(0);
  });

  it('auto-refreshes proactively at expiresAt - 10s while active and purges/locks immediately on 403, 404, 429, or unmount', async () => {
    vi.useFakeTimers();
    const baseTime = Date.parse('2026-11-22T12:00:00.000Z');
    vi.setSystemTime(baseTime);

    expect(SIGNED_URL_MEMORY_ONLY_POLICY).toEqual({ staleTime: 0, gcTime: 0 });
    expect(computeSignedUrlRefreshDelayMs(baseTime + 60_000, baseTime)).toBe(50_000);
    expect(computeSignedUrlRefreshDelayMs(baseTime + 120_000, baseTime)).toBe(110_000);
    expect(computeSignedUrlRefreshDelayMs(baseTime + 6_000, baseTime)).toBe(3_000);

    let callCount = 0;
    let nextFailure: AppDomainError | null = null;

    const fetchSignedUrl = vi.fn(async (): Promise<GetSignedDocumentUrlResponse> => {
      callCount += 1;
      if (nextFailure) {
        throw nextFailure;
      }
      const ttl = 60;
      return {
        signedUrl: `https://example.supabase.co/storage/v1/object/sign/pitch-documents/doc.pdf?token=v${callCount}`,
        expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        ttlSeconds: ttl,
        contentType: 'application/pdf',
        fileName: 'doc.pdf',
      };
    });

    const controller = createSignedUrlController({ fetchSignedUrl });
    controller.setTarget({
      bucket: 'pitch-documents',
      documentId: DOC_ID,
      enabled: true,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().data?.signedUrl).toContain('token=v1');
    expect(fetchSignedUrl).toHaveBeenCalledTimes(1);

    // At 49s (1s before refresh buffer), still holds v1 without premature fetch
    await vi.advanceTimersByTimeAsync(49_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(1);

    // At 50s (`expiresAt - 10_000 ms`), proactive refresh fetches v2
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(2);
    expect(controller.getState().data?.signedUrl).toContain('token=v2');

    // Mid-session revocation / quarantine clears signedUrl from RAM immediately and stops timers
    nextFailure = new AppDomainError({
      code: 'DOCUMENT_QUARANTINED',
      messageKey: 'errors.documentQuarantined',
      statusCode: 403,
    });
    await vi.advanceTimersByTimeAsync(50_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(3);
    expect(controller.getState().status).toBe('locked');
    expect(controller.getState().isLocked).toBe(true);
    expect(controller.getState().data).toBeNull();
    expect(controller.getState().error?.code).toBe('DOCUMENT_QUARANTINED');

    // Subsequent timer advancement does NOT poll locked document
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(3);

    // Recovery on new document clears lock, tests background expiration purge, and tests unmount disposal
    nextFailure = null;
    controller.setTarget({
      bucket: 'verification-documents',
      documentId: VERIF_ID,
      storagePath: `${USER_ID}/${VERIF_ID}/id.pdf`,
      enabled: true,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().status).toBe('ready');
    expect(controller.getState().data?.signedUrl).toContain('token=v4');

    // Move viewer to background -> does NOT refresh at 50s, and wipes expired URL at 60s
    controller.setActive(false);
    await vi.advanceTimersByTimeAsync(50_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(4);
    expect(controller.getState().data?.signedUrl).toContain('token=v4');

    await vi.advanceTimersByTimeAsync(10_000);
    expect(controller.getState().data).toBeNull();

    // Returning to active refreshes immediately
    controller.setActive(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(controller.getState().data?.signedUrl).toContain('token=v5');

    // Unmount disposal clears RAM immediately and cancels pending timers
    controller.dispose();
    expect(controller.getState().data).toBeNull();
    expect(controller.getState().status).toBe('idle');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchSignedUrl).toHaveBeenCalledTimes(5);
  });

  it('verifies useSignedDocumentUrl enforces Approved-only pitch access and non-suspended verification access', () => {
    const hookSource = readFileSync(
      resolve(import.meta.dirname, '../../apps/mobile/src/hooks/useSignedDocumentUrl.ts'),
      'utf8',
    );
    expect(hookSource).toContain("bucket === 'pitch-documents'");
    expect(hookSource).toContain('Boolean(userId) && isApproved');
    expect(hookSource).toContain("status !== 'suspended'");
    expect(hookSource).toContain('controller.dispose()');
    expect(hookSource).toContain('SIGNED_URL_MEMORY_ONLY_POLICY');
  });
});
