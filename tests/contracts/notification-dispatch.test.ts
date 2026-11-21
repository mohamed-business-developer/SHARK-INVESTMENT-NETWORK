import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  SendDirectPushNotificationRequest,
  SendPushNotificationPayload,
  SendPushNotificationRequest,
  SendPushNotificationResponse,
} from '@shark/shared-types';
import {
  directPushNotificationSchema,
  sendPushNotificationEdgeSchema,
  sendPushNotificationSchema,
} from '@shark/validation';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const UUID_1 = '11111111-1111-4111-8111-111111111101';
const UUID_SECTOR = '22222222-2222-4222-8222-222222222201';
const UUID_ENTITY = '33333333-3333-4333-8333-333333333301';

const BASE_COPY = {
  category: 'announcement' as const,
  titleAr: 'تحديث هام للشبكة',
  titleEn: 'Important Network Update',
  bodyAr: 'تم نشر فرص استثمارية جديدة في القطاع.',
  bodyEn: 'New investment opportunities are now available in the sector.',
  deepLink: '/pitches/33333333-3333-4333-8333-333333333301',
  entityType: 'pitch',
  entityId: UUID_ENTITY,
};

describe('Notification dispatch contract alignment (T5-01)', () => {
  it('validates all four targetMode broadcasts across shared-types and Zod schemas', () => {
    const byUsers: SendPushNotificationRequest = {
      targetMode: 'user_ids',
      userIds: [UUID_1],
      ...BASE_COPY,
    };
    const byRole: SendPushNotificationRequest = {
      targetMode: 'role',
      role: 'investor',
      ...BASE_COPY,
    };
    const bySector: SendPushNotificationRequest = {
      targetMode: 'sector',
      sectorId: UUID_SECTOR,
      ...BASE_COPY,
    };
    const allApproved: SendPushNotificationRequest = {
      targetMode: 'all_approved',
      ...BASE_COPY,
    };

    for (const payload of [byUsers, byRole, bySector, allApproved]) {
      expect(sendPushNotificationSchema.safeParse(payload).success).toBe(true);
      expect(sendPushNotificationEdgeSchema.safeParse(payload).success).toBe(true);
    }
  });

  it('validates internal direct recipientIds payloads via edge union schema', () => {
    const directPayload: SendDirectPushNotificationRequest = {
      recipientIds: [UUID_1],
      ...BASE_COPY,
    };
    const asUnion: SendPushNotificationPayload = directPayload;
    expect(directPushNotificationSchema.safeParse(asUnion).success).toBe(true);
    expect(sendPushNotificationEdgeSchema.safeParse(asUnion).success).toBe(true);

    const sampleResponse: SendPushNotificationResponse = {
      success: true,
      requestId: 'req_123',
      targetMode: 'direct',
      notificationsInserted: 1,
      pushAttempted: 1,
      tokensDeactivated: 0,
    };
    expect(sampleResponse.notificationsInserted).toBe(1);
  });

  it('rejects incomplete targetMode fields, >500 recipients, and unsafe open-redirect deep links', () => {
    const missingUserIds = sendPushNotificationSchema.safeParse({
      targetMode: 'user_ids',
      ...BASE_COPY,
    });
    expect(missingUserIds.success).toBe(false);
    if (!missingUserIds.success) {
      expect(missingUserIds.error.issues[0]?.message).toBe(
        'validation.notification.userIdsRequired',
      );
    }

    const missingRole = sendPushNotificationSchema.safeParse({
      targetMode: 'role',
      ...BASE_COPY,
    });
    expect(missingRole.success).toBe(false);
    if (!missingRole.success) {
      expect(missingRole.error.issues[0]?.message).toBe('validation.notification.roleRequired');
    }

    const missingSector = sendPushNotificationSchema.safeParse({
      targetMode: 'sector',
      ...BASE_COPY,
    });
    expect(missingSector.success).toBe(false);
    if (!missingSector.success) {
      expect(missingSector.error.issues[0]?.message).toBe('validation.notification.sectorRequired');
    }

    const tooManyRecipients = directPushNotificationSchema.safeParse({
      recipientIds: Array.from({ length: 501 }, () => UUID_1),
      ...BASE_COPY,
    });
    expect(tooManyRecipients.success).toBe(false);
    if (!tooManyRecipients.success) {
      expect(tooManyRecipients.error.issues[0]?.message).toBe(
        'validation.notification.tooManyRecipients',
      );
    }

    const openRedirect = sendPushNotificationSchema.safeParse({
      targetMode: 'all_approved',
      ...BASE_COPY,
      deepLink: 'https://evil.example/phish',
    });
    expect(openRedirect.success).toBe(false);
    if (!openRedirect.success) {
      expect(openRedirect.error.issues[0]?.message).toBe('validation.deepLink.invalid');
    }
  });

  it('keeps send-push-notification Edge Function and API docs synchronized on target modes and fail-closed audit', () => {
    const edgeSource = readFileSync(
      resolve(REPO_ROOT, 'supabase/functions/send-push-notification/index.ts'),
      'utf8',
    );
    const apiDocs = readFileSync(resolve(REPO_ROOT, 'docs/API_DOCUMENTATION.md'), 'utf8');

    for (const mode of ['user_ids', 'role', 'sector', 'all_approved', 'recipientIds']) {
      expect(edgeSource).toContain(mode);
      expect(apiDocs).toContain(mode);
    }
    expect(edgeSource).toContain('AUDIT_PERSISTENCE_FAILED');
    expect(edgeSource).toContain('errors.auditWriteFailed');
  });
});
