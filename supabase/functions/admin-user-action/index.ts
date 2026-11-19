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

const actionSchema = z
  .object({
    action: z.enum([
      'approve',
      'reject',
      'suspend',
      'reactivate',
      'change_role',
      'assign_admin_role',
    ]),
    targetUserId: uuidSchema,
    role: z.enum(['investor', 'founder', 'member', 'admin']).optional(),
    adminRole: z
      .enum([
        'super_admin',
        'operations_admin',
        'compliance_reviewer',
        'content_moderator',
        'analyst_readonly',
      ])
      .optional(),
    permissions: z.array(z.string().min(1).max(64)).max(30).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

const REQUIRED_SCOPE: Record<z.infer<typeof actionSchema>['action'], string> = {
  approve: 'users:review',
  reject: 'users:review',
  reactivate: 'users:review',
  suspend: 'users:suspend',
  change_role: 'roles:manage',
  assign_admin_role: 'roles:manage',
};

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

    const payload = await parseJsonBody(req, actionSchema);
    assertActiveAdminScope(actor, REQUIRED_SCOPE[payload.action]);

    if (payload.targetUserId === actor.userId) {
      throw new EdgeFunctionError(403, 'SELF_ACTION_FORBIDDEN', 'errors.cannotActOnSelf');
    }

    if (
      (payload.action === 'reject' || payload.action === 'suspend') &&
      (!payload.reason || payload.reason.trim().length < 10)
    ) {
      throw new EdgeFunctionError(400, 'VALIDATION_ERROR', 'validation.reason.min10Required');
    }

    await enforceRateLimit(adminClient, `admin_user_action:${actor.userId}`, 60, 60);
    const ipHash = await hashIpAddress(req);

    const { data: updatedProfile, error: rpcErr } = await adminClient.rpc(
      'admin_execute_user_action',
      {
        p_actor_id: actor.userId,
        p_action: payload.action,
        p_target_user_id: payload.targetUserId,
        p_role: payload.role ?? null,
        p_admin_role: payload.adminRole ?? null,
        p_permissions: payload.permissions ?? null,
        p_reason: payload.reason ?? null,
        p_request_id: requestId,
        p_ip_hash: ipHash,
      },
    );

    if (rpcErr || !updatedProfile) {
      throw new EdgeFunctionError(403, 'ACTION_REJECTED', 'errors.adminActionFailed');
    }

    // Immediate session & push token revocation on suspension, rejection, or admin demotion
    if (
      payload.action === 'suspend' ||
      payload.action === 'reject' ||
      (payload.action === 'change_role' && payload.role !== 'admin')
    ) {
      await adminClient.auth.admin.signOut(payload.targetUserId, 'global');
      await adminClient
        .from('device_tokens')
        .update({ is_active: false })
        .eq('user_id', payload.targetUserId);
    }

    if (['approve', 'reject', 'suspend', 'reactivate'].includes(payload.action)) {
      const notificationMap: Record<
        string,
        { titleAr: string; titleEn: string; bodyAr: string; bodyEn: string }
      > = {
        approve: {
          titleAr: 'تم اعتماد حسابك',
          titleEn: 'Your Account Has Been Approved',
          bodyAr: 'أهلاً بك في شبكة شارك للاستثمار. يمكنك الآن استكشاف جميع الفرص والعروض المعتمدة.',
          bodyEn:
            'Welcome to SHARK Investment Network. Full access to approved pitches is now unlocked.',
        },
        reject: {
          titleAr: 'تحديث حول طلب انضمامك',
          titleEn: 'Account Application Update',
          bodyAr: 'لم يتم اعتماد طلبك حالياً. يرجى مراجعة الملاحظات في تطبيق شارك.',
          bodyEn:
            'Your application could not be approved at this time. Please review the notes in the app.',
        },
        suspend: {
          titleAr: 'تم تعليق حسابك مؤقتاً',
          titleEn: 'Account Temporarily Suspended',
          bodyAr: 'تم تعليق الوصول إلى حسابك من قِبل الإدارة. يمكنك التواصل مع الدعم للمراجعة.',
          bodyEn: 'Your account access has been suspended. Please contact support for assistance.',
        },
        reactivate: {
          titleAr: 'تمت إعادة تفعيل حسابك',
          titleEn: 'Your Account Has Been Reactivated',
          bodyAr: 'تم رفع التعليق وإعادة تفعيل حسابك في شبكة شارك للاستثمار.',
          bodyEn: 'Your SHARK Investment Network account access has been restored.',
        },
      };

      const msg = notificationMap[payload.action];
      if (msg) {
        await adminClient.from('notifications').insert({
          user_id: payload.targetUserId,
          sent_by: actor.userId,
          category: 'account_status',
          title_ar: msg.titleAr,
          title_en: msg.titleEn,
          body_ar: msg.bodyAr,
          body_en: msg.bodyEn,
          deep_link: '/account/notifications',
          entity_type: 'profiles',
          entity_id: payload.targetUserId,
        });
      }
    }

    return jsonResponse(req, 200, {
      success: true,
      requestId,
      profile: updatedProfile,
    });
  } catch (err) {
    return handleEdgeError(req, 'admin-user-action', requestId, err, actorId);
  }
});
