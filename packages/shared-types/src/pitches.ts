import type {
  FundingStage,
  InvestmentInstrument,
  InvestmentInterestStatus,
  PitchReviewDecision,
  PitchStatus,
} from './enums';

export interface PitchRow {
  readonly id: string;
  readonly company_id: string;
  readonly created_by: string;
  readonly sector_id: string;
  readonly title_ar: string | null;
  readonly title_en: string | null;
  readonly summary_ar: string | null;
  readonly summary_en: string | null;
  readonly problem_ar: string | null;
  readonly problem_en: string | null;
  readonly solution_ar: string | null;
  readonly solution_en: string | null;
  readonly market_opportunity_ar: string | null;
  readonly market_opportunity_en: string | null;
  readonly traction_metrics: Record<string, string | number | boolean | null>;
  readonly use_of_funds_ar: string | null;
  readonly use_of_funds_en: string | null;
  readonly funding_stage: FundingStage;
  readonly instrument: InvestmentInstrument;
  readonly target_amount_usd: number;
  readonly min_ticket_usd: number | null;
  readonly pre_money_valuation_usd: number | null;
  readonly equity_offered_pct: number | null;
  readonly currency_code: string;
  readonly closing_date: string | null;
  readonly status: PitchStatus;
  readonly is_featured: boolean;
  readonly rejection_reason: string | null;
  readonly submitted_at: string | null;
  readonly approved_at: string | null;
  readonly approved_by: string | null;
  readonly closed_at: string | null;
  readonly restricted_at: string | null;
  readonly restricted_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}

/**
 * Investor-safe pitch projection omitting moderation/operator-only metadata.
 */
export type InvestorPitchRow = Omit<
  PitchRow,
  'rejection_reason' | 'approved_by' | 'restricted_at' | 'restricted_by'
>;

export interface PitchReviewRow {
  readonly id: string;
  readonly pitch_id: string;
  readonly reviewer_id: string;
  readonly decision: PitchReviewDecision;
  readonly checklist: Record<string, boolean | string | number>;
  readonly feedback_ar: string | null;
  readonly feedback_en: string | null;
  readonly internal_notes: string | null;
  readonly is_internal: boolean;
  readonly created_at: string;
}

export interface PitchAccessGrantRow {
  readonly id: string;
  readonly pitch_id: string;
  readonly pitch_document_id: string | null;
  readonly user_id: string;
  readonly granted_by: string;
  readonly reason: string | null;
  readonly expires_at: string | null;
  readonly revoked_at: string | null;
  readonly revoked_by: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface InvestmentInterestRow {
  readonly id: string;
  readonly pitch_id: string;
  readonly company_id: string;
  readonly investor_id: string;
  readonly indicative_amount_usd: number | null;
  readonly message: string | null;
  readonly status: InvestmentInterestStatus;
  readonly founder_notes: string | null;
  readonly reviewed_at: string | null;
  readonly withdrawn_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
}
