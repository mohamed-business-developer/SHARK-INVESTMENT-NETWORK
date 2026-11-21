import { AppDomainError, normalizeErrorToEnvelope } from '@shark/utils';

export type RevokedAccessReason = 'unauthorized' | 'suspended';
export type RevokedAccessHandler = (reason: RevokedAccessReason) => void | Promise<void>;

let globalRevokedAccessHandler: RevokedAccessHandler | null = null;

/**
 * Registers the active AuthProvider callback invoked on global 401/ACCOUNT_SUSPENDED detection.
 */
export function registerRevokedAccessHandler(handler: RevokedAccessHandler | null): () => void {
  globalRevokedAccessHandler = handler;
  return () => {
    if (globalRevokedAccessHandler === handler) {
      globalRevokedAccessHandler = null;
    }
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const val = record[key];
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const val = record[key];
  return typeof val === 'number' && Number.isFinite(val) ? val : undefined;
}

function mapCodeToDomainError(
  code: string | undefined,
  messageKey: string | undefined,
  statusCode: number | undefined,
  requestId: string,
): AppDomainError | null {
  const normalizedCode = code?.toUpperCase();

  if (normalizedCode === 'ACCOUNT_SUSPENDED' || messageKey === 'errors.accountSuspended') {
    return new AppDomainError({
      code: 'ACCOUNT_SUSPENDED',
      messageKey: 'errors.accountSuspended',
      statusCode: 403,
      requestId,
    });
  }

  if (
    normalizedCode === 'INVALID_CREDENTIALS' ||
    code === 'invalid_credentials' ||
    messageKey === 'errors.invalidCredentials'
  ) {
    return new AppDomainError({
      code: 'INVALID_CREDENTIALS',
      messageKey: 'errors.invalidCredentials',
      statusCode: 401,
      requestId,
    });
  }

  if (
    normalizedCode === 'UNAUTHORIZED' ||
    statusCode === 401 ||
    code === 'refresh_token_not_found' ||
    code === 'session_not_found'
  ) {
    return new AppDomainError({
      code: 'UNAUTHORIZED',
      messageKey: 'errors.unauthorized',
      statusCode: 401,
      requestId,
    });
  }

  if (normalizedCode && messageKey && messageKey.startsWith('errors.')) {
    return new AppDomainError({
      code: normalizedCode,
      messageKey,
      statusCode: statusCode ?? 400,
      requestId,
    });
  }

  if (normalizedCode && messageKey && messageKey.startsWith('validation.')) {
    return new AppDomainError({
      code: normalizedCode,
      messageKey,
      statusCode: 400,
      requestId,
    });
  }

  return null;
}

async function tryParseEdgeErrorResponse(
  record: Record<string, unknown>,
  requestId: string,
): Promise<AppDomainError | null> {
  const context = record.context;
  if (typeof Response !== 'undefined' && context instanceof Response) {
    const status = context.status;
    try {
      const cloned = context.clone();
      const body: unknown = await cloned.json();
      const bodyRec = asRecord(body);
      const errRec = asRecord(bodyRec?.error);
      if (errRec) {
        const mapped = mapCodeToDomainError(
          readString(errRec, 'code'),
          readString(errRec, 'messageKey'),
          status,
          readString(errRec, 'requestId') ?? requestId,
        );
        if (mapped) {
          return mapped;
        }
      }
    } catch {
      // Non-JSON Edge Function error response; inspect status code safely
    }

    if (status === 401) {
      return new AppDomainError({
        code: 'UNAUTHORIZED',
        messageKey: 'errors.unauthorized',
        statusCode: 401,
        requestId,
      });
    }
    if (status === 429) {
      return new AppDomainError({
        code: 'RATE_LIMITED',
        messageKey: 'errors.rateLimited',
        statusCode: 429,
        requestId,
      });
    }
    if (status === 403) {
      return new AppDomainError({
        code: 'FORBIDDEN',
        messageKey: 'errors.forbidden',
        statusCode: 403,
        requestId,
      });
    }
  }
  return null;
}

/**
 * Normalizes PostgREST, Supabase Auth, Edge Function, or domain errors into a client-safe AppDomainError.
 */
export async function normalizeSupabaseError(
  err: unknown,
  requestId = 'req_mobile',
): Promise<AppDomainError> {
  if (err instanceof AppDomainError) {
    return err;
  }

  const record = asRecord(err);
  if (record) {
    const edgeMapped = await tryParseEdgeErrorResponse(record, requestId);
    if (edgeMapped) {
      return edgeMapped;
    }

    const code = readString(record, 'code');
    const status = readNumber(record, 'status') ?? readNumber(record, 'statusCode');
    const messageKey = readString(record, 'messageKey');
    const directMapped = mapCodeToDomainError(code, messageKey, status, requestId);
    if (directMapped) {
      return directMapped;
    }

    const rawMessage = readString(record, 'message')?.toLowerCase() ?? '';
    if (
      rawMessage.includes('invalid login credentials') ||
      rawMessage.includes('invalid_credentials')
    ) {
      return new AppDomainError({
        code: 'INVALID_CREDENTIALS',
        messageKey: 'errors.invalidCredentials',
        statusCode: 401,
        requestId,
      });
    }
    if (rawMessage.includes('rate limit') || status === 429) {
      return new AppDomainError({
        code: 'RATE_LIMITED',
        messageKey: 'errors.rateLimited',
        statusCode: 429,
        requestId,
      });
    }
  }

  const { statusCode, envelope } = normalizeErrorToEnvelope(err, requestId);
  return new AppDomainError({
    code: envelope.error.code,
    messageKey: envelope.error.messageKey,
    statusCode,
    requestId: envelope.error.requestId,
  });
}

async function notifyIfRevoked(
  domainError: AppDomainError,
  overrideHandler?: RevokedAccessHandler,
): Promise<void> {
  const handler = overrideHandler ?? globalRevokedAccessHandler;
  if (!handler) {
    return;
  }
  if (domainError.code === 'ACCOUNT_SUSPENDED') {
    await handler('suspended');
    return;
  }
  if (domainError.code === 'UNAUTHORIZED') {
    await handler('unauthorized');
  }
}

export interface ServiceCallOptions {
  readonly requestId?: string;
  readonly onRevokedAccess?: RevokedAccessHandler;
}

export type SupabaseResultLike<TData> =
  | { readonly data: TData; readonly error?: null }
  | { readonly data: unknown; readonly error: NonNullable<unknown> };

/**
 * Throws a normalized AppDomainError when a Supabase `{ data, error }` response carries an error.
 */
export async function assertSupabaseResult<TData>(
  result: SupabaseResultLike<TData>,
  options?: ServiceCallOptions,
): Promise<TData> {
  if (result.error !== null && result.error !== undefined) {
    const domainError = await normalizeSupabaseError(result.error, options?.requestId);
    await notifyIfRevoked(domainError, options?.onRevokedAccess);
    throw domainError;
  }
  return result.data;
}

/**
 * Wraps asynchronous service calls, translating raw SDK/backend errors into localized AppDomainError.
 */
export async function executeServiceCall<T>(
  operation: () => Promise<T>,
  options?: ServiceCallOptions,
): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    const domainError = await normalizeSupabaseError(err, options?.requestId);
    await notifyIfRevoked(domainError, options?.onRevokedAccess);
    throw domainError;
  }
}
