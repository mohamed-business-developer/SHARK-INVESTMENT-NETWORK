import { z } from 'zod';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  assertActiveAdminScope,
  createServiceAdminClient,
  requireAuthenticatedActor,
  type LiveActorContext,
} from '../_shared/auth.ts';
import { insertAuditLog } from '../_shared/audit.ts';
import { EdgeFunctionError, handleEdgeError, jsonResponse } from '../_shared/errors.ts';
import { enforceRateLimit, hashIpAddress } from '../_shared/rate-limit.ts';
import { parseJsonBody, uuidSchema } from '../_shared/validation.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const notificationSchema = z
  .object({
    recipientIds: z.array(uuidSchema).min(1).max(500),
    category: z.enum([
      'account_status',
      'verification',
      'company_review',
      'pitch_review',
      'investment_interest',
      'access_grant',
      'announcement',
      'security',
    ]),
    titleAr: z.string().trim().min(1).max(160),
    titleEn: z.string().trim().min(1).max(160),
    bodyAr: z.string().trim().min(1).max(1000),
    bodyEn: z.string().trim().min(1).max(1000),
    deepLink: z
      .string()
      .trim()
      .max(256)
      .regex(/^\/[a-zA-Z0-9/_-]*$/, 'validation.deepLink.invalidRelativePath')
      .optional(),
    entityType: z.string().trim().min(1).max(64).optional(),
    entityId: uuidSchema.optional(),
  })
  .strict();

function constantTimeEquals(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length || aBytes.length === 0) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
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
    const internalSecret = Deno.env.get('INTERNAL_EDGE_SECRET') ?? '';
    const suppliedInternalSecret = req.headers.get('x-internal-service-key') ?? '';

    let actor: LiveActorContext | null = null;
    const isInternalTrigger =
      internalSecret.length >= 16 &&
      suppliedInternalSecret.length > 0 &&
      constantTimeEquals(suppliedInternalSecret, internalSecret);

    if (!isInternalTrigger) {
      actor = await requireAuthenticatedActor(req, adminClient);
      actorId = actor.userId;
      assertActiveAdminScope(actor, 'notifications:send');
      await enforceRateLimit(adminClient, `send_push:${actor.userId}`, 30, 3600);
    }

    const payload = await parseJsonBody(req, notificationSchema);
    const uniqueRecipientIds = Array.from(new Set(payload.recipientIds));

    const { data: validProfiles, error: profileErr } = await adminClient
      .from('profiles')
      .select('id, preferred_language')
      .in('id', uniqueRecipientIds)
      .is('deleted_at', null);

    if (profileErr) {
      throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
    }

    const targetProfiles = validProfiles ?? [];
    if (targetProfiles.length === 0) {
      return jsonResponse(req, 200, {
        success: true,
        requestId,
        notificationsInserted: 0,
        pushAttempted: 0,
        tokensDeactivated: 0,
      });
    }

    const targetIds = targetProfiles.map((p) => String(p.id));
    const localeByUser = new Map<string, string>(
      targetProfiles.map((p) => [String(p.id), String(p.preferred_language ?? 'ar')]),
    );

    const notificationRows = targetIds.map((userId) => ({
      user_id: userId,
      sent_by: actor?.userId ?? null,
      category: payload.category,
      title_ar: payload.titleAr,
      title_en: payload.titleEn,
      body_ar: payload.bodyAr,
      body_en: payload.bodyEn,
      deep_link: payload.deepLink ?? null,
      entity_type: payload.entityType ?? null,
      entity_id: payload.entityId ?? null,
    }));

    const { error: insertErr } = await adminClient.from('notifications').insert(notificationRows);
    if (insertErr) {
      throw new EdgeFunctionError(500, 'NOTIFICATION_INSERT_FAILED', 'errors.unexpected');
    }

    const { data: tokenRows } = await adminClient
      .from('device_tokens')
      .select('id, user_id, expo_push_token')
      .in('user_id', targetIds)
      .eq('is_active', true);

    const activeTokens = (tokenRows ?? []).filter(
      (t) => typeof t.expo_push_token === 'string' && t.expo_push_token.length > 0,
    );

    let pushAttempted = 0;
    const unregisteredTokenIds: string[] = [];

    if (activeTokens.length > 0) {
      const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (expoAccessToken) {
        headers.Authorization = `Bearer ${expoAccessToken}`;
      }

      for (let i = 0; i < activeTokens.length; i += 100) {
        const batch = activeTokens.slice(i, i + 100);
        const messages = batch.map((row) => {
          const lang = localeByUser.get(String(row.user_id)) ?? 'ar';
          const isEn = lang === 'en';
          return {
            to: row.expo_push_token,
            sound: 'default',
            title: isEn ? payload.titleEn : payload.titleAr,
            body: isEn ? payload.bodyEn : payload.bodyAr,
            data: {
              category: payload.category,
              deepLink: payload.deepLink ?? null,
              entityType: payload.entityType ?? null,
              entityId: payload.entityId ?? null,
            },
          };
        });

        pushAttempted += messages.length;

        try {
          const pushRes = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify(messages),
          });
          if (pushRes.ok) {
            const ticketJson = (await pushRes.json()) as {
              data?: Array<{ status?: string; details?: { error?: string } }>;
            };
            const tickets = ticketJson.data ?? [];
            tickets.forEach((ticket, idx) => {
              if (
                ticket.status === 'error' &&
                ticket.details?.error === 'DeviceNotRegistered' &&
                batch[idx]?.id
              ) {
                unregisteredTokenIds.push(String(batch[idx].id));
              }
            });
          }
        } catch {
          // Push relay errors must not fail DB notification delivery
        }
      }
    }

    if (unregisteredTokenIds.length > 0) {
      await adminClient
        .from('device_tokens')
        .update({ is_active: false })
        .in('id', unregisteredTokenIds);
    }

    const ipHash = await hashIpAddress(req);
    await insertAuditLog(adminClient, {
      actor,
      action: isInternalTrigger ? 'notifications.system_dispatched' : 'notifications.admin_sent',
      entityType: 'notifications',
      entityId: payload.entityId ?? null,
      metadata: {
        category: payload.category,
        recipient_count: targetIds.length,
        push_attempted: pushAttempted,
        tokens_deactivated: unregisteredTokenIds.length,
      },
      requestId,
      ipHash,
    });

    return jsonResponse(req, 200, {
      success: true,
      requestId,
      notificationsInserted: targetIds.length,
      pushAttempted,
      tokensDeactivated: unregisteredTokenIds.length,
    });
  } catch (err) {
    return handleEdgeError(req, 'send-push-notification', requestId, err, actorId);
  }
});
