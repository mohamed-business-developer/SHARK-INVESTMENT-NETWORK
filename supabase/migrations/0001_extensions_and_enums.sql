-- ============================================================================
-- Migration 0001: Extensions, Arabic Normalization Helper & All 23 Enums
-- Reference: docs/DATABASE.md §2 & §7.2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Private internal schema for server-only operational helpers (e.g., sliding-window rate limits)
CREATE SCHEMA IF NOT EXISTS private_internal;
REVOKE ALL ON SCHEMA private_internal FROM PUBLIC;

-- Diacritic-insensitive Arabic + case-insensitive English text normalizer
-- Used in GENERATED ALWAYS AS search_text columns and GIN trigram indexes.
CREATE OR REPLACE FUNCTION public.normalize_arabic_text(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT btrim(
    regexp_replace(
      translate(
        regexp_replace(lower(input), E'[\u064B-\u065F\u0670\u0640]', '', 'g'),
        'أإآىة',
        'ااايه'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

-- ============================================================================
-- Core Canonical Enums (7)
-- ============================================================================

CREATE TYPE public.user_role AS ENUM (
  'investor',
  'founder',
  'member',
  'admin'
);

CREATE TYPE public.account_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'suspended'
);

CREATE TYPE public.company_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'suspended'
);

CREATE TYPE public.verification_badge_status AS ENUM (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

CREATE TYPE public.pitch_status AS ENUM (
  'draft',
  'pending',
  'approved',
  'rejected',
  'closed',
  'restricted'
);

CREATE TYPE public.verification_request_status AS ENUM (
  'pending',
  'needs_info',
  'approved',
  'rejected'
);

CREATE TYPE public.admin_role_name AS ENUM (
  'super_admin',
  'operations_admin',
  'compliance_reviewer',
  'content_moderator',
  'analyst_readonly'
);

-- ============================================================================
-- Supporting Domain Enums (16)
-- ============================================================================

CREATE TYPE public.language_code AS ENUM ('ar', 'en');

CREATE TYPE public.investor_type AS ENUM (
  'angel',
  'vc_fund',
  'family_office',
  'corporate_vc',
  'syndicate',
  'institutional'
);

CREATE TYPE public.funding_stage AS ENUM (
  'pre_seed',
  'seed',
  'series_a',
  'series_b',
  'growth',
  'late_stage'
);

CREATE TYPE public.investment_instrument AS ENUM (
  'equity',
  'safe',
  'convertible_note',
  'revenue_share',
  'debt',
  'other'
);

CREATE TYPE public.company_member_role AS ENUM (
  'owner',
  'co_founder',
  'executive',
  'advisor',
  'editor'
);

CREATE TYPE public.company_member_status AS ENUM (
  'invited',
  'active',
  'revoked'
);

CREATE TYPE public.pitch_document_category AS ENUM (
  'pitch_deck',
  'financial_model',
  'cap_table',
  'legal_doc',
  'traction_report',
  'other'
);

CREATE TYPE public.document_scan_status AS ENUM (
  'pending',
  'clean',
  'quarantined'
);

CREATE TYPE public.investment_interest_status AS ENUM (
  'submitted',
  'reviewing',
  'shortlisted',
  'connected',
  'declined',
  'withdrawn'
);

CREATE TYPE public.saved_entity_type AS ENUM (
  'investor',
  'company',
  'pitch'
);

CREATE TYPE public.notification_category AS ENUM (
  'account_status',
  'verification',
  'company_review',
  'pitch_review',
  'investment_interest',
  'access_grant',
  'announcement',
  'security'
);

CREATE TYPE public.verification_subject_type AS ENUM (
  'user_identity',
  'investor_accreditation',
  'company_kyb'
);

CREATE TYPE public.device_platform AS ENUM ('ios', 'android', 'web');

CREATE TYPE public.pitch_review_decision AS ENUM (
  'approved',
  'approved_restricted',
  'needs_info',
  'rejected',
  'restricted',
  'unrestricted',
  'closed'
);

CREATE TYPE public.support_request_category AS ENUM (
  'account_approval',
  'verification',
  'technical_issue',
  'appeal',
  'content_report',
  'general'
);

CREATE TYPE public.support_request_status AS ENUM (
  'open',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed'
);
