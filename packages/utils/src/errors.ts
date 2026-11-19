import type { ApiErrorEnvelope } from '@shark/shared-types';

export class AppDomainError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly statusCode: number;
  readonly requestId: string;

  constructor(options: {
    code: string;
    messageKey: string;
    statusCode?: number;
    requestId?: string;
    message?: string;
  }) {
    super(options.message ?? options.messageKey);
    this.name = 'AppDomainError';
    this.code = options.code;
    this.messageKey = options.messageKey;
    this.statusCode = options.statusCode ?? 400;
    this.requestId = options.requestId ?? 'req_local';
  }

  toEnvelope(): ApiErrorEnvelope {
    return {
      error: {
        code: this.code,
        messageKey: this.messageKey,
        requestId: this.requestId,
      },
    };
  }
}

const KNOWN_DB_CODE_MAP: Record<string, { code: string; messageKey: string; statusCode: number }> =
  {
    '42501': { code: 'FORBIDDEN', messageKey: 'errors.forbidden', statusCode: 403 },
    '23505': { code: 'CONFLICT', messageKey: 'errors.duplicateRecord', statusCode: 409 },
    '23503': { code: 'BAD_REQUEST', messageKey: 'errors.invalidReference', statusCode: 400 },
    '23514': { code: 'VALIDATION_ERROR', messageKey: 'errors.validationFailed', statusCode: 400 },
    PGRST116: { code: 'NOT_FOUND', messageKey: 'errors.notFound', statusCode: 404 },
  };

/**
 * Normalizes unknown backend/PostgreSQL errors into client-safe envelopes without leaking raw SQL.
 */
export function normalizeErrorToEnvelope(
  err: unknown,
  requestId = 'req_unknown',
): { statusCode: number; envelope: ApiErrorEnvelope } {
  if (err instanceof AppDomainError) {
    return {
      statusCode: err.statusCode,
      envelope: {
        error: {
          code: err.code,
          messageKey: err.messageKey,
          requestId: err.requestId === 'req_local' ? requestId : err.requestId,
        },
      },
    };
  }

  if (typeof err === 'object' && err !== null && 'code' in err) {
    const rawCode = String((err as { code: unknown }).code);
    const mapped = KNOWN_DB_CODE_MAP[rawCode];
    if (mapped) {
      return {
        statusCode: mapped.statusCode,
        envelope: {
          error: {
            code: mapped.code,
            messageKey: mapped.messageKey,
            requestId,
          },
        },
      };
    }
  }

  return {
    statusCode: 500,
    envelope: {
      error: {
        code: 'INTERNAL_ERROR',
        messageKey: 'errors.unexpected',
        requestId,
      },
    },
  };
}
