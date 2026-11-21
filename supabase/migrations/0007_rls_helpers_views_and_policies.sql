-- ============================================================================
-- Migration 0007: RLS Security Helpers, Non-PII Public Views, Force RLS Policies & Atomic Audit RPCs
-- Reference: docs/DATABASE.md §8 & docs/SECURITY.md §4, §6
-- ============================================================================

-- ============================================================================
-- 1. Canonical SECURITY DEFINER Authorization Helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_approved_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.account_status = 'approved'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_not_suspended()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.account_status <> 'suspended'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_admin(required_scope text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.admin_roles ar ON ar.user_id = p.id
    WHERE p.id = auth.uid()
      AND p.deleted_at IS NULL
      AND p.role = 'admin'
      AND p.account_status = 'approved'
      AND ar.deleted_at IS NULL
      AND ar.is_active = true
      AND (
        required_scope IS NULL
        OR ar.role_name = 'super_admin'
        OR required_scope = ANY(ar.permissions)
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_operator(target_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.is_approved_user()
    AND EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = target_company_id
        AND c.deleted_at IS NULL
        AND c.status <> 'suspended'
        AND (
          c.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.company_members cm
            WHERE cm.company_id = c.id
              AND cm.user_id = auth.uid()
              AND cm.deleted_at IS NULL
              AND cm.status = 'active'
          )
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_pitch(target_pitch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitches pt
    JOIN public.companies c ON c.id = pt.company_id
    WHERE pt.id = target_pitch_id
      AND pt.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND (
        public.is_active_admin('pitches:read')
        OR public.is_company_operator(pt.company_id)
        OR (
          pt.status = 'approved'
          AND c.status = 'approved'
          AND public.is_approved_user()
        )
        OR (
          pt.status = 'restricted'
          AND c.status = 'approved'
          AND public.is_approved_user()
          AND EXISTS (
            SELECT 1
            FROM public.pitch_access_grants pag
            WHERE pag.pitch_id = pt.id
              AND pag.pitch_document_id IS NULL
              AND pag.user_id = auth.uid()
              AND pag.revoked_at IS NULL
              AND (pag.expires_at IS NULL OR pag.expires_at > now())
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_pitch_document(target_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pitch_documents pd
    JOIN public.pitches pt ON pt.id = pd.pitch_id
    JOIN public.companies c ON c.id = pd.company_id
    WHERE pd.id = target_document_id
      AND pd.deleted_at IS NULL
      AND pd.is_active = true
      AND pt.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND (
        public.is_active_admin('pitches:read')
        OR public.is_company_operator(pd.company_id)
        OR (
          pd.scan_status <> 'quarantined'
          AND public.is_approved_user()
          AND c.status = 'approved'
          AND (
            (pd.is_restricted = false AND pt.status = 'approved')
            OR (
              pt.status IN ('approved', 'restricted')
              AND EXISTS (
                SELECT 1
                FROM public.pitch_access_grants pag
                WHERE pag.pitch_id = pd.pitch_id
                  AND (pag.pitch_document_id IS NULL OR pag.pitch_document_id = pd.id)
                  AND pag.user_id = auth.uid()
                  AND pag.revoked_at IS NULL
                  AND (pag.expires_at IS NULL OR pag.expires_at > now())
              )
            )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_approved_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_not_suspended() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_company_operator(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_pitch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_pitch_document(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_approved_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_not_suspended() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_pitch(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_pitch_document(uuid) TO authenticated;

-- ============================================================================
-- 2. Non-PII Public Projection Views & Safe Public Flags RPC
-- ============================================================================

CREATE OR REPLACE VIEW public.public_investors_directory
WITH (security_invoker = false)
AS
SELECT
  i.id AS investor_id,
  i.user_id,
  p.full_name,
  p.full_name_ar,
  p.full_name_en,
  p.headline_ar,
  p.headline_en,
  p.bio_ar,
  p.bio_en,
  p.avatar_path,
  p.country_code,
  p.city_ar,
  p.city_en,
  i.investor_type,
  i.firm_name_ar,
  i.firm_name_en,
  i.title_ar,
  i.title_en,
  i.thesis_ar,
  i.thesis_en,
  i.focus_sector_ids,
  i.preferred_stages,
  i.ticket_min_usd,
  i.ticket_max_usd,
  i.currency_code,
  i.geography_focus,
  i.website_url,
  i.linkedin_url,
  i.is_featured,
  i.portfolio_count,
  p.approved_at
FROM public.investors i
JOIN public.profiles p ON p.id = i.user_id
WHERE p.role = 'investor'
  AND p.account_status = 'approved'
  AND p.deleted_at IS NULL
  AND i.is_public_listed = true
  AND i.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_companies_directory
WITH (security_invoker = false)
AS
SELECT
  c.id,
  c.slug,
  c.name_ar,
  c.name_en,
  c.tagline_ar,
  c.tagline_en,
  c.description_ar,
  c.description_en,
  c.logo_path,
  c.banner_path,
  c.sector_id,
  c.secondary_sector_ids,
  c.stage,
  c.founded_year,
  c.country_code,
  c.city_ar,
  c.city_en,
  c.team_size_band,
  c.website_url,
  c.linkedin_url,
  c.verification_status,
  c.is_featured,
  c.approved_at
FROM public.companies c
WHERE c.status = 'approved'
  AND c.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.public_portfolio_companies_directory
WITH (security_invoker = false)
AS
SELECT
  pc.id,
  pc.investor_user_id,
  pc.company_id,
  pc.external_name_ar,
  pc.external_name_en,
  pc.logo_path,
  pc.sector_id,
  pc.investment_stage,
  pc.investment_year,
  pc.website_url,
  pc.summary_ar,
  pc.summary_en,
  pc.is_exited,
  pc.sort_order
FROM public.portfolio_companies pc
JOIN public.profiles p ON p.id = pc.investor_user_id
JOIN public.investors i ON i.user_id = p.id
WHERE pc.is_public = true
  AND pc.deleted_at IS NULL
  AND p.account_status = 'approved'
  AND p.deleted_at IS NULL
  AND i.is_public_listed = true
  AND i.deleted_at IS NULL;

GRANT SELECT ON public.public_investors_directory TO anon, authenticated;
GRANT SELECT ON public.public_companies_directory TO anon, authenticated;
GRANT SELECT ON public.public_portfolio_companies_directory TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_system_flags()
RETURNS TABLE (
  setting_key text,
  value jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ss.setting_key, ss.value
  FROM public.system_settings ss
  WHERE ss.is_public = true;
$$;

REVOKE ALL ON FUNCTION public.get_public_system_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_system_flags() TO anon, authenticated;

-- Defense-in-depth table-level privilege lockdown for anon (19 private tables; public discovery uses views/sectors)
REVOKE ALL ON TABLE
  public.profiles,
  public.investors,
  public.founders,
  public.companies,
  public.company_members,
  public.pitches,
  public.pitch_documents,
  public.pitch_reviews,
  public.pitch_access_grants,
  public.investment_interests,
  public.portfolio_companies,
  public.saved_items,
  public.notifications,
  public.device_tokens,
  public.verification_requests,
  public.admin_roles,
  public.activity_logs,
  public.system_settings,
  public.support_requests
FROM PUBLIC, anon;

REVOKE INSERT, UPDATE, DELETE ON TABLE public.sectors FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.activity_logs FROM authenticated;

-- Column-level restriction: revoke full-table SELECT first (required in PostgreSQL to override default role grants)
-- and grant SELECT on safe columns only, excluding internal_notes.
REVOKE SELECT ON TABLE public.verification_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id,
  user_id,
  company_id,
  subject_type,
  status,
  storage_bucket,
  document_paths,
  submission_notes,
  reviewer_id,
  review_notes,
  reviewed_at,
  created_at,
  updated_at,
  deleted_at
) ON public.verification_requests TO authenticated;

-- ============================================================================
-- 3. Enable & Force Row Level Security Across All 20 Tables
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors FORCE ROW LEVEL SECURITY;

ALTER TABLE public.founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founders FORCE ROW LEVEL SECURITY;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pitches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitches FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pitch_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.investment_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_interests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.portfolio_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_companies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items FORCE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests FORCE ROW LEVEL SECURITY;

ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors FORCE ROW LEVEL SECURITY;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pitch_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_reviews FORCE ROW LEVEL SECURITY;

ALTER TABLE public.pitch_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pitch_access_grants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS Policies Across All 20 Tables
-- ============================================================================

-- 1) profiles
CREATE POLICY profiles_select_self_or_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('users:read')
  );

CREATE POLICY profiles_update_self_or_admin
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    (id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR (public.is_active_admin('users:review') AND id <> auth.uid())
  )
  WITH CHECK (
    (id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR (public.is_active_admin('users:review') AND id <> auth.uid())
  );

-- 2) investors
CREATE POLICY investors_select_authorized
  ON public.investors FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR (
      public.is_approved_user()
      AND is_public_listed = true
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id AND p.account_status = 'approved' AND p.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('users:read')
  );

CREATE POLICY investors_insert_self
  ON public.investors FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_not_suspended()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'investor' AND p.deleted_at IS NULL
    )
  );

CREATE POLICY investors_update_self_or_admin
  ON public.investors FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('investors:moderate')
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('investors:moderate')
  );

-- 3) founders
CREATE POLICY founders_select_authorized
  ON public.founders FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR (
      public.is_approved_user()
      AND is_public_listed = true
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id AND p.account_status = 'approved' AND p.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('users:read')
  );

CREATE POLICY founders_insert_self
  ON public.founders FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_not_suspended()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'founder' AND p.deleted_at IS NULL
    )
  );

CREATE POLICY founders_update_self_or_admin
  ON public.founders FOR UPDATE TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('users:review')
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('users:review')
  );

-- 4) companies
CREATE POLICY companies_select_authorized
  ON public.companies FOR SELECT TO authenticated
  USING (
    (status = 'approved' AND deleted_at IS NULL AND public.is_approved_user())
    OR public.is_company_operator(id)
    OR public.is_active_admin('companies:read')
  );

CREATE POLICY companies_insert_approved_founder
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND public.is_approved_user()
    AND status IN ('draft', 'pending')
    AND verification_status = 'unverified'
    AND is_featured = false
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('founder', 'admin') AND p.deleted_at IS NULL
    )
  );

CREATE POLICY companies_update_operator_or_admin
  ON public.companies FOR UPDATE TO authenticated
  USING (
    public.is_company_operator(id)
    OR public.is_active_admin('companies:review')
    OR public.is_active_admin('companies:verify')
  )
  WITH CHECK (
    public.is_company_operator(id)
    OR public.is_active_admin('companies:review')
    OR public.is_active_admin('companies:verify')
  );

-- 5) company_members
CREATE POLICY company_members_select_authorized
  ON public.company_members FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_approved_user() AND deleted_at IS NULL)
    OR public.is_company_operator(company_id)
    OR public.is_active_admin('companies:read')
  );

CREATE POLICY company_members_insert_owner_or_admin
  ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_approved_user()
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid() AND c.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = user_id AND (p.account_status = 'suspended' OR p.role = 'admin')
      )
    )
    OR public.is_active_admin('companies:review')
  );

CREATE POLICY company_members_update_owner_or_admin
  ON public.company_members FOR UPDATE TO authenticated
  USING (
    (
      public.is_approved_user()
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid() AND c.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('companies:review')
  )
  WITH CHECK (
    (
      public.is_approved_user()
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid() AND c.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('companies:review')
  );

CREATE POLICY company_members_delete_owner_or_admin
  ON public.company_members FOR DELETE TO authenticated
  USING (
    (
      public.is_approved_user()
      AND user_id <> auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.companies c
        WHERE c.id = company_id AND c.owner_id = auth.uid() AND c.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('companies:review')
  );

-- 6) pitches
CREATE POLICY pitches_select_authorized
  ON public.pitches FOR SELECT TO authenticated
  USING (public.can_view_pitch(id));

CREATE POLICY pitches_insert_operator
  ON public.pitches FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_company_operator(company_id)
    AND status IN ('draft', 'pending')
    AND is_featured = false
  );

CREATE POLICY pitches_update_operator_or_admin
  ON public.pitches FOR UPDATE TO authenticated
  USING (
    public.is_company_operator(company_id)
    OR public.is_active_admin('pitches:review')
    OR public.is_active_admin('pitches:restrict')
  )
  WITH CHECK (
    public.is_company_operator(company_id)
    OR public.is_active_admin('pitches:review')
    OR public.is_active_admin('pitches:restrict')
  );

CREATE POLICY pitches_delete_draft_operator
  ON public.pitches FOR DELETE TO authenticated
  USING (
    public.is_company_operator(company_id)
    AND status = 'draft'
  );

-- 7) pitch_documents
CREATE POLICY pitch_documents_select_authorized
  ON public.pitch_documents FOR SELECT TO authenticated
  USING (public.can_view_pitch_document(id));

CREATE POLICY pitch_documents_insert_operator
  ON public.pitch_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND public.is_company_operator(company_id)
  );

CREATE POLICY pitch_documents_update_operator_or_admin
  ON public.pitch_documents FOR UPDATE TO authenticated
  USING (
    (
      public.is_company_operator(company_id)
      AND EXISTS (
        SELECT 1 FROM public.pitches pt
        WHERE pt.id = pitch_id AND pt.status IN ('draft', 'pending', 'rejected')
      )
    )
    OR public.is_active_admin('documents:moderate')
    OR public.is_active_admin('pitches:restrict')
  )
  WITH CHECK (
    (
      public.is_company_operator(company_id)
      AND EXISTS (
        SELECT 1 FROM public.pitches pt
        WHERE pt.id = pitch_id AND pt.status IN ('draft', 'pending', 'rejected')
      )
    )
    OR public.is_active_admin('documents:moderate')
    OR public.is_active_admin('pitches:restrict')
  );

CREATE POLICY pitch_documents_delete_draft_or_admin
  ON public.pitch_documents FOR DELETE TO authenticated
  USING (
    (
      public.is_company_operator(company_id)
      AND EXISTS (
        SELECT 1 FROM public.pitches pt
        WHERE pt.id = pitch_id AND pt.status = 'draft'
      )
    )
    OR public.is_active_admin('documents:moderate')
  );

-- 8) investment_interests
CREATE POLICY investment_interests_select_authorized
  ON public.investment_interests FOR SELECT TO authenticated
  USING (
    (investor_id = auth.uid() AND public.is_approved_user() AND deleted_at IS NULL)
    OR public.is_company_operator(company_id)
    OR public.is_active_admin('interests:read')
  );

CREATE POLICY investment_interests_insert_approved_investor
  ON public.investment_interests FOR INSERT TO authenticated
  WITH CHECK (
    investor_id = auth.uid()
    AND public.is_approved_user()
    AND status = 'submitted'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'investor' AND p.deleted_at IS NULL
    )
    AND public.can_view_pitch(pitch_id)
  );

CREATE POLICY investment_interests_update_parties
  ON public.investment_interests FOR UPDATE TO authenticated
  USING (
    (investor_id = auth.uid() AND public.is_approved_user() AND deleted_at IS NULL)
    OR public.is_company_operator(company_id)
  )
  WITH CHECK (
    (investor_id = auth.uid() AND public.is_approved_user() AND status = 'withdrawn' AND deleted_at IS NULL)
    OR public.is_company_operator(company_id)
  );

-- 9) portfolio_companies
CREATE POLICY portfolio_companies_select_authorized
  ON public.portfolio_companies FOR SELECT TO authenticated
  USING (
    (investor_user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR (
      public.is_approved_user()
      AND is_public = true
      AND deleted_at IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = investor_user_id AND p.account_status = 'approved' AND p.deleted_at IS NULL
      )
    )
    OR public.is_active_admin('investors:moderate')
  );

CREATE POLICY portfolio_companies_insert_investor
  ON public.portfolio_companies FOR INSERT TO authenticated
  WITH CHECK (
    investor_user_id = auth.uid()
    AND public.is_approved_user()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'investor' AND p.deleted_at IS NULL
    )
  );

CREATE POLICY portfolio_companies_update_investor_or_admin
  ON public.portfolio_companies FOR UPDATE TO authenticated
  USING (
    (investor_user_id = auth.uid() AND public.is_approved_user() AND deleted_at IS NULL)
    OR public.is_active_admin('investors:moderate')
  )
  WITH CHECK (
    (investor_user_id = auth.uid() AND public.is_approved_user() AND deleted_at IS NULL)
    OR public.is_active_admin('investors:moderate')
  );

CREATE POLICY portfolio_companies_delete_investor_or_admin
  ON public.portfolio_companies FOR DELETE TO authenticated
  USING (
    (investor_user_id = auth.uid() AND public.is_approved_user())
    OR public.is_active_admin('investors:moderate')
  );

-- 10) saved_items
CREATE POLICY saved_items_select_self
  ON public.saved_items FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_approved_user());

CREATE POLICY saved_items_insert_self
  ON public.saved_items FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_approved_user());

CREATE POLICY saved_items_delete_self
  ON public.saved_items FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_approved_user());

-- 11) notifications
CREATE POLICY notifications_select_self_or_admin
  ON public.notifications FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('notifications:send')
  );

CREATE POLICY notifications_update_self
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid() AND public.is_not_suspended());

CREATE POLICY notifications_delete_self
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_not_suspended());

-- 12) verification_requests
CREATE POLICY verification_requests_select_self_or_admin
  ON public.verification_requests FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_not_suspended() AND deleted_at IS NULL)
    OR public.is_active_admin('verifications:read')
  );

CREATE POLICY verification_requests_insert_self
  ON public.verification_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_not_suspended()
    AND status = 'pending'
    AND reviewer_id IS NULL
    AND review_notes IS NULL
    AND internal_notes IS NULL
    AND (
      company_id IS NULL
      OR public.is_company_operator(company_id)
    )
  );

CREATE POLICY verification_requests_update_admin
  ON public.verification_requests FOR UPDATE TO authenticated
  USING (public.is_active_admin('verifications:review') AND user_id <> auth.uid())
  WITH CHECK (public.is_active_admin('verifications:review') AND user_id <> auth.uid());

-- 13) admin_roles
CREATE POLICY admin_roles_select_self_or_super
  ON public.admin_roles FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND is_active = true AND deleted_at IS NULL)
    OR public.is_active_admin('roles:read')
    OR public.is_active_admin('roles:manage')
  );

CREATE POLICY admin_roles_manage_super_admin
  ON public.admin_roles FOR ALL TO authenticated
  USING (public.is_active_admin('roles:manage') AND user_id <> auth.uid())
  WITH CHECK (public.is_active_admin('roles:manage') AND user_id <> auth.uid());

-- 14) activity_logs (SELECT audit:read only; mutations blocked by RLS + trigger)
CREATE POLICY activity_logs_select_audit_admin
  ON public.activity_logs FOR SELECT TO authenticated
  USING (public.is_active_admin('audit:read'));

-- 15) sectors
CREATE POLICY sectors_select_public_or_admin
  ON public.sectors FOR SELECT TO anon, authenticated
  USING (
    (is_active = true AND deleted_at IS NULL)
    OR public.is_active_admin('settings:read')
    OR public.is_active_admin('settings:write')
  );

CREATE POLICY sectors_manage_settings_admin
  ON public.sectors FOR ALL TO authenticated
  USING (public.is_active_admin('settings:write'))
  WITH CHECK (public.is_active_admin('settings:write'));

-- 16) device_tokens
CREATE POLICY device_tokens_select_self
  ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY device_tokens_insert_self
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_not_suspended());

CREATE POLICY device_tokens_update_self
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_not_suspended())
  WITH CHECK (user_id = auth.uid() AND public.is_not_suspended());

CREATE POLICY device_tokens_delete_self
  ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 17) pitch_reviews
CREATE POLICY pitch_reviews_select_operator_or_admin
  ON public.pitch_reviews FOR SELECT TO authenticated
  USING (
    public.is_active_admin('pitches:read')
    OR (
      is_internal = false
      AND EXISTS (
        SELECT 1 FROM public.pitches pt
        WHERE pt.id = pitch_id AND public.is_company_operator(pt.company_id)
      )
    )
  );

CREATE POLICY pitch_reviews_insert_admin
  ON public.pitch_reviews FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND public.is_active_admin('pitches:review')
    AND NOT EXISTS (
      SELECT 1 FROM public.pitches pt
      JOIN public.companies c ON c.id = pt.company_id
      WHERE pt.id = pitch_id AND c.owner_id = auth.uid()
    )
  );

-- 18) pitch_access_grants
CREATE POLICY pitch_access_grants_select_authorized
  ON public.pitch_access_grants FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_approved_user() AND revoked_at IS NULL)
    OR EXISTS (
      SELECT 1 FROM public.pitches pt
      WHERE pt.id = pitch_id AND public.is_company_operator(pt.company_id)
    )
    OR public.is_active_admin('pitches:read')
  );

CREATE POLICY pitch_access_grants_insert_owner_or_admin
  ON public.pitch_access_grants FOR INSERT TO authenticated
  WITH CHECK (
    granted_by = auth.uid()
    AND (
      public.is_active_admin('pitches:restrict')
      OR EXISTS (
        SELECT 1 FROM public.pitches pt
        WHERE pt.id = pitch_id AND public.is_company_operator(pt.company_id)
      )
    )
  );

CREATE POLICY pitch_access_grants_update_owner_or_admin
  ON public.pitch_access_grants FOR UPDATE TO authenticated
  USING (
    public.is_active_admin('pitches:restrict')
    OR EXISTS (
      SELECT 1 FROM public.pitches pt
      WHERE pt.id = pitch_id AND public.is_company_operator(pt.company_id)
    )
  )
  WITH CHECK (
    public.is_active_admin('pitches:restrict')
    OR EXISTS (
      SELECT 1 FROM public.pitches pt
      WHERE pt.id = pitch_id AND public.is_company_operator(pt.company_id)
    )
  );

-- 19) system_settings
CREATE POLICY system_settings_select_admin
  ON public.system_settings FOR SELECT TO authenticated
  USING (public.is_active_admin('settings:read') OR public.is_active_admin('settings:write'));

CREATE POLICY system_settings_insert_admin
  ON public.system_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_active_admin('settings:write'));

CREATE POLICY system_settings_update_admin
  ON public.system_settings FOR UPDATE TO authenticated
  USING (public.is_active_admin('settings:write'))
  WITH CHECK (public.is_active_admin('settings:write'));

-- 20) support_requests
CREATE POLICY support_requests_select_self_or_admin
  ON public.support_requests FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid() AND deleted_at IS NULL)
    OR public.is_active_admin('support:read')
  );

CREATE POLICY support_requests_insert_self
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'open'
    AND assigned_to IS NULL
    AND admin_response IS NULL
  );

CREATE POLICY support_requests_update_admin
  ON public.support_requests FOR UPDATE TO authenticated
  USING (public.is_active_admin('support:manage'))
  WITH CHECK (public.is_active_admin('support:manage'));

-- ============================================================================
-- 5. Server-Only Sliding-Window Rate Limiter & Atomic Audit RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket_key text,
  p_max_requests integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private_internal, pg_temp
AS $$
DECLARE
  v_count integer;
  v_cutoff timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
BEGIN
  DELETE FROM private_internal.rate_limit_events
  WHERE bucket_key = p_bucket_key
    AND created_at < v_cutoff;

  SELECT count(*)::integer INTO v_count
  FROM private_internal.rate_limit_events
  WHERE bucket_key = p_bucket_key
    AND created_at >= v_cutoff;

  IF v_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO private_internal.rate_limit_events (bucket_key)
  VALUES (p_bucket_key);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

-- Atomic admin setting mutation + activity_logs insert
CREATE OR REPLACE FUNCTION public.admin_update_system_setting(
  p_setting_key text,
  p_value jsonb,
  p_reason text,
  p_is_public boolean DEFAULT NULL,
  p_request_id text DEFAULT NULL
)
RETURNS public.system_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_prev public.system_settings;
  v_next public.system_settings;
  v_admin_role public.admin_role_name;
BEGIN
  IF NOT public.is_active_admin('settings:write') THEN
    RAISE EXCEPTION 'Forbidden: settings:write scope required' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Audit reason (>= 10 characters) is required' USING ERRCODE = '23514';
  END IF;

  SELECT ar.role_name INTO v_admin_role
  FROM public.admin_roles ar
  WHERE ar.user_id = v_actor_id AND ar.is_active = true AND ar.deleted_at IS NULL
  LIMIT 1;

  SELECT * INTO v_prev FROM public.system_settings WHERE setting_key = p_setting_key;

  INSERT INTO public.system_settings (setting_key, value, is_public, updated_by)
  VALUES (p_setting_key, p_value, coalesce(p_is_public, false), v_actor_id)
  ON CONFLICT (setting_key) DO UPDATE
    SET value = EXCLUDED.value,
        is_public = coalesce(p_is_public, public.system_settings.is_public),
        updated_by = v_actor_id
  RETURNING * INTO v_next;

  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_admin_role, action, entity_type, entity_id,
    previous_state, new_state, reason, request_id
  ) VALUES (
    v_actor_id, 'admin', v_admin_role, 'system_settings.update', 'system_settings', v_next.id,
    CASE WHEN v_prev.id IS NOT NULL THEN jsonb_build_object('setting_key', v_prev.setting_key, 'value', v_prev.value, 'is_public', v_prev.is_public) ELSE NULL END,
    jsonb_build_object('setting_key', v_next.setting_key, 'value', v_next.value, 'is_public', v_next.is_public),
    btrim(p_reason),
    p_request_id
  );

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_system_setting(text, jsonb, text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_system_setting(text, jsonb, text, boolean, text) TO authenticated, service_role;

-- Atomic admin user lifecycle action + activity_logs insert
CREATE OR REPLACE FUNCTION public.admin_execute_user_action(
  p_actor_id uuid,
  p_action text,
  p_target_user_id uuid,
  p_role public.user_role DEFAULT NULL,
  p_admin_role public.admin_role_name DEFAULT NULL,
  p_permissions text[] DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_profile public.profiles;
  v_actor_admin public.admin_roles;
  v_target public.profiles;
  v_updated public.profiles;
  v_required_scope text;
  v_prev_state jsonb;
  v_new_state jsonb;
BEGIN
  IF p_actor_id IS NULL OR p_target_user_id IS NULL OR p_actor_id = p_target_user_id THEN
    RAISE EXCEPTION 'Invalid actor or self-action prohibited' USING ERRCODE = '42501';
  END IF;

  v_required_scope := CASE p_action
    WHEN 'approve' THEN 'users:review'
    WHEN 'reject' THEN 'users:review'
    WHEN 'reactivate' THEN 'users:review'
    WHEN 'suspend' THEN 'users:suspend'
    WHEN 'change_role' THEN 'roles:manage'
    WHEN 'assign_admin_role' THEN 'roles:manage'
    ELSE NULL
  END;

  IF v_required_scope IS NULL THEN
    RAISE EXCEPTION 'Unsupported admin user action' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.profiles p
  WHERE p.id = p_actor_id AND p.deleted_at IS NULL AND p.role = 'admin' AND p.account_status = 'approved';

  SELECT * INTO v_actor_admin
  FROM public.admin_roles ar
  WHERE ar.user_id = p_actor_id AND ar.deleted_at IS NULL AND ar.is_active = true;

  IF v_actor_profile.id IS NULL OR v_actor_admin.id IS NULL OR NOT (
    v_actor_admin.role_name = 'super_admin' OR v_required_scope = ANY(v_actor_admin.permissions)
  ) THEN
    RAISE EXCEPTION 'Forbidden: insufficient admin permissions' USING ERRCODE = '42501';
  END IF;

  IF p_action IN ('reject', 'suspend') AND (p_reason IS NULL OR char_length(btrim(p_reason)) < 10) THEN
    RAISE EXCEPTION 'Audit reason (>= 10 characters) is required' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_user_id AND deleted_at IS NULL FOR UPDATE;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Target profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_prev_state := jsonb_build_object(
    'role', v_target.role,
    'account_status', v_target.account_status
  );

  IF p_action = 'approve' THEN
    UPDATE public.profiles
    SET account_status = 'approved',
        approved_at = now(),
        approved_by = p_actor_id,
        rejection_reason = NULL,
        suspension_reason = NULL
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;
  ELSIF p_action = 'reject' THEN
    UPDATE public.profiles
    SET account_status = 'rejected',
        rejected_at = now(),
        rejected_by = p_actor_id,
        rejection_reason = btrim(p_reason)
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;
  ELSIF p_action = 'suspend' THEN
    UPDATE public.profiles
    SET account_status = 'suspended',
        suspended_at = now(),
        suspended_by = p_actor_id,
        suspension_reason = btrim(p_reason)
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;
  ELSIF p_action = 'reactivate' THEN
    UPDATE public.profiles
    SET account_status = 'approved',
        approved_at = now(),
        approved_by = p_actor_id,
        suspension_reason = NULL,
        rejection_reason = NULL
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;
  ELSIF p_action = 'change_role' THEN
    IF p_role IS NULL THEN
      RAISE EXCEPTION 'Target role required' USING ERRCODE = '23514';
    END IF;
    UPDATE public.profiles
    SET role = p_role
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;
    IF p_role <> 'admin' THEN
      UPDATE public.admin_roles
      SET is_active = false, revoked_by = p_actor_id, revoked_at = now()
      WHERE user_id = p_target_user_id AND is_active = true AND deleted_at IS NULL;
    END IF;
  ELSIF p_action = 'assign_admin_role' THEN
    IF p_admin_role IS NULL THEN
      RAISE EXCEPTION 'Target admin role required' USING ERRCODE = '23514';
    END IF;
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = p_target_user_id
    RETURNING * INTO v_updated;

    UPDATE public.admin_roles
    SET is_active = false, revoked_by = p_actor_id, revoked_at = now()
    WHERE user_id = p_target_user_id AND is_active = true AND deleted_at IS NULL;

    INSERT INTO public.admin_roles (user_id, role_name, permissions, is_active, assigned_by, notes)
    VALUES (
      p_target_user_id,
      p_admin_role,
      coalesce(p_permissions, '{}'),
      true,
      p_actor_id,
      p_reason
    );
  END IF;

  v_new_state := jsonb_build_object(
    'role', v_updated.role,
    'account_status', v_updated.account_status,
    'admin_role', p_admin_role
  );

  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_admin_role, action, entity_type, entity_id,
    previous_state, new_state, reason, request_id, ip_hash
  ) VALUES (
    p_actor_id, 'admin', v_actor_admin.role_name, 'user.' || p_action, 'profiles', p_target_user_id,
    v_prev_state, v_new_state, p_reason, p_request_id, p_ip_hash
  );

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_execute_user_action(uuid, text, uuid, public.user_role, public.admin_role_name, text[], text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_execute_user_action(uuid, text, uuid, public.user_role, public.admin_role_name, text[], text, text, text) TO service_role;

-- Atomic admin entity review (company, verification_request, pitch, pitch_document) + audit + review history
CREATE OR REPLACE FUNCTION public.admin_execute_entity_review(
  p_actor_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL,
  p_feedback_ar text DEFAULT NULL,
  p_feedback_en text DEFAULT NULL,
  p_checklist jsonb DEFAULT '{}'::jsonb,
  p_is_internal boolean DEFAULT false,
  p_request_id text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_profile public.profiles;
  v_actor_admin public.admin_roles;
  v_required_scope text;
  v_owner_id uuid;
  v_prev_state jsonb;
  v_new_state jsonb;
BEGIN
  v_required_scope := CASE p_entity_type
    WHEN 'company' THEN CASE WHEN p_decision IN ('verified', 'unverified') THEN 'companies:verify' ELSE 'companies:review' END
    WHEN 'verification_request' THEN 'verifications:review'
    WHEN 'pitch' THEN CASE WHEN p_decision IN ('restricted', 'unrestricted', 'approved_restricted') THEN 'pitches:restrict' ELSE 'pitches:review' END
    WHEN 'pitch_document' THEN 'documents:moderate'
    ELSE NULL
  END;

  IF v_required_scope IS NULL THEN
    RAISE EXCEPTION 'Unsupported entity_type' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.profiles p
  WHERE p.id = p_actor_id AND p.deleted_at IS NULL AND p.role = 'admin' AND p.account_status = 'approved';

  SELECT * INTO v_actor_admin
  FROM public.admin_roles ar
  WHERE ar.user_id = p_actor_id AND ar.deleted_at IS NULL AND ar.is_active = true;

  IF v_actor_profile.id IS NULL OR v_actor_admin.id IS NULL OR NOT (
    v_actor_admin.role_name = 'super_admin' OR v_required_scope = ANY(v_actor_admin.permissions)
  ) THEN
    RAISE EXCEPTION 'Forbidden: insufficient admin permissions' USING ERRCODE = '42501';
  END IF;

  IF p_decision IN ('rejected', 'suspended', 'restricted', 'needs_info', 'disabled')
     AND (p_reason IS NULL OR char_length(btrim(p_reason)) < 10) THEN
    RAISE EXCEPTION 'Audit reason (>= 10 characters) is required' USING ERRCODE = '23514';
  END IF;

  IF p_entity_type = 'company' THEN
    SELECT c.owner_id, jsonb_build_object('status', c.status, 'verification_status', c.verification_status)
    INTO v_owner_id, v_prev_state
    FROM public.companies c WHERE c.id = p_entity_id AND c.deleted_at IS NULL FOR UPDATE;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Company not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_owner_id = p_actor_id OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = p_entity_id AND cm.user_id = p_actor_id AND cm.deleted_at IS NULL AND cm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Admins cannot review their own company' USING ERRCODE = '42501';
    END IF;

    IF p_decision = 'approved' THEN
      UPDATE public.companies SET status = 'approved', approved_at = now(), approved_by = p_actor_id, rejection_reason = NULL WHERE id = p_entity_id;
    ELSIF p_decision = 'rejected' THEN
      UPDATE public.companies SET status = 'rejected', rejection_reason = btrim(p_reason) WHERE id = p_entity_id;
    ELSIF p_decision = 'suspended' THEN
      UPDATE public.companies SET status = 'suspended', rejection_reason = btrim(p_reason) WHERE id = p_entity_id;
    ELSIF p_decision = 'needs_info' THEN
      UPDATE public.companies SET status = 'rejected', admin_feedback = coalesce(p_feedback_ar, p_feedback_en, btrim(p_reason)) WHERE id = p_entity_id;
    ELSIF p_decision = 'verified' THEN
      UPDATE public.companies SET verification_status = 'verified', verified_at = now(), verified_by = p_actor_id WHERE id = p_entity_id;
    ELSIF p_decision = 'unverified' THEN
      UPDATE public.companies SET verification_status = 'unverified', verified_at = NULL, verified_by = NULL WHERE id = p_entity_id;
    ELSE
      RAISE EXCEPTION 'Unsupported company decision' USING ERRCODE = '23514';
    END IF;

    SELECT jsonb_build_object('status', c.status, 'verification_status', c.verification_status)
    INTO v_new_state FROM public.companies c WHERE c.id = p_entity_id;

  ELSIF p_entity_type = 'verification_request' THEN
    SELECT vr.user_id, jsonb_build_object('status', vr.status, 'company_id', vr.company_id)
    INTO v_owner_id, v_prev_state
    FROM public.verification_requests vr WHERE vr.id = p_entity_id AND vr.deleted_at IS NULL FOR UPDATE;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Verification request not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_owner_id = p_actor_id THEN
      RAISE EXCEPTION 'Admins cannot review their own verification request' USING ERRCODE = '42501';
    END IF;

    UPDATE public.verification_requests
    SET status = p_decision::public.verification_request_status,
        reviewer_id = p_actor_id,
        review_notes = coalesce(p_feedback_ar, p_feedback_en, p_reason),
        reviewed_at = now()
    WHERE id = p_entity_id;

    IF p_decision = 'approved' THEN
      UPDATE public.companies c
      SET verification_status = 'verified', verified_at = now(), verified_by = p_actor_id
      FROM public.verification_requests vr
      WHERE vr.id = p_entity_id AND vr.subject_type = 'company_kyb' AND c.id = vr.company_id;
    ELSIF p_decision = 'rejected' THEN
      UPDATE public.companies c
      SET verification_status = 'rejected'
      FROM public.verification_requests vr
      WHERE vr.id = p_entity_id AND vr.subject_type = 'company_kyb' AND c.id = vr.company_id;
    END IF;

    v_new_state := jsonb_build_object('status', p_decision);

  ELSIF p_entity_type = 'pitch' THEN
    SELECT c.owner_id, jsonb_build_object('status', pt.status)
    INTO v_owner_id, v_prev_state
    FROM public.pitches pt
    JOIN public.companies c ON c.id = pt.company_id
    WHERE pt.id = p_entity_id AND pt.deleted_at IS NULL FOR UPDATE;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Pitch not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_owner_id = p_actor_id OR EXISTS (
      SELECT 1 FROM public.pitches pt
      JOIN public.company_members cm ON cm.company_id = pt.company_id
      WHERE pt.id = p_entity_id AND cm.user_id = p_actor_id AND cm.deleted_at IS NULL AND cm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Admins cannot review their own pitch' USING ERRCODE = '42501';
    END IF;

    IF p_decision = 'approved' THEN
      UPDATE public.pitches SET status = 'approved', approved_at = now(), approved_by = p_actor_id, rejection_reason = NULL WHERE id = p_entity_id;
    ELSIF p_decision = 'approved_restricted' OR p_decision = 'restricted' THEN
      UPDATE public.pitches SET status = 'restricted', restricted_at = now(), restricted_by = p_actor_id WHERE id = p_entity_id;
    ELSIF p_decision = 'unrestricted' THEN
      UPDATE public.pitches SET status = 'approved', approved_at = coalesce(approved_at, now()), approved_by = coalesce(approved_by, p_actor_id) WHERE id = p_entity_id;
    ELSIF p_decision IN ('rejected', 'needs_info') THEN
      UPDATE public.pitches SET status = 'rejected', rejection_reason = btrim(p_reason) WHERE id = p_entity_id;
    ELSIF p_decision = 'closed' THEN
      UPDATE public.pitches SET status = 'closed', closed_at = now() WHERE id = p_entity_id;
    ELSE
      RAISE EXCEPTION 'Unsupported pitch decision' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.pitch_reviews (
      pitch_id, reviewer_id, decision, checklist, feedback_ar, feedback_en, is_internal
    ) VALUES (
      p_entity_id, p_actor_id, p_decision::public.pitch_review_decision, coalesce(p_checklist, '{}'::jsonb), p_feedback_ar, p_feedback_en, coalesce(p_is_internal, false)
    );

    SELECT jsonb_build_object('status', pt.status) INTO v_new_state FROM public.pitches pt WHERE pt.id = p_entity_id;

  ELSIF p_entity_type = 'pitch_document' THEN
    SELECT c.owner_id, jsonb_build_object('is_restricted', pd.is_restricted, 'is_active', pd.is_active)
    INTO v_owner_id, v_prev_state
    FROM public.pitch_documents pd
    JOIN public.companies c ON c.id = pd.company_id
    WHERE pd.id = p_entity_id AND pd.deleted_at IS NULL FOR UPDATE;

    IF v_owner_id IS NULL THEN
      RAISE EXCEPTION 'Pitch document not found' USING ERRCODE = 'P0002';
    END IF;
    IF v_owner_id = p_actor_id OR EXISTS (
      SELECT 1 FROM public.pitch_documents pd
      JOIN public.company_members cm ON cm.company_id = pd.company_id
      WHERE pd.id = p_entity_id AND cm.user_id = p_actor_id AND cm.deleted_at IS NULL AND cm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Admins cannot moderate their own pitch document' USING ERRCODE = '42501';
    END IF;

    IF p_decision = 'restricted' THEN
      UPDATE public.pitch_documents SET is_restricted = true, restriction_reason = btrim(p_reason), restricted_at = now(), restricted_by = p_actor_id WHERE id = p_entity_id;
    ELSIF p_decision = 'unrestricted' THEN
      UPDATE public.pitch_documents SET is_restricted = false, restriction_reason = NULL WHERE id = p_entity_id;
    ELSIF p_decision = 'disabled' THEN
      UPDATE public.pitch_documents SET is_active = false, restriction_reason = btrim(p_reason) WHERE id = p_entity_id;
    ELSE
      RAISE EXCEPTION 'Unsupported document decision' USING ERRCODE = '23514';
    END IF;

    SELECT jsonb_build_object('is_restricted', pd.is_restricted, 'is_active', pd.is_active)
    INTO v_new_state FROM public.pitch_documents pd WHERE pd.id = p_entity_id;
  END IF;

  INSERT INTO public.activity_logs (
    actor_id, actor_role, actor_admin_role, action, entity_type, entity_id,
    previous_state, new_state, reason, request_id, ip_hash
  ) VALUES (
    p_actor_id, 'admin', v_actor_admin.role_name, p_entity_type || '.' || p_decision, p_entity_type, p_entity_id,
    v_prev_state, v_new_state, p_reason, p_request_id, p_ip_hash
  );

  RETURN jsonb_build_object(
    'entityId', p_entity_id,
    'entityType', p_entity_type,
    'ownerUserId', v_owner_id,
    'previousState', v_prev_state,
    'newState', v_new_state
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_execute_entity_review(uuid, text, uuid, text, text, text, text, jsonb, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_execute_entity_review(uuid, text, uuid, text, text, text, text, jsonb, boolean, text, text) TO service_role;
