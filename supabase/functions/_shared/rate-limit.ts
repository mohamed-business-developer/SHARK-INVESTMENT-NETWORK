import type { SupabaseClient } from '@supabase/supabase-js';
import { EdgeFunctionError } from './errors.ts';

export async function enforceRateLimit(
  adminClient: SupabaseClient,
  bucketKey: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<void> {
  const { data: allowed, error } = await adminClient.rpc('check_rate_limit', {
    p_bucket_key: bucketKey,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    throw new EdgeFunctionError(500, 'RATE_LIMIT_ERROR', 'errors.unexpected');
  }

  if (!allowed) {
    throw new EdgeFunctionError(429, 'RATE_LIMITED', 'errors.rateLimited');
  }
}

export async function hashIpAddress(req: Request): Promise<string | null> {
  const rawIp =
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;

  if (!rawIp) {
    return null;
  }

  const salt = Deno.env.get('IP_HASH_SALT') ?? 'shark-audit-salt';
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${rawIp}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
