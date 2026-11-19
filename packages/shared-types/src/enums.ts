/**
 * Canonical domain enumerations matching docs/DATABASE.md Section 2 (23 PostgreSQL enums).
 */

export const USER_ROLES = ['investor', 'founder', 'member', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const SIGNUP_SELECTABLE_ROLES = ['investor', 'founder', 'member'] as const;
export type SignupSelectableRole = (typeof SIGNUP_SELECTABLE_ROLES)[number];

export const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const COMPANY_STATUSES = ['draft', 'pending', 'approved', 'rejected', 'suspended'] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const VERIFICATION_BADGE_STATUSES = [
  'unverified',
  'pending',
  'verified',
  'rejected',
] as const;
export type VerificationBadgeStatus = (typeof VERIFICATION_BADGE_STATUSES)[number];

export const PITCH_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'closed',
  'restricted',
] as const;
export type PitchStatus = (typeof PITCH_STATUSES)[number];

export const VERIFICATION_REQUEST_STATUSES = [
  'pending',
  'needs_info',
  'approved',
  'rejected',
] as const;
export type VerificationRequestStatus = (typeof VERIFICATION_REQUEST_STATUSES)[number];

export const ADMIN_ROLE_NAMES = [
  'super_admin',
  'operations_admin',
  'compliance_reviewer',
  'content_moderator',
  'analyst_readonly',
] as const;
export type AdminRoleName = (typeof ADMIN_ROLE_NAMES)[number];

export const ADMIN_PERMISSION_SCOPES = [
  '*',
  'users:read',
  'users:review',
  'users:suspend',
  'roles:read',
  'roles:manage',
  'investors:moderate',
  'companies:read',
  'companies:review',
  'companies:verify',
  'verifications:read',
  'verifications:review',
  'pitches:read',
  'pitches:review',
  'pitches:restrict',
  'documents:moderate',
  'interests:read',
  'notifications:send',
  'audit:read',
  'analytics:read',
  'support:read',
  'support:manage',
  'settings:read',
  'settings:write',
] as const;
export type AdminPermissionScope = (typeof ADMIN_PERMISSION_SCOPES)[number];

export const ADMIN_ROLE_DEFAULT_PERMISSIONS: Record<
  AdminRoleName,
  readonly AdminPermissionScope[]
> = {
  super_admin: ['*'],
  operations_admin: [
    'users:read',
    'users:review',
    'users:suspend',
    'companies:read',
    'companies:review',
    'pitches:read',
    'notifications:send',
    'support:read',
    'support:manage',
    'analytics:read',
  ],
  compliance_reviewer: [
    'users:read',
    'users:review',
    'users:suspend',
    'verifications:read',
    'verifications:review',
    'companies:verify',
    'audit:read',
  ],
  content_moderator: [
    'investors:moderate',
    'companies:read',
    'companies:review',
    'pitches:read',
    'pitches:review',
    'pitches:restrict',
    'documents:moderate',
    'interests:read',
  ],
  analyst_readonly: [
    'users:read',
    'companies:read',
    'pitches:read',
    'audit:read',
    'analytics:read',
    'support:read',
  ],
} as const;

export const LANGUAGE_CODES = ['ar', 'en'] as const;
export type AppLocale = (typeof LANGUAGE_CODES)[number];

export const INVESTOR_TYPES = [
  'angel',
  'vc_fund',
  'family_office',
  'corporate_vc',
  'syndicate',
  'institutional',
] as const;
export type InvestorType = (typeof INVESTOR_TYPES)[number];

export const FUNDING_STAGES = [
  'pre_seed',
  'seed',
  'series_a',
  'series_b',
  'growth',
  'late_stage',
] as const;
export type FundingStage = (typeof FUNDING_STAGES)[number];

export const INVESTMENT_INSTRUMENTS = [
  'equity',
  'safe',
  'convertible_note',
  'revenue_share',
  'debt',
  'other',
] as const;
export type InvestmentInstrument = (typeof INVESTMENT_INSTRUMENTS)[number];

export const COMPANY_MEMBER_ROLES = [
  'owner',
  'co_founder',
  'executive',
  'advisor',
  'editor',
] as const;
export type CompanyMemberRole = (typeof COMPANY_MEMBER_ROLES)[number];

export const COMPANY_MEMBER_STATUSES = ['invited', 'active', 'revoked'] as const;
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUSES)[number];

export const PITCH_DOCUMENT_CATEGORIES = [
  'pitch_deck',
  'financial_model',
  'cap_table',
  'legal_doc',
  'traction_report',
  'other',
] as const;
export type PitchDocumentCategory = (typeof PITCH_DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_SCAN_STATUSES = ['pending', 'clean', 'quarantined'] as const;
export type DocumentScanStatus = (typeof DOCUMENT_SCAN_STATUSES)[number];

export const INVESTMENT_INTEREST_STATUSES = [
  'submitted',
  'reviewing',
  'shortlisted',
  'connected',
  'declined',
  'withdrawn',
] as const;
export type InvestmentInterestStatus = (typeof INVESTMENT_INTEREST_STATUSES)[number];

export const SAVED_ENTITY_TYPES = ['investor', 'company', 'pitch'] as const;
export type SavedEntityType = (typeof SAVED_ENTITY_TYPES)[number];

export const NOTIFICATION_CATEGORIES = [
  'account_status',
  'verification',
  'company_review',
  'pitch_review',
  'investment_interest',
  'access_grant',
  'announcement',
  'security',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const VERIFICATION_SUBJECT_TYPES = [
  'user_identity',
  'investor_accreditation',
  'company_kyb',
] as const;
export type VerificationSubjectType = (typeof VERIFICATION_SUBJECT_TYPES)[number];

export const DEVICE_PLATFORMS = ['ios', 'android', 'web'] as const;
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const PITCH_REVIEW_DECISIONS = [
  'approved',
  'approved_restricted',
  'needs_info',
  'rejected',
  'restricted',
  'unrestricted',
  'closed',
] as const;
export type PitchReviewDecision = (typeof PITCH_REVIEW_DECISIONS)[number];

export const SUPPORT_REQUEST_CATEGORIES = [
  'account_approval',
  'verification',
  'technical_issue',
  'appeal',
  'content_report',
  'general',
] as const;
export type SupportRequestCategory = (typeof SUPPORT_REQUEST_CATEGORIES)[number];

export const SUPPORT_REQUEST_STATUSES = [
  'open',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
] as const;
export type SupportRequestStatus = (typeof SUPPORT_REQUEST_STATUSES)[number];

export const ONBOARDING_STEPS = [
  'account_type',
  'profile_setup',
  'verification',
  'completed',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const TEAM_SIZE_BANDS = ['1-10', '11-50', '51-200', '201-500', '500+'] as const;
export type TeamSizeBand = (typeof TEAM_SIZE_BANDS)[number];
