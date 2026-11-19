import { buildCorsHeaders } from './cors.ts';

export class EdgeFunctionError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly messageKey: string;

  constructor(statusCode: number, code: string, messageKey: string, logMessage?: string) {
    super(logMessage ?? messageKey);
    this.statusCode = statusCode;
    this.code = code;
    this.messageKey = messageKey;
  }
}

export function jsonResponse(req: Request, statusCode: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export function handleEdgeError(
  req: Request,
  route: string,
  requestId: string,
  err: unknown,
  actorId?: string,
): Response {
  if (err instanceof EdgeFunctionError) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        requestId,
        route,
        actorId: actorId ?? null,
        statusCode: err.statusCode,
        errorCode: err.code,
      }),
    );

    return jsonResponse(req, err.statusCode, {
      error: {
        code: err.code,
        messageKey: err.messageKey,
        requestId,
      },
    });
  }

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId,
      route,
      actorId: actorId ?? null,
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
    }),
  );

  return jsonResponse(req, 500, {
    error: {
      code: 'INTERNAL_ERROR',
      messageKey: 'errors.unexpected',
      requestId,
    },
  });
}
