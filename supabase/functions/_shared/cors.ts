const DEFAULT_DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function buildCorsHeaders(req: Request): Record<string, string> {
  const requestOrigin = req.headers.get('origin');
  const configured = (Deno.env.get('ADMIN_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowlist = [...DEFAULT_DEV_ORIGINS, ...configured];
  const allowedOrigin =
    requestOrigin && allowlist.includes(requestOrigin)
      ? requestOrigin
      : (allowlist[0] ?? 'http://localhost:3000');

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-internal-service-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    Pragma: 'no-cache',
    Vary: 'Origin',
  };
}
