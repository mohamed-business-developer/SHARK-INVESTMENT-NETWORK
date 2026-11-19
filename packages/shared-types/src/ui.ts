/**
 * Framework-independent UI Component Contracts shared between @shark/mobile and @shark/admin.
 * Reference: docs/DESIGN_SYSTEM.md Section 7
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export type FeedbackVariant = 'info' | 'success' | 'warning' | 'error';

export type EmptyStateVariant = 'no_data' | 'no_search_results' | 'restricted' | 'error';

export type LoadingSkeletonPreset =
  'investor_card' | 'company_card' | 'pitch_card' | 'profile_header' | 'table_rows' | 'detail_page';

export type VerificationStatusValue = 'unverified' | 'pending' | 'verified' | 'rejected';

export type PitchStatusValue =
  'draft' | 'pending' | 'approved' | 'rejected' | 'closed' | 'restricted';

export type PitchAccessMode = 'full' | 'restricted_locked';

export interface InvestorCardData {
  readonly id: string;
  readonly fullName: string;
  readonly headline: string;
  readonly avatarUrl?: string | null;
  readonly investorTypeLabel: string;
  readonly isVerified: boolean;
  readonly verifiedLabel: string;
  readonly ticketRangeDisplay: string;
  readonly ticketLabel: string;
  readonly sectors: readonly string[];
  readonly countryLabel: string;
  readonly isSaved?: boolean;
}

export interface CompanyCardData {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly logoUrl?: string | null;
  readonly sectorLabel: string;
  readonly stageLabel: string;
  readonly countryLabel: string;
  readonly verificationStatus: VerificationStatusValue;
  readonly verificationLabel: string;
  readonly activePitchCount: number;
  readonly activePitchesLabel?: string;
}

export interface PitchCardData {
  readonly id: string;
  readonly title: string;
  readonly companyName: string;
  readonly companyLogoUrl?: string | null;
  readonly sectorLabel: string;
  readonly stageLabel: string;
  readonly targetAmountDisplay: string;
  readonly equityOfferedDisplay?: string;
  readonly pitchStatus: PitchStatusValue;
  readonly statusLabel: string;
  readonly accessMode: PitchAccessMode;
  readonly summaryTeaser: string;
  readonly hasDeckDocument: boolean;
}

export type MobileTabKey = 'discovery' | 'investors' | 'companies' | 'pitches' | 'account';

export type AdminModuleKey =
  | 'overview'
  | 'users'
  | 'investors'
  | 'companies'
  | 'verifications'
  | 'pitches'
  | 'pitch-reviews'
  | 'documents'
  | 'notifications'
  | 'admin-roles'
  | 'activity-logs'
  | 'analytics'
  | 'settings'
  | 'design-system';
