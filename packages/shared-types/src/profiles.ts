import type {
  AccountStatus,
  AppLocale,
  FundingStage,
  InvestorType,
  OnboardingStep,
  SavedEntityType,
  UserRole,
} from './enums';

export interface NotificationPreferences {
  readonly push: boolean;
  readonly email: boolean;
  readonly announcements: boolean;
}

export interface ProfileRow {
  readonly id: string;
  readonly email: string;
  readonly phone: string | null;
  readonly full_name: string;
  readonly full_name_ar: string | null;
  readonly full_name_en: string | null;
  readonly headline_ar: string | null;
  readonly headline_en: string | null;
  readonly bio_ar: string | null;
  readonly bio_en: string | null;
  readonly avatar_path: string | null;
  readonly country_code: string | null;
  readonly city_ar: string | null;
  readonly city_en: string | null;
  readonly preferred_language: AppLocale;
  readonly role: UserRole;
  readonly account_status: AccountStatus;
  readonly onboarding_completed: boolean;
  readonly onboarding_step: OnboardingStep;
  readonly interest_sector_ids: readonly string[];
  readonly notification_preferences: NotificationPreferences;
  readonly analytics_opt_in: boolean;
  readonly rejection_reason: string | null;
  readonly suspension_reason: string | null;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
  readonly rejected_at: string | null;
  readonly rejected_by: string | null;
  readonly suspended_at: string | null;
  readonly suspended_by: string | null;
  readonly last_active_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface InvestorProfileRow {
  readonly id: string;
  readonly user_id: string;
  readonly investor_type: InvestorType;
  readonly firm_name_ar: string | null;
  readonly firm_name_en: string | null;
  readonly title_ar: string | null;
  readonly title_en: string | null;
  readonly thesis_ar: string | null;
  readonly thesis_en: string | null;
  readonly focus_sector_ids: readonly string[];
  readonly preferred_stages: readonly FundingStage[];
  readonly ticket_min_usd: number | null;
  readonly ticket_max_usd: number | null;
  readonly currency_code: string;
  readonly geography_focus: readonly string[];
  readonly website_url: string | null;
  readonly linkedin_url: string | null;
  readonly is_accredited: boolean;
  readonly accreditation_verified_at: string | null;
  readonly is_featured: boolean;
  readonly is_public_listed: boolean;
  readonly portfolio_count: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface FounderProfileRow {
  readonly id: string;
  readonly user_id: string;
  readonly job_title_ar: string | null;
  readonly job_title_en: string | null;
  readonly experience_years: number | null;
  readonly previous_exits_count: number;
  readonly founder_bio_ar: string | null;
  readonly founder_bio_en: string | null;
  readonly linkedin_url: string | null;
  readonly primary_sector_id: string | null;
  readonly is_public_listed: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface PublicInvestorDirectoryRow {
  readonly investor_id: string;
  readonly user_id: string;
  readonly full_name: string;
  readonly full_name_ar: string | null;
  readonly full_name_en: string | null;
  readonly headline_ar: string | null;
  readonly headline_en: string | null;
  readonly bio_ar: string | null;
  readonly bio_en: string | null;
  readonly avatar_path: string | null;
  readonly country_code: string | null;
  readonly city_ar: string | null;
  readonly city_en: string | null;
  readonly investor_type: InvestorType;
  readonly firm_name_ar: string | null;
  readonly firm_name_en: string | null;
  readonly title_ar: string | null;
  readonly title_en: string | null;
  readonly thesis_ar: string | null;
  readonly thesis_en: string | null;
  readonly focus_sector_ids: readonly string[];
  readonly preferred_stages: readonly FundingStage[];
  readonly ticket_min_usd: number | null;
  readonly ticket_max_usd: number | null;
  readonly currency_code: string;
  readonly geography_focus: readonly string[];
  readonly website_url: string | null;
  readonly linkedin_url: string | null;
  readonly is_featured: boolean;
  readonly portfolio_count: number;
  readonly approved_at: string | null;
}

export interface PortfolioCompanyRow {
  readonly id: string;
  readonly investor_user_id: string;
  readonly company_id: string | null;
  readonly external_name_ar: string | null;
  readonly external_name_en: string | null;
  readonly logo_path: string | null;
  readonly sector_id: string | null;
  readonly investment_stage: FundingStage | null;
  readonly investment_year: number | null;
  readonly website_url: string | null;
  readonly summary_ar: string | null;
  readonly summary_en: string | null;
  readonly is_exited: boolean;
  readonly is_public: boolean;
  readonly sort_order: number;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface PublicPortfolioCompanyDirectoryRow {
  readonly id: string;
  readonly investor_user_id: string;
  readonly company_id: string | null;
  readonly external_name_ar: string | null;
  readonly external_name_en: string | null;
  readonly logo_path: string | null;
  readonly sector_id: string | null;
  readonly investment_stage: FundingStage | null;
  readonly investment_year: number | null;
  readonly website_url: string | null;
  readonly summary_ar: string | null;
  readonly summary_en: string | null;
  readonly is_exited: boolean;
  readonly sort_order: number;
}

export interface SavedItemRow {
  readonly id: string;
  readonly user_id: string;
  readonly entity_type: SavedEntityType;
  readonly entity_id: string;
  readonly notes: string | null;
  readonly created_at: string;
}
