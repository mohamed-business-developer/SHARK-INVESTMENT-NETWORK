-- ============================================================================
-- Migration 0005: Indexes, Partial Uniques & Arabic/English Trigram Search
-- Reference: docs/DATABASE.md §7.3
-- ============================================================================

-- Sectors
CREATE UNIQUE INDEX uq_sectors_active_slug
  ON public.sectors (slug)
  WHERE deleted_at IS NULL;

-- Profiles
CREATE UNIQUE INDEX uq_profiles_active_email
  ON public.profiles (lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_profiles_status_role_cursor
  ON public.profiles (account_status, role, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_profiles_search_trgm
  ON public.profiles USING gin (search_text gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Investors
CREATE INDEX idx_investors_public_cursor
  ON public.investors (is_featured DESC, created_at DESC, id DESC)
  INCLUDE (user_id, investor_type, ticket_min_usd, ticket_max_usd)
  WHERE deleted_at IS NULL AND is_public_listed = true;

CREATE INDEX idx_investors_sectors_gin
  ON public.investors USING gin (focus_sector_ids)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_investors_stages_gin
  ON public.investors USING gin (preferred_stages)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_investors_search_trgm
  ON public.investors USING gin (search_text gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Companies
CREATE UNIQUE INDEX uq_companies_active_slug
  ON public.companies (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_companies_approved_cursor
  ON public.companies (is_featured DESC, approved_at DESC, id DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX idx_companies_filter_sector_verif
  ON public.companies (sector_id, verification_status, stage, country_code)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX idx_companies_admin_queue
  ON public.companies (status, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_companies_search_trgm
  ON public.companies USING gin (search_text gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Company Members
CREATE UNIQUE INDEX uq_company_members_active
  ON public.company_members (company_id, user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_company_members_user_active
  ON public.company_members (user_id, company_id)
  WHERE status = 'active' AND deleted_at IS NULL;

-- Pitches
CREATE INDEX idx_pitches_approved_cursor
  ON public.pitches (is_featured DESC, approved_at DESC, id DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX idx_pitches_filter_sector_stage
  ON public.pitches (sector_id, funding_stage, instrument, target_amount_usd)
  WHERE deleted_at IS NULL AND status IN ('approved', 'restricted');

CREATE INDEX idx_pitches_company_status
  ON public.pitches (company_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_pitches_search_trgm
  ON public.pitches USING gin (search_text gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- Pitch Documents
CREATE INDEX idx_pitch_docs_pitch_active
  ON public.pitch_documents (pitch_id, sort_order, created_at)
  WHERE deleted_at IS NULL AND is_active = true;

-- Pitch Access Grants
CREATE UNIQUE INDEX uq_pitch_access_grants_active
  ON public.pitch_access_grants (
    pitch_id,
    coalesce(pitch_document_id, '00000000-0000-0000-0000-000000000000'::uuid),
    user_id
  )
  WHERE revoked_at IS NULL;

CREATE INDEX idx_pitch_grants_user_active
  ON public.pitch_access_grants (user_id, pitch_id, expires_at)
  WHERE revoked_at IS NULL;

-- Investment Interests
CREATE UNIQUE INDEX uq_interest_pitch_investor_active
  ON public.investment_interests (pitch_id, investor_id)
  WHERE status <> 'withdrawn' AND deleted_at IS NULL;

CREATE INDEX idx_interest_pitch_created
  ON public.investment_interests (pitch_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

-- Saved Items
CREATE INDEX idx_saved_items_user_type_cursor
  ON public.saved_items (user_id, entity_type, created_at DESC, id DESC);

-- Notifications
CREATE INDEX idx_notifications_inbox_cursor
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_notifications_unread_count
  ON public.notifications (user_id)
  WHERE is_read = false AND deleted_at IS NULL;

-- Verification Requests
CREATE INDEX idx_verif_queue_cursor
  ON public.verification_requests (status, subject_type, created_at ASC, id ASC)
  WHERE deleted_at IS NULL;

-- Admin Roles
CREATE UNIQUE INDEX uq_admin_roles_active_user
  ON public.admin_roles (user_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- Activity Logs
CREATE INDEX idx_activity_logs_cursor
  ON public.activity_logs (created_at DESC, id DESC);

CREATE INDEX idx_activity_logs_entity
  ON public.activity_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX idx_activity_logs_actor
  ON public.activity_logs (actor_id, created_at DESC)
  WHERE actor_id IS NOT NULL;

-- Device Tokens
CREATE INDEX idx_device_tokens_user_active
  ON public.device_tokens (user_id)
  WHERE is_active = true;

-- Support Requests
CREATE INDEX idx_support_status_cursor
  ON public.support_requests (status, created_at DESC, id DESC)
  WHERE deleted_at IS NULL;
