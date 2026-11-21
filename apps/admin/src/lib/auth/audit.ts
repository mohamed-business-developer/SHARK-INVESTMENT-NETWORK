import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AdminRoleName, UserRole } from '@shark/shared-types';
import { AppDomainError } from '@shark/utils';
import type { AdminActorContext } from './verify-admin-actor';

export interface AdminRequestAuditMetadata {
  readonly requestId: string;
  readonly ipHash: string | null;
}

/**
 * Extracts correlation ID and one-way SHA-256 IP hash without storing raw client IP PII.
 */
export function buildAdminRequestAuditMetadata(requestHeaders: Headers): AdminRequestAuditMetadata {
  const rawForwardedFor = requestHeaders.get('x-forwarded-for');
  const firstForwardedIp = rawForwardedFor?.split(',')[0]?.trim();
  const rawRealIp = requestHeaders.get('x-real-ip')?.trim();
  const ipCandidate = firstForwardedIp || rawRealIp || null;

  return {
    requestId: randomUUID(),
    ipHash: ipCandidate ? createHash('sha256').update(ipCandidate).digest('hex') : null,
  };
}

/**
 * Appends an immutable `activity_logs` row bound strictly to the server-verified actor identity.
 * Throws fail-closed `AUDIT_PERSISTENCE_FAILED` on insert errors.
 */
export async function recordVerifiedAdminAuthAudit(
  serviceClient: SupabaseClient,
  params: {
    readonly actor: AdminActorContext | null;
    readonly fallbackActorId?: string | null;
    readonly fallbackActorRole?: UserRole | null;
    readonly action: 'admin.login' | 'admin.logout' | 'admin.login_denied';
    readonly metadata?: Record<string, unknown>;
    readonly requestHeaders: Headers;
  },
): Promise<void> {
  const { requestId, ipHash } = buildAdminRequestAuditMetadata(params.requestHeaders);
  const actorId = params.actor ? params.actor.userId : (params.fallbackActorId ?? null);
  const actorRole: UserRole | null = params.actor ? 'admin' : (params.fallbackActorRole ?? null);
  const actorAdminRole: AdminRoleName | null = params.actor ? params.actor.roleName : null;

  const { error } = await serviceClient.from('activity_logs').insert({
    actor_id: actorId,
    actor_role: actorRole,
    actor_admin_role: actorAdminRole,
    action: params.action,
    entity_type: 'auth_session',
    entity_id: actorId,
    metadata: params.metadata ?? {},
    request_id: requestId,
    ip_hash: ipHash,
  });

  if (error) {
    throw new AppDomainError({
      code: 'AUDIT_PERSISTENCE_FAILED',
      messageKey: 'errors.auditWriteFailed',
      statusCode: 500,
      requestId,
    });
  }
}
