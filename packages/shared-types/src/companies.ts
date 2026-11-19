import type {
  CompanyMemberRole,
  CompanyMemberStatus,
  CompanyStatus,
  DocumentScanStatus,
  FundingStage,
  TeamSizeBand,
  VerificationBadgeStatus,
  VerificationRequestStatus,
  VerificationSubjectType,
} from './enums';

export interface CompanyRow {
  readonly id: string;
  readonly owner_id: string;
  readonly slug: string;
  readonly name_ar: string | null;
  readonly name_en: string | null;
  readonly tagline_ar: string | null;
  readonly tagline_en: string | null;
  readonly description_ar: string | null;
  readonly description_en: string | null;
  readonly logo_path: string | null;
  readonly banner_path: string | null;
  readonly sector_id: string;
  readonly secondary_sector_ids: readonly string[];
  readonly stage: FundingStage;
  readonly founded_year: number | null;
  readonly country_code: string;
  readonly city_ar: string | null;
  readonly city_en: string | null;
  readonly team_size_band: TeamSizeBand | null;
  readonly website_url: string | null;
  readonly linkedin_url: string | null;
  readonly registration_number: string | null;
  readonly status: CompanyStatus;
  readonly verification_status: VerificationBadgeStatus;
  readonly is_featured: boolean;
  readonly rejection_reason: string | null;
  readonly admin_feedback: string | null;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
  readonly verified_at: string | null;
  readonly verified_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface PublicCompanyDirectoryRow {
  readonly id: string;
  readonly slug: string;
  readonly name_ar: string | null;
  readonly name_en: string | null;
  readonly tagline_ar: string | null;
  readonly tagline_en: string | null;
  readonly description_ar: string | null;
  readonly description_en: string | null;
  readonly logo_path: string | null;
  readonly banner_path: string | null;
  readonly sector_id: string;
  readonly secondary_sector_ids: readonly string[];
  readonly stage: FundingStage;
  readonly founded_year: number | null;
  readonly country_code: string;
  readonly city_ar: string | null;
  readonly city_en: string | null;
  readonly team_size_band: TeamSizeBand | null;
  readonly website_url: string | null;
  readonly linkedin_url: string | null;
  readonly verification_status: VerificationBadgeStatus;
  readonly is_featured: boolean;
  readonly approved_at: string | null;
}

export interface CompanyMemberRow {
  readonly id: string;
  readonly company_id: string;
  readonly user_id: string;
  readonly member_role: CompanyMemberRole;
  readonly title_ar: string | null;
  readonly title_en: string | null;
  readonly status: CompanyMemberStatus;
  readonly can_manage_pitches: boolean;
  readonly can_manage_documents: boolean;
  readonly invited_by: string | null;
  readonly joined_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

export interface VerificationDocumentMetadata {
  readonly path: string;
  readonly file_name: string;
  readonly mime_type: string;
  readonly file_size_bytes: number;
  readonly scan_status: DocumentScanStatus;
}

export interface VerificationRequestRow {
  readonly id: string;
  readonly user_id: string;
  readonly company_id: string | null;
  readonly subject_type: VerificationSubjectType;
  readonly status: VerificationRequestStatus;
  readonly storage_bucket: 'verification-documents';
  readonly document_paths: readonly VerificationDocumentMetadata[];
  readonly submission_notes: string | null;
  readonly reviewer_id: string | null;
  readonly review_notes: string | null;
  readonly internal_notes?: string | null;
  readonly reviewed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}
