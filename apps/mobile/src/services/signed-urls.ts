import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  GetSignedDocumentUrlRequest,
  GetSignedDocumentUrlResponse,
} from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import { getSignedDocumentUrlSchema } from '@shark/validation';
import { z } from 'zod';
import { requireAuthenticatedUser } from '../repositories/helpers';
import { executeServiceCall, normalizeSupabaseError } from './service-client';

export const SIGNED_URL_REFRESH_BUFFER_MS = 10_000;
export const MAX_STANDARD_SIGNED_URL_TTL_SECONDS = 120;
export const MAX_CONFIDENTIAL_SIGNED_URL_TTL_SECONDS = 60;

export const SIGNED_URL_MEMORY_ONLY_POLICY = Object.freeze({
  staleTime: 0,
  gcTime: 0,
} as const);

const LOCKING_STATUS_CODES = new Set([401, 403, 404, 429]);
const LOCKING_ERROR_CODES = new Set([
  'UNAUTHORIZED',
  'FORBIDDEN',
  'DOCUMENT_QUARANTINED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_NOT_APPROVED',
  'NOT_FOUND',
  'RATE_LIMITED',
]);

function isAllowedSignedDownloadUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'http:') {
      const host = parsed.hostname.toLowerCase();
      return host === '127.0.0.1' || host === 'localhost' || host === '10.0.2.2';
    }
    return false;
  } catch {
    return false;
  }
}

const signedUrlResponseSchema = z
  .object({
    signedUrl: z.string().min(1).max(2048).refine(isAllowedSignedDownloadUrl, 'errors.unexpected'),
    expiresAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'errors.unexpected'),
    ttlSeconds: z.number().int().min(1).max(MAX_STANDARD_SIGNED_URL_TTL_SECONDS),
    contentType: z.string().min(1).max(160),
    fileName: z
      .string()
      .min(1)
      .max(255)
      .refine((v) => !v.includes('/') && !v.includes('\\'), 'errors.unexpected'),
  })
  .strict();

function normalizeSignedUrlPayload(
  raw: unknown,
  bucket: GetSignedDocumentUrlRequest['bucket'],
  nowMs: number,
): GetSignedDocumentUrlResponse {
  const parsed = signedUrlResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppDomainError({
      code: 'SIGNED_URL_FAILED',
      messageKey: 'errors.unexpected',
      statusCode: 500,
    });
  }

  const maxAllowedTtl =
    bucket === 'verification-documents'
      ? MAX_CONFIDENTIAL_SIGNED_URL_TTL_SECONDS
      : MAX_STANDARD_SIGNED_URL_TTL_SECONDS;
  const clampedTtl = Math.min(parsed.data.ttlSeconds, maxAllowedTtl);
  const serverExpiresMs = Date.parse(parsed.data.expiresAt);
  const hardCeilingMs = nowMs + clampedTtl * 1000;
  const effectiveExpiresMs = Math.min(serverExpiresMs, hardCeilingMs);

  if (!Number.isFinite(effectiveExpiresMs) || effectiveExpiresMs <= nowMs) {
    throw new AppDomainError({
      code: 'SIGNED_URL_FAILED',
      messageKey: 'errors.unexpected',
      statusCode: 500,
    });
  }

  return {
    signedUrl: parsed.data.signedUrl,
    expiresAt: new Date(effectiveExpiresMs).toISOString(),
    ttlSeconds: clampedTtl,
    contentType: parsed.data.contentType,
    fileName: parsed.data.fileName,
  };
}

/**
 * Invokes Edge Function `get-signed-document-url` to obtain a short-lived (60s–120s) Signed URL.
 * Never passes client `storagePath` on `pitch-documents` (server resolves path from `documentId`).
 */
export async function requestSignedDocumentUrl(
  client: SupabaseClient,
  input: GetSignedDocumentUrlRequest,
  nowMs: number = Date.now(),
): Promise<GetSignedDocumentUrlResponse> {
  const parsed = getSignedDocumentUrlSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    throw new AppDomainError({
      code: 'VALIDATION_ERROR',
      messageKey: firstIssue?.message ?? 'errors.validationFailed',
      statusCode: 400,
    });
  }

  const requestBody: GetSignedDocumentUrlRequest =
    parsed.data.bucket === 'verification-documents' && parsed.data.storagePath
      ? {
          bucket: parsed.data.bucket,
          documentId: parsed.data.documentId,
          storagePath: parsed.data.storagePath,
        }
      : {
          bucket: parsed.data.bucket,
          documentId: parsed.data.documentId,
        };

  return executeServiceCall(async () => {
    await requireAuthenticatedUser(client);
    const { data, error } = await client.functions.invoke<unknown>('get-signed-document-url', {
      body: requestBody,
    });

    if (error) {
      throw await normalizeSupabaseError(error);
    }

    return normalizeSignedUrlPayload(data, requestBody.bucket, nowMs);
  });
}

/**
 * Computes delay before proactive refresh (`expiresAt - 10_000 ms`, floored safely for short TTLs).
 */
export function computeSignedUrlRefreshDelayMs(
  expiresAtMs: number,
  nowMs: number = Date.now(),
  bufferMs: number = SIGNED_URL_REFRESH_BUFFER_MS,
): number {
  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs <= 0) {
    return 0;
  }
  if (remainingMs > bufferMs) {
    return remainingMs - bufferMs;
  }
  return Math.max(250, Math.floor(remainingMs / 2));
}

export function isSignedUrlLockingError(error: AppDomainError): boolean {
  return (
    LOCKING_STATUS_CODES.has(error.statusCode) || LOCKING_ERROR_CODES.has(error.code.toUpperCase())
  );
}

export type SignedUrlControllerStatus = 'idle' | 'loading' | 'ready' | 'locked' | 'error';

export interface SignedDocumentUrlState {
  readonly status: SignedUrlControllerStatus;
  readonly data: GetSignedDocumentUrlResponse | null;
  readonly error: AppDomainError | null;
  readonly isLocked: boolean;
}

export interface SignedUrlTarget {
  readonly bucket: GetSignedDocumentUrlRequest['bucket'];
  readonly documentId: string | null;
  readonly storagePath?: string | null;
  readonly enabled: boolean;
}

export interface SignedUrlController {
  readonly getState: () => SignedDocumentUrlState;
  readonly subscribe: (listener: (state: SignedDocumentUrlState) => void) => () => void;
  readonly setTarget: (target: SignedUrlTarget) => void;
  readonly setActive: (active: boolean) => void;
  readonly refreshNow: () => Promise<void>;
  readonly dispose: () => void;
}

export interface CreateSignedUrlControllerOptions {
  readonly fetchSignedUrl: (
    request: GetSignedDocumentUrlRequest,
  ) => Promise<GetSignedDocumentUrlResponse>;
  readonly bufferMs?: number;
  readonly now?: () => number;
}

/**
 * Memory-only lifecycle controller that keeps a Signed URL exclusively in RAM, schedules proactive
 * refresh `10s` before expiry while active, and clears/locks immediately on revocation, quarantine,
 * rate limit, expiration, or disposal.
 */
export function createSignedUrlController(
  options: CreateSignedUrlControllerOptions,
): SignedUrlController {
  const bufferMs = options.bufferMs ?? SIGNED_URL_REFRESH_BUFFER_MS;
  const getNow = options.now ?? (() => Date.now());
  const listeners = new Set<(state: SignedDocumentUrlState) => void>();

  let state: SignedDocumentUrlState = {
    status: 'idle',
    data: null,
    error: null,
    isLocked: false,
  };
  let target: SignedUrlTarget = {
    bucket: 'pitch-documents',
    documentId: null,
    storagePath: null,
    enabled: false,
  };
  let active = true;
  let disposed = false;
  let requestVersion = 0;
  let expiresAtMs: number | null = null;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (nextState: SignedDocumentUrlState) => {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
  };

  const clearTimers = () => {
    if (refreshTimer !== null) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    if (expiryTimer !== null) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  };

  const purgeMemory = (
    nextStatus: SignedUrlControllerStatus,
    nextError: AppDomainError | null,
    isLocked: boolean,
  ) => {
    clearTimers();
    expiresAtMs = null;
    emit({
      status: nextStatus,
      data: null,
      error: nextError,
      isLocked,
    });
  };

  const scheduleLifecycleTimers = (nextExpiresAtMs: number) => {
    clearTimers();
    const currentNow = getNow();
    const msUntilExpiry = Math.max(0, nextExpiresAtMs - currentNow);

    // Hard safety timer guarantees expired URLs never remain in RAM even while backgrounded.
    expiryTimer = setTimeout(() => {
      if (disposed) {
        return;
      }
      if (active && target.enabled && target.documentId && !state.isLocked) {
        void executeFetch();
        return;
      }
      purgeMemory('idle', null, false);
    }, msUntilExpiry);

    if (active && target.enabled && target.documentId) {
      const refreshDelay = computeSignedUrlRefreshDelayMs(nextExpiresAtMs, currentNow, bufferMs);
      refreshTimer = setTimeout(() => {
        if (!disposed && active && target.enabled && !state.isLocked) {
          void executeFetch();
        }
      }, refreshDelay);
    }
  };

  const executeFetch = async (): Promise<void> => {
    if (disposed || !target.enabled || !target.documentId) {
      purgeMemory('idle', null, false);
      return;
    }

    const version = ++requestVersion;
    const isInitialLoad = state.data === null;
    if (isInitialLoad) {
      emit({
        status: 'loading',
        data: null,
        error: null,
        isLocked: false,
      });
    }

    const payload: GetSignedDocumentUrlRequest =
      target.bucket === 'verification-documents' && target.storagePath
        ? {
            bucket: target.bucket,
            documentId: target.documentId,
            storagePath: target.storagePath,
          }
        : {
            bucket: target.bucket,
            documentId: target.documentId,
          };

    try {
      const response = await options.fetchSignedUrl(payload);
      if (disposed || version !== requestVersion || !target.enabled) {
        return;
      }

      const parsedExpiry = Date.parse(response.expiresAt);
      if (Number.isNaN(parsedExpiry) || parsedExpiry <= getNow()) {
        purgeMemory(
          'error',
          new AppDomainError({
            code: 'SIGNED_URL_FAILED',
            messageKey: 'errors.unexpected',
            statusCode: 500,
          }),
          false,
        );
        return;
      }

      expiresAtMs = parsedExpiry;
      emit({
        status: 'ready',
        data: response,
        error: null,
        isLocked: false,
      });
      scheduleLifecycleTimers(parsedExpiry);
    } catch (err) {
      if (disposed || version !== requestVersion) {
        return;
      }
      const domainError =
        err instanceof AppDomainError ? err : await normalizeSupabaseError(err, 'req_signed_url');
      if (disposed || version !== requestVersion) {
        return;
      }

      if (isSignedUrlLockingError(domainError)) {
        purgeMemory('locked', domainError, true);
        return;
      }
      purgeMemory('error', domainError, false);
    }
  };

  const isSameTarget = (a: SignedUrlTarget, b: SignedUrlTarget): boolean =>
    a.bucket === b.bucket &&
    a.documentId === b.documentId &&
    (a.storagePath ?? null) === (b.storagePath ?? null) &&
    a.enabled === b.enabled;

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    setTarget(nextTarget) {
      if (disposed) {
        return;
      }
      const normalizedTarget: SignedUrlTarget = {
        bucket: nextTarget.bucket,
        documentId: nextTarget.documentId?.trim() || null,
        storagePath:
          nextTarget.bucket === 'verification-documents'
            ? nextTarget.storagePath?.trim() || null
            : null,
        enabled: Boolean(nextTarget.enabled && nextTarget.documentId?.trim()),
      };

      if (isSameTarget(target, normalizedTarget)) {
        return;
      }

      target = normalizedTarget;
      requestVersion += 1;
      if (!target.enabled || !target.documentId) {
        purgeMemory('idle', null, false);
        return;
      }

      purgeMemory('loading', null, false);
      if (active) {
        void executeFetch();
      }
    },

    setActive(nextActive) {
      if (disposed || active === nextActive) {
        return;
      }
      active = nextActive;

      if (!active) {
        if (refreshTimer !== null) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        return;
      }

      if (!target.enabled || !target.documentId || state.isLocked) {
        return;
      }

      const currentNow = getNow();
      if (state.data === null || expiresAtMs === null || currentNow >= expiresAtMs - bufferMs) {
        void executeFetch();
        return;
      }

      scheduleLifecycleTimers(expiresAtMs);
    },

    async refreshNow() {
      if (disposed || !target.enabled || !target.documentId) {
        return;
      }
      await executeFetch();
    },

    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      requestVersion += 1;
      clearTimers();
      expiresAtMs = null;
      state = {
        status: 'idle',
        data: null,
        error: null,
        isLocked: false,
      };
      listeners.clear();
    },
  };
}
