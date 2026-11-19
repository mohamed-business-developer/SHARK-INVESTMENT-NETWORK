-- ============================================================================
-- Migration 0004: Operations, Notifications, Verification, Admin Roles & Audit Tables
-- Tables: notifications, device_tokens, verification_requests, admin_roles,
--         activity_logs, system_settings, support_requests
-- Plus private_internal.rate_limit_events for Edge Function sliding-window rate limits
-- Reference: docs/DATABASE.md §5.11–5.20 & docs/SECURITY.md §7.2
-- ============================================================================

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  category public.notification_category NOT NULL,
  title_ar text NOT NULL CHECK (char_length(btrim(title_ar)) BETWEEN 1 AND 160),
  title_en text NOT NULL CHECK (char_length(btrim(title_en)) BETWEEN 1 AND 160),
  body_ar text NOT NULL CHECK (char_length(btrim(body_ar)) BETWEEN 1 AND 1000),
  body_en text NOT NULL CHECK (char_length(btrim(body_en)) BETWEEN 1 AND 1000),
  deep_link text CHECK (
    deep_link IS NULL OR (deep_link LIKE '/%' AND deep_link NOT LIKE '//%' AND deep_link NOT LIKE '%..%')
  ),
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL UNIQUE CHECK (
    expo_push_token ~ '^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$'
  ),
  platform public.device_platform NOT NULL,
  device_id text,
  app_version text,
  locale public.language_code NOT NULL DEFAULT 'ar',
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  subject_type public.verification_subject_type NOT NULL,
  status public.verification_request_status NOT NULL DEFAULT 'pending',
  storage_bucket text NOT NULL DEFAULT 'verification-documents' CHECK (
    storage_bucket = 'verification-documents'
  ),
  document_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(document_paths) = 'array'
  ),
  submission_notes text CHECK (
    submission_notes IS NULL OR char_length(submission_notes) <= 1000
  ),
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes text,
  internal_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_verification_company_kyb CHECK (
    (subject_type = 'company_kyb') = (company_id IS NOT NULL)
  )
);

CREATE TABLE public.admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_name public.admin_role_name NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role public.user_role,
  actor_admin_role public.admin_role_name,
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 3 AND 100),
  entity_type text NOT NULL CHECK (char_length(btrim(entity_type)) BETWEEN 2 AND 64),
  entity_id uuid,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  request_id text,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE CHECK (
    setting_key ~ '^[a-z0-9_]+(\.[a-z0-9_]+)*$'
  ),
  value jsonb NOT NULL,
  description_ar text,
  description_en text,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contact_email text,
  category public.support_request_category NOT NULL DEFAULT 'general',
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 3 AND 160),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 10 AND 4000),
  status public.support_request_status NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_response text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Server-only sliding-window rate limit store isolated outside public schema
CREATE TABLE private_internal.rate_limit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bucket_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limit_bucket_created
  ON private_internal.rate_limit_events (bucket_key, created_at DESC);
