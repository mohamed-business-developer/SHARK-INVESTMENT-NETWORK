-- ============================================================================
-- Migration 0002: Core Tables (sectors, profiles, investors, founders, companies, company_members)
-- Reference: docs/DATABASE.md §5.1–5.5 & §5.15
-- ============================================================================

CREATE TABLE public.sectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ar text NOT NULL CHECK (char_length(btrim(name_ar)) BETWEEN 2 AND 80),
  name_en text NOT NULL CHECK (char_length(btrim(name_en)) BETWEEN 2 AND 80),
  description_ar text,
  description_en text,
  icon_name text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{6,14}$'),
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  full_name_ar text CHECK (full_name_ar IS NULL OR char_length(btrim(full_name_ar)) BETWEEN 2 AND 120),
  full_name_en text CHECK (full_name_en IS NULL OR char_length(btrim(full_name_en)) BETWEEN 2 AND 120),
  headline_ar text CHECK (headline_ar IS NULL OR char_length(headline_ar) <= 160),
  headline_en text CHECK (headline_en IS NULL OR char_length(headline_en) <= 160),
  bio_ar text CHECK (bio_ar IS NULL OR char_length(bio_ar) <= 2000),
  bio_en text CHECK (bio_en IS NULL OR char_length(bio_en) <= 2000),
  avatar_path text,
  country_code char(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  city_ar text CHECK (city_ar IS NULL OR char_length(city_ar) <= 80),
  city_en text CHECK (city_en IS NULL OR char_length(city_en) <= 80),
  preferred_language public.language_code NOT NULL DEFAULT 'ar',
  role public.user_role NOT NULL DEFAULT 'member',
  account_status public.account_status NOT NULL DEFAULT 'pending',
  onboarding_completed boolean NOT NULL DEFAULT false,
  onboarding_step text NOT NULL DEFAULT 'account_type' CHECK (
    onboarding_step IN ('account_type', 'profile_setup', 'verification', 'completed')
  ),
  interest_sector_ids uuid[] NOT NULL DEFAULT '{}',
  notification_preferences jsonb NOT NULL DEFAULT '{"push":true,"email":true,"announcements":true}'::jsonb CHECK (
    jsonb_typeof(notification_preferences) = 'object'
  ),
  analytics_opt_in boolean NOT NULL DEFAULT false,
  rejection_reason text,
  suspension_reason text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  suspended_at timestamptz,
  suspended_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_active_at timestamptz,
  search_text text NOT NULL GENERATED ALWAYS AS (
    coalesce(
      public.normalize_arabic_text(
        coalesce(full_name, '') || ' ' ||
        coalesce(full_name_ar, '') || ' ' ||
        coalesce(full_name_en, '') || ' ' ||
        coalesce(headline_ar, '') || ' ' ||
        coalesce(headline_en, '')
      ),
      ''
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  investor_type public.investor_type NOT NULL DEFAULT 'angel',
  firm_name_ar text CHECK (firm_name_ar IS NULL OR char_length(firm_name_ar) <= 120),
  firm_name_en text CHECK (firm_name_en IS NULL OR char_length(firm_name_en) <= 120),
  title_ar text CHECK (title_ar IS NULL OR char_length(title_ar) <= 100),
  title_en text CHECK (title_en IS NULL OR char_length(title_en) <= 100),
  thesis_ar text CHECK (thesis_ar IS NULL OR char_length(thesis_ar) <= 2500),
  thesis_en text CHECK (thesis_en IS NULL OR char_length(thesis_en) <= 2500),
  focus_sector_ids uuid[] NOT NULL DEFAULT '{}',
  preferred_stages public.funding_stage[] NOT NULL DEFAULT '{}',
  ticket_min_usd numeric(14,2) CHECK (ticket_min_usd IS NULL OR ticket_min_usd >= 0),
  ticket_max_usd numeric(14,2) CHECK (
    ticket_max_usd IS NULL OR ticket_min_usd IS NULL OR ticket_max_usd >= ticket_min_usd
  ),
  currency_code char(3) NOT NULL DEFAULT 'USD' CHECK (currency_code ~ '^[A-Z]{3}$'),
  geography_focus text[] NOT NULL DEFAULT '{}',
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://'),
  linkedin_url text CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://'),
  is_accredited boolean NOT NULL DEFAULT false,
  accreditation_verified_at timestamptz,
  is_featured boolean NOT NULL DEFAULT false,
  is_public_listed boolean NOT NULL DEFAULT true,
  portfolio_count integer NOT NULL DEFAULT 0 CHECK (portfolio_count >= 0),
  search_text text NOT NULL GENERATED ALWAYS AS (
    coalesce(
      public.normalize_arabic_text(
        coalesce(firm_name_ar, '') || ' ' ||
        coalesce(firm_name_en, '') || ' ' ||
        coalesce(title_ar, '') || ' ' ||
        coalesce(title_en, '') || ' ' ||
        coalesce(thesis_ar, '') || ' ' ||
        coalesce(thesis_en, '')
      ),
      ''
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_title_ar text CHECK (job_title_ar IS NULL OR char_length(job_title_ar) <= 100),
  job_title_en text CHECK (job_title_en IS NULL OR char_length(job_title_en) <= 100),
  experience_years smallint CHECK (experience_years IS NULL OR experience_years BETWEEN 0 AND 70),
  previous_exits_count smallint NOT NULL DEFAULT 0 CHECK (previous_exits_count >= 0),
  founder_bio_ar text CHECK (founder_bio_ar IS NULL OR char_length(founder_bio_ar) <= 2000),
  founder_bio_en text CHECK (founder_bio_en IS NULL OR char_length(founder_bio_en) <= 2000),
  linkedin_url text CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://'),
  primary_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  is_public_listed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_ar text,
  name_en text,
  tagline_ar text CHECK (tagline_ar IS NULL OR char_length(tagline_ar) <= 180),
  tagline_en text CHECK (tagline_en IS NULL OR char_length(tagline_en) <= 180),
  description_ar text CHECK (description_ar IS NULL OR char_length(description_ar) <= 4000),
  description_en text CHECK (description_en IS NULL OR char_length(description_en) <= 4000),
  logo_path text,
  banner_path text,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE RESTRICT,
  secondary_sector_ids uuid[] NOT NULL DEFAULT '{}',
  stage public.funding_stage NOT NULL DEFAULT 'pre_seed',
  founded_year smallint CHECK (founded_year IS NULL OR founded_year BETWEEN 1900 AND 2100),
  country_code char(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  city_ar text CHECK (city_ar IS NULL OR char_length(city_ar) <= 80),
  city_en text CHECK (city_en IS NULL OR char_length(city_en) <= 80),
  team_size_band text CHECK (
    team_size_band IS NULL OR team_size_band IN ('1-10', '11-50', '51-200', '201-500', '500+')
  ),
  website_url text CHECK (website_url IS NULL OR website_url ~ '^https://'),
  linkedin_url text CHECK (linkedin_url IS NULL OR linkedin_url ~ '^https://'),
  registration_number text,
  status public.company_status NOT NULL DEFAULT 'draft',
  verification_status public.verification_badge_status NOT NULL DEFAULT 'unverified',
  is_featured boolean NOT NULL DEFAULT false,
  rejection_reason text,
  admin_feedback text,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  search_text text NOT NULL GENERATED ALWAYS AS (
    coalesce(
      public.normalize_arabic_text(
        coalesce(name_ar, '') || ' ' ||
        coalesce(name_en, '') || ' ' ||
        coalesce(tagline_ar, '') || ' ' ||
        coalesce(tagline_en, '')
      ),
      ''
    )
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_companies_bilingual_name CHECK (
    nullif(btrim(name_ar), '') IS NOT NULL OR nullif(btrim(name_en), '') IS NOT NULL
  )
);

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role public.company_member_role NOT NULL DEFAULT 'editor',
  title_ar text CHECK (title_ar IS NULL OR char_length(title_ar) <= 100),
  title_en text CHECK (title_en IS NULL OR char_length(title_en) <= 100),
  status public.company_member_status NOT NULL DEFAULT 'invited',
  can_manage_pitches boolean NOT NULL DEFAULT false,
  can_manage_documents boolean NOT NULL DEFAULT false,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
