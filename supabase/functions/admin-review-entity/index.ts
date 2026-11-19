import { z } from 'zod';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  assertActiveAdminScope,
  createServiceAdminClient,
  requireAuthenticatedActor,
} from '../_shared/auth.ts';
import { EdgeFunctionError, handleEdgeError, jsonResponse } from '../_shared/errors.ts';
import { enforceRateLimit, hashIpAddress } from '../_shared/rate-limit.ts';
import { parseJsonBody, uuidSchema } from '../_shared/validation.ts';

const ALLOWED_DECISIONS: Record<
  'company' | 'verification_request' | 'pitch' | 'pitch_document',
  readonly string[]
> = {
  company: ['approved', 'rejected', 'suspended', 'needs_info', 'verified', 'unverified'],
  verification_request: ['pending', 'needs_info', 'approved', 'rejected'],
  pitch: [
    'approved',
    'approved_restricted',
    'restricted',
    'unrestricted',
    'needs_info',
    'rejected',
    'closed',
  ],
  pitch_document: ['restricted', 'unrestricted', 'disabled'],
};

const DECISIONS_REQUIRING_REASON = new Set([
  'rejected',
  'suspended',
  'restricted',
  'needs_info',
  'disabled',
]);

const reviewEntitySchema = z
  .object({
    entityType: z.enum(['company', 'verification_request', 'pitch', 'pitch_document']),
    entityId: uuidSchema,
    decision: z.string().trim().min(2).max(40),
    reason: z.string().trim().min(1).max(500).optional(),
    feedbackAr: z.string().trim().min(1).max(1000).optional(),
    feedbackEn: z.string().trim().min(1).max(1000).optional(),
    checklist: z
      .record(z.string().max(64), z.union([z.boolean(), z.string().max(120), z.number()]))
      .optional(),
    isInternal: z.boolean().default(false),
  })
  .strict();

function resolveRequiredScope(
  entityType: z.infer<typeof reviewEntitySchema>['entityType'],
  decision: string,
): string {
  switch (entityType) {
    case 'company':
      return decision === 'verified' || decision === 'unverified'
        ? 'companies:verify'
        : 'companies:review';
    case 'verification_request':
      return 'verifications:review';
    case 'pitch':
      return decision === 'restricted' ||
        decision === 'unrestricted' ||
        decision === 'approved_restricted'
        ? 'pitches:restrict'
        : 'pitches:review';
    case 'pitch_document':
      return 'documents:moderate';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) });
  }

  const requestId = crypto.randomUUID();
  let actorId: string | undefined;

  try {
    if (req.method !== 'POST') {
      throw new EdgeFunctionError(405, 'METHOD_NOT_ALLOWED', 'errors.methodNotAllowed');
    }

    const adminClient = createServiceAdminClient();
    const actor = await requireAuthenticatedActor(req, adminClient);
    actorId = actor.userId;

    const payload = await parseJsonBody(req, reviewEntitySchema);

    if (!ALLOWED_DECISIONS[payload.entityType].includes(payload.decision)) {
      throw new EdgeFunctionError(400, 'VALIDATION_ERROR', 'validation.admin.invalidDecision');
    }

    if (
      DECISIONS_REQUIRING_REASON.has(payload.decision) &&
      (!payload.reason || payload.reason.trim().length < 10)
    ) {
      throw new EdgeFunctionError(400, 'VALIDATION_ERROR', 'validation.reason.min10Required');
    }

    assertActiveAdminScope(actor, resolveRequiredScope(payload.entityType, payload.decision));

    await enforceRateLimit(adminClient, `admin_review_entity:${actor.userId}`, 60, 60);
    const ipHash = await hashIpAddress(req);

    const { data: reviewResult, error: rpcErr } = await adminClient.rpc(
      'admin_execute_entity_review',
      {
        p_actor_id: actor.userId,
        p_entity_type: payload.entityType,
        p_entity_id: payload.entityId,
        p_decision: payload.decision,
        p_reason: payload.reason ?? null,
        p_feedback_ar: payload.feedbackAr ?? null,
        p_feedback_en: payload.feedbackEn ?? null,
        p_checklist: payload.checklist ?? {},
        p_is_internal: payload.isInternal,
        p_request_id: requestId,
        p_ip_hash: ipHash,
      },
    );

    if (rpcErr || !reviewResult) {
      if (rpcErr?.code === 'P0002') {
        throw new EdgeFunctionError(404, 'NOT_FOUND', 'errors.entityNotFound');
      }
      throw new EdgeFunctionError(403, 'REVIEW_REJECTED', 'errors.adminReviewFailed');
    }

    const resultRecord = reviewResult as {
      entityId?: string;
      entityType?: string;
      ownerUserId?: string;
    };

    if (!payload.isInternal && resultRecord.ownerUserId) {
      const category =
        payload.entityType === 'pitch' || payload.entityType === 'pitch_document'
          ? 'pitch_review'
          : payload.entityType === 'verification_request'
            ? 'verification'
            : 'company_review';

      await adminClient.from('notifications').insert({
        user_id: resultRecord.ownerUserId,
        sent_by: actor.userId,
        category,
        title_ar: 'تحديث على طلب المراجعة',
        title_en: 'Review Status Updated',
        body_ar:
          payload.feedbackAr ??
          'تم تحديث حالة المراجعة في منصة شارك للاستثمار. يرجى الاطلاع على التفاصيل.',
        body_en:
          payload.feedbackEn ??
          'Your submission status has been updated in SHARK Investment Network.',
        deep_link: '/account/notifications',
        entity_type: payload.entityType,
        entity_id: payload.entityId,
      });
    }

    return jsonResponse(req, 200, {
      success: true,
      requestId,
      review: reviewResult,
    });
  } catch (err) {
    return handleEdgeError(req, 'admin-review-entity', requestId, err, actorId);
  }
});
