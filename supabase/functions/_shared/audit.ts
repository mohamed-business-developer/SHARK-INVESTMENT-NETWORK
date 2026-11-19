import type { SupabaseClient } from '@supabase/supabase-js';
import type { LiveActorContext } from './auth.ts';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'signedUrl',
  'jwt',
  'authorization',
  'apikey',
  'service_role_key',
]);

export function redactForAudit(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) {
    return null;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key)) {
      clean[key] = '[REDACTED]';
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export async function insertAuditLog(
  adminClient: SupabaseClient,
  params: {
    readonly actor: LiveActorContext | null;
    readonly action: string;
    readonly entityType: string;
    readonly entityId?: string | null;
    readonly previousState?: Record<string, unknown> | null;
    readonly newState?: Record<string, unknown> | null;
    readonly reason?: string | null;
    readonly metadata?: Record<string, unknown>;
    readonly requestId: string;
    readonly ipHash?: string | null;
  },
): Promise<void> {
  const { error } = await adminClient.from('activity_logs').insert({
    actor_id: params.actor?.userId ?? null,
    actor_role: params.actor?.role ?? null,
    actor_admin_role: params.actor?.adminRole?.roleName ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    previous_state: redactForAudit(params.previousState ?? null),
    new_state: redactForAudit(params.newState ?? null),
    reason: params.reason ?? null,
    metadata: redactForAudit(params.metadata ?? {}) ?? {},
    request_id: params.requestId,
    ip_hash: params.ipHash ?? null,
  });

  if (error) {
    throw new Error('Failed to write immutable activity_logs entry');
  }
}
