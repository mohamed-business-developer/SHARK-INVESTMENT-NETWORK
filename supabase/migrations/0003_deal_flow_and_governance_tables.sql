-- ============================================================================
-- Migration 0003: Deal Flow & Governance Tables
-- Tables: pitches, pitch_documents, pitch_reviews, pitch_access_grants,
--         investment_interests, portfolio_companies, saved_items
-- Reference: docs/DATABASE.md §5.6–5.10 & §5.17–5.18
-- ============================================================================

CREATE TABLE public.pitches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE RESTRICT,
  title_ar text,
  title_en text,
  summary_ar text CHECK (summary_ar IS NULL OR char_length(summary_ar) <= 600),
  summary_en text CHECK (summary_en IS NULL OR char_length(summary_en) <= 600),
  problem_ar text,
  problem_en text,
  solution_ar text,
  solution_en text,
  market_opportunity_ar text,
  market_opportunity_en text,
  traction_metrics jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(traction_metrics) = 'object'
  ),
  use_of_funds_ar text,
  use_of_funds_en text,
  funding_stage public.funding_stage NOT NULL,
  instrument public.investment_instrument NOT NULL DEFAULT 'equity',
  target_amount_usd numeric(14,2) NOT NULL CHECK (target_amount_usd > 0),
  min_ticket_usd numeric(14,2) CHECK (
    min_ticket_usd IS NULL OR (min_ticket_usd > 0 AND min_ticket_usd <= target_amount_usd)
  ),
  pre_money_valuation_usd numeric(16,2) CHECK (
    pre_money_valuation_usd IS NULL OR pre_money_valuation_usd > 0
  ),
  equity_offered_pct numeric(5,2) CHECK (
    equity_offered_pct IS NULL OR (equity_offered_pct > 0 AND equity_offered_pct <= 100)
  ),
  currency_code char(3) NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
  closing_date date,
  status public.pitch_status NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  closed_at timestamptz,
  restricted_at timestamptz,
  restricted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  search_text text NOT NULL GENERATED ALWAYS AS (
    coalesce(
      public.normalize_arabic_text(
        coalesce(title_ar, '') || ' ' ||
        coalesce(title_en, '') || ' ' ||
        coalesce(summary_ar, '') || ' ' ||
        coalesce(summary_en, '')
      ),
      ''
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_pitches_bilingual_title CHECK (
    nullif(btrim(title_ar), '') IS NOT NULL OR nullif(btrim(title_en), '') IS NOT NULL
  )
);

CREATE TABLE public.pitch_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  category public.pitch_document_category NOT NULL DEFAULT 'pitch_deck',
  title_ar text,
  title_en text,
  file_name text NOT NULL CHECK (
    char_length(btrim(file_name)) BETWEEN 1 AND 255
    AND file_name !~ '[/\\]'
  ),
  storage_bucket text NOT NULL DEFAULT 'pitch-documents' CHECK (
    storage_bucket = 'pitch-documents'
  ),
  storage_path text NOT NULL UNIQUE CHECK (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|pptx|xlsx|png|jpg|jpeg)$'
  ),
  mime_type text NOT NULL CHECK (
    mime_type IN (
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    )
  ),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
  checksum_sha256 text CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[a-f0-9]{64}$'),
  is_restricted boolean NOT NULL DEFAULT false,
  restriction_reason text,
  restricted_at timestamptz,
  restricted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scan_status public.document_scan_status NOT NULL DEFAULT 'pending',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.pitch_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  decision public.pitch_review_decision NOT NULL,
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checklist) = 'object'),
  feedback_ar text,
  feedback_en text,
  internal_notes text,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pitch_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  pitch_document_id uuid REFERENCES public.pitch_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.investment_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid NOT NULL REFERENCES public.pitches(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  indicative_amount_usd numeric(14,2) CHECK (
    indicative_amount_usd IS NULL OR indicative_amount_usd > 0
  ),
  message text CHECK (message IS NULL OR char_length(message) <= 2000),
  status public.investment_interest_status NOT NULL DEFAULT 'submitted',
  founder_notes text,
  reviewed_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.portfolio_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  external_name_ar text,
  external_name_en text,
  logo_path text,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  investment_stage public.funding_stage,
  investment_year smallint CHECK (
    investment_year IS NULL OR investment_year BETWEEN 1970 AND 2100
  ),
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://'),
  summary_ar text CHECK (summary_ar IS NULL OR char_length(summary_ar) <= 500),
  summary_en text CHECK (summary_en IS NULL OR char_length(summary_en) <= 500),
  is_exited boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_portfolio_company_identity CHECK (
    company_id IS NOT NULL
    OR nullif(btrim(external_name_ar), '') IS NOT NULL
    OR nullif(btrim(external_name_en), '') IS NOT NULL
  )
);

CREATE TABLE public.saved_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type public.saved_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  notes text CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_saved_items_user_entity UNIQUE (user_id, entity_type, entity_id)
);
