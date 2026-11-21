import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
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
const MAX_RECIPIENTS_PER_REQUEST = 500;

const NOTIFICATION_CATEGORIES = [
  'account_status',
  'verification',
  'company_review',
  'pitch_review',
  'investment_interest',
  'access_grant',
  'announcement',
  'security',
] as const;

const USER_ROLES = ['investor', 'founder', 'member', 'admin'] as const;

function trimmedText(min: number, max: number, prefix: string): z.ZodString {
  return z.string().trim().min(min, `${prefix}.tooShort`).max(max, `${prefix}.tooLong`);
}

const sharedNotificationFields = {
  category: z.enum(NOTIFICATION_CATEGORIES),
  titleAr: trimmedText(1, 160, 'validation.notification.title'),
  titleEn: trimmedText(1, 160, 'validation.notification.title'),
  bodyAr: trimmedText(1, 1000, 'validation.notification.body'),
  bodyEn: trimmedText(1, 1000, 'validation.notification.body'),
  deepLink: z
    .string()
    .trim()
    .max(256, 'validation.deepLink.tooLong')
    .regex(/^\/[a-zA-Z0-9/_-]*$/, 'validation.deepLink.invalidRelativePath')
    .optional(),
  entityType: trimmedText(1, 64, 'validation.entityType').optional(),
  entityId: uuidSchema.optional(),
};

const targetModeNotificationSchema = z
  .object({
    targetMode: z.enum(['user_ids', 'role', 'sector', 'all_approved']),
    userIds: z
      .array(uuidSchema)
      .min(1, 'validation.notification.userIdsRequired')
      .max(MAX_RECIPIENTS_PER_REQUEST, 'validation.notification.tooManyRecipients')
      .optional(),
    role: z.enum(USER_ROLES).optional(),
    sectorId: uuidSchema.optional(),
    ...sharedNotificationFields,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.targetMode === 'user_ids' && (!data.userIds || data.userIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.notification.userIdsRequired',
        path: ['userIds'],
      });
    }
    if (data.targetMode === 'role' && !data.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.notification.roleRequired',
        path: ['role'],
      });
    }
    if (data.targetMode === 'sector' && !data.sectorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.notification.sectorRequired',
        path: ['sectorId'],
      });
    }
  });

const directNotificationSchema = z
  .object({
    recipientIds: z
      .array(uuidSchema)
      .min(1, 'validation.notification.userIdsRequired')
      .max(MAX_RECIPIENTS_PER_REQUEST, 'validation.notification.tooManyRecipients'),
    ...sharedNotificationFields,
  })
  .strict();

const notificationSchema = z.union([targetModeNotificationSchema, directNotificationSchema]);
type ParsedNotificationPayload = z.infer<typeof notificationSchema>;
type ResolvedTargetMode = 'direct' | 'user_ids' | 'role' | 'sector' | 'all_approved';

interface TargetProfile {
  readonly id: string;
  readonly preferredLanguage: string;
}

function extractStringColumn(
  rows: ReadonlyArray<Record<string, unknown>> | null,
  key: string,
): string[] {
  const result: string[] = [];
  for (const row of rows ?? []) {
    const val = row[key];
    if (typeof val === 'string' && val.length > 0) {
      result.push(val);
    }
  }
  return result;
}

function normalizeTargetProfiles(
  rows: ReadonlyArray<Record<string, unknown>> | null,
): TargetProfile[] {
  const profiles: TargetProfile[] = [];
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const id = row.id;
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const pref = row.preferred_language;
    profiles.push({
      id,
      preferredLanguage: typeof pref === 'string' && pref === 'en' ? 'en' : 'ar',
    });
  }
  return profiles;
}

async function fetchApprovedSectorProfiles(
  adminClient: SupabaseClient,
  sectorId: string,
): Promise<TargetProfile[]> {
  const [profileRes, investorRes, founderRes, companyRes] = await Promise.all([
    adminClient
      .from('profiles')
      .select('id')
      .contains('interest_sector_ids', [sectorId])
      .eq('account_status', 'approved')
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST),
    adminClient
      .from('investors')
      .select('user_id')
      .contains('focus_sector_ids', [sectorId])
      .is('deleted_at', null)
      .order('user_id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST),
    adminClient
      .from('founders')
      .select('user_id')
      .eq('primary_sector_id', sectorId)
      .is('deleted_at', null)
      .order('user_id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST),
    adminClient
      .from('companies')
      .select('owner_id')
      .or(`sector_id.eq.${sectorId},secondary_sector_ids.cs.{${sectorId}}`)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('owner_id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST),
  ]);

  if (profileRes.error || investorRes.error || founderRes.error || companyRes.error) {
    throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
  }

  const candidateIds = Array.from(
    new Set([
      ...extractStringColumn(profileRes.data, 'id'),
      ...extractStringColumn(investorRes.data, 'user_id'),
      ...extractStringColumn(founderRes.data, 'user_id'),
      ...extractStringColumn(companyRes.data, 'owner_id'),
    ]),
  ).sort();

  if (candidateIds.length === 0) {
    return [];
  }

  const collected: TargetProfile[] = [];
  for (
    let i = 0;
    i < candidateIds.length && collected.length < MAX_RECIPIENTS_PER_REQUEST;
    i += 100
  ) {
    const chunk = candidateIds.slice(i, i + 100);
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, preferred_language')
      .in('id', chunk)
      .eq('account_status', 'approved')
      .is('deleted_at', null)
      .order('id', { ascending: true });

    if (error) {
      throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
    }
    for (const profile of normalizeTargetProfiles(data)) {
      collected.push(profile);
      if (collected.length >= MAX_RECIPIENTS_PER_REQUEST) {
        break;
      }
    }
  }

  return collected;
}

async function resolveTargetProfiles(
  adminClient: SupabaseClient,
  payload: ParsedNotificationPayload,
): Promise<{
  readonly targetMode: ResolvedTargetMode;
  readonly profiles: readonly TargetProfile[];
}> {
  if ('recipientIds' in payload || payload.targetMode === 'user_ids') {
    const targetMode: ResolvedTargetMode = 'recipientIds' in payload ? 'direct' : 'user_ids';
    const rawIds = 'recipientIds' in payload ? payload.recipientIds : (payload.userIds ?? []);
    const uniqueIds = Array.from(new Set(rawIds)).slice(0, MAX_RECIPIENTS_PER_REQUEST);
    if (uniqueIds.length === 0) {
      return { targetMode, profiles: [] };
    }
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, preferred_language')
      .in('id', uniqueIds)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST);

    if (error) {
      throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
    }
    return { targetMode, profiles: normalizeTargetProfiles(data) };
  }

  if (payload.targetMode === 'role' && payload.role) {
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, preferred_language')
      .eq('role', payload.role)
      .eq('account_status', 'approved')
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(MAX_RECIPIENTS_PER_REQUEST);

    if (error) {
      throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
    }
    return { targetMode: 'role', profiles: normalizeTargetProfiles(data) };
  }

  if (payload.targetMode === 'sector' && payload.sectorId) {
    const profiles = await fetchApprovedSectorProfiles(adminClient, payload.sectorId);
    return { targetMode: 'sector', profiles };
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, preferred_language')
    .eq('account_status', 'approved')
    .is('deleted_at', null)
    .order('id', { ascending: true })
    .limit(MAX_RECIPIENTS_PER_REQUEST);

  if (error) {
    throw new EdgeFunctionError(500, 'PROFILE_LOOKUP_FAILED', 'errors.unexpected');
  }
  return { targetMode: 'all_approved', profiles: normalizeTargetProfiles(data) };
}

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
    const { targetMode, profiles: targetProfiles } = await resolveTargetProfiles(
      adminClient,
      payload,
    );

    if (targetProfiles.length === 0) {
      return jsonResponse(req, 200, {
        success: true,
        requestId,
        targetMode,
        notificationsInserted: 0,
        pushAttempted: 0,
        tokensDeactivated: 0,
      });
    }

    const targetIds = targetProfiles.map((p) => p.id);
    const localeByUser = new Map<string, string>(
      targetProfiles.map((p) => [p.id, p.preferredLanguage]),
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
    try {
      await insertAuditLog(adminClient, {
        actor,
        action: isInternalTrigger ? 'notifications.system_dispatched' : 'notifications.admin_sent',
        entityType: 'notifications',
        entityId: payload.entityId ?? null,
        metadata: {
          category: payload.category,
          target_mode: targetMode,
          recipient_count: targetIds.length,
          push_attempted: pushAttempted,
          tokens_deactivated: unregisteredTokenIds.length,
        },
        requestId,
        ipHash,
      });
    } catch {
      throw new EdgeFunctionError(500, 'AUDIT_PERSISTENCE_FAILED', 'errors.auditWriteFailed');
    }

    return jsonResponse(req, 200, {
      success: true,
      requestId,
      targetMode,
      notificationsInserted: targetIds.length,
      pushAttempted,
      tokensDeactivated: unregisteredTokenIds.length,
    });
  } catch (err) {
    return handleEdgeError(req, 'send-push-notification', requestId, err, actorId);
  }
});
