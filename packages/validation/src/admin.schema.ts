import { z } from 'zod';
import {
  ADMIN_PERMISSION_SCOPES,
  ADMIN_ROLE_NAMES,
  NOTIFICATION_CATEGORIES,
  SUPPORT_REQUEST_CATEGORIES,
  USER_ROLES,
} from '@shark/shared-types';
import {
  boundedTextSchema,
  safeRelativeDeepLinkSchema,
  slugSchema,
  uuidSchema,
} from './common.schema';

export const auditReasonSchema = boundedTextSchema(10, 500, 'validation.reason');

export const adminUserActionSchema = z
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
    role: z.enum(USER_ROLES).optional(),
    adminRole: z.enum(ADMIN_ROLE_NAMES).optional(),
    permissions: z.array(z.enum(ADMIN_PERMISSION_SCOPES)).max(30).optional(),
    reason: boundedTextSchema(1, 500, 'validation.reason').optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.action === 'reject' || data.action === 'suspend') &&
      (!data.reason || data.reason.length < 10)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.reason.min10Required',
        path: ['reason'],
      });
    }
    if (data.action === 'change_role' && !data.role) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.admin.roleRequired',
        path: ['role'],
      });
    }
    if (data.action === 'assign_admin_role' && !data.adminRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.admin.adminRoleRequired',
        path: ['adminRole'],
      });
    }
  });

const DECISIONS_REQUIRING_REASON = new Set([
  'rejected',
  'suspended',
  'restricted',
  'needs_info',
  'disabled',
]);

export const adminReviewEntitySchema = z
  .object({
    entityType: z.enum(['company', 'verification_request', 'pitch', 'pitch_document']),
    entityId: uuidSchema,
    decision: boundedTextSchema(2, 40, 'validation.admin.decision'),
    reason: boundedTextSchema(1, 500, 'validation.reason').optional(),
    feedbackAr: boundedTextSchema(1, 1000, 'validation.feedback').optional(),
    feedbackEn: boundedTextSchema(1, 1000, 'validation.feedback').optional(),
    checklist: z
      .record(z.string().max(64), z.union([z.boolean(), z.string().max(120), z.number()]))
      .optional(),
    isInternal: z.boolean().default(false),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      DECISIONS_REQUIRING_REASON.has(data.decision) &&
      (!data.reason || data.reason.length < 10)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'validation.reason.min10Required',
        path: ['reason'],
      });
    }
  });

export const grantPitchAccessSchema = z
  .object({
    pitch_id: uuidSchema,
    pitch_document_id: uuidSchema.nullable().optional(),
    user_id: uuidSchema,
    reason: boundedTextSchema(1, 500, 'validation.reason').optional(),
    expires_at: z.string().datetime('validation.date.invalidIsoDateTime').nullable().optional(),
  })
  .strict();

export const revokePitchAccessSchema = z
  .object({
    grant_id: uuidSchema,
    reason: auditReasonSchema,
  })
  .strict();

export const sendPushNotificationSchema = z
  .object({
    targetMode: z.enum(['user_ids', 'role', 'sector', 'all_approved']),
    userIds: z
      .array(uuidSchema)
      .min(1, 'validation.notification.userIdsRequired')
      .max(500, 'validation.notification.tooManyRecipients')
      .optional(),
    role: z.enum(USER_ROLES).optional(),
    sectorId: uuidSchema.optional(),
    category: z.enum(NOTIFICATION_CATEGORIES),
    titleAr: boundedTextSchema(1, 160, 'validation.notification.title'),
    titleEn: boundedTextSchema(1, 160, 'validation.notification.title'),
    bodyAr: boundedTextSchema(1, 1000, 'validation.notification.body'),
    bodyEn: boundedTextSchema(1, 1000, 'validation.notification.body'),
    deepLink: safeRelativeDeepLinkSchema.optional(),
    entityType: boundedTextSchema(1, 64, 'validation.entityType').optional(),
    entityId: uuidSchema.optional(),
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

export const directPushNotificationSchema = z
  .object({
    recipientIds: z
      .array(uuidSchema)
      .min(1, 'validation.notification.userIdsRequired')
      .max(500, 'validation.notification.tooManyRecipients'),
    category: z.enum(NOTIFICATION_CATEGORIES),
    titleAr: boundedTextSchema(1, 160, 'validation.notification.title'),
    titleEn: boundedTextSchema(1, 160, 'validation.notification.title'),
    bodyAr: boundedTextSchema(1, 1000, 'validation.notification.body'),
    bodyEn: boundedTextSchema(1, 1000, 'validation.notification.body'),
    deepLink: safeRelativeDeepLinkSchema.optional(),
    entityType: boundedTextSchema(1, 64, 'validation.entityType').optional(),
    entityId: uuidSchema.optional(),
  })
  .strict();

export const sendPushNotificationEdgeSchema = z.union([
  sendPushNotificationSchema,
  directPushNotificationSchema,
]);

export const upsertSectorSchema = z
  .object({
    slug: slugSchema,
    name_ar: boundedTextSchema(2, 80, 'validation.sector.name'),
    name_en: boundedTextSchema(2, 80, 'validation.sector.name'),
    description_ar: boundedTextSchema(1, 500, 'validation.description').nullable().optional(),
    description_en: boundedTextSchema(1, 500, 'validation.description').nullable().optional(),
    icon_name: boundedTextSchema(1, 64, 'validation.iconName').nullable().optional(),
    sort_order: z.number().int().min(0).max(1000).default(0),
    is_active: z.boolean().default(true),
  })
  .strict();

export const updateSystemSettingSchema = z
  .object({
    setting_key: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/, 'validation.setting.invalidKey'),
    value: z.union([
      z.record(z.string().max(64), z.unknown()),
      z.string().max(1000),
      z.number(),
      z.boolean(),
    ]),
    is_public: z.boolean().optional(),
    reason: auditReasonSchema,
  })
  .strict();

export const createSupportRequestSchema = z
  .object({
    category: z.enum(SUPPORT_REQUEST_CATEGORIES).default('general'),
    subject: boundedTextSchema(3, 160, 'validation.support.subject'),
    message: boundedTextSchema(10, 4000, 'validation.support.message'),
  })
  .strict();
