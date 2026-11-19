-- ============================================================================
-- Migration 0006: Auth Sync Triggers, updated_at & Anti-Tampering Guards
-- Reference: docs/DATABASE.md §4.2 & §6
-- ============================================================================

-- 1. Global updated_at trigger & privileged trigger context helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private_internal.is_privileged_trigger_actor()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, auth, pg_temp
AS $$
  SELECT current_setting('role', true) = 'service_role'
    OR (
      session_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin')
      AND current_setting('role', true) NOT IN ('anon', 'authenticated')
    );
$$;

REVOKE ALL ON FUNCTION private_internal.is_privileged_trigger_actor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private_internal.is_privileged_trigger_actor() TO service_role, postgres;

CREATE TRIGGER trg_sectors_updated_at BEFORE UPDATE ON public.sectors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_investors_updated_at BEFORE UPDATE ON public.investors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_founders_updated_at BEFORE UPDATE ON public.founders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_company_members_updated_at BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pitches_updated_at BEFORE UPDATE ON public.pitches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pitch_documents_updated_at BEFORE UPDATE ON public.pitch_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pitch_access_grants_updated_at BEFORE UPDATE ON public.pitch_access_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_investment_interests_updated_at BEFORE UPDATE ON public.investment_interests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_portfolio_companies_updated_at BEFORE UPDATE ON public.portfolio_companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_verification_requests_updated_at BEFORE UPDATE ON public.verification_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_admin_roles_updated_at BEFORE UPDATE ON public.admin_roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_system_settings_updated_at BEFORE UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_support_requests_updated_at BEFORE UPDATE ON public.support_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Auth signup sync: forces account_status = 'pending' & blocks 'admin' self-assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_requested_role text;
  v_safe_role public.user_role := 'member';
  v_lang public.language_code := 'ar';
  v_full_name text;
BEGIN
  v_requested_role := lower(coalesce(NEW.raw_user_meta_data->>'role', 'member'));
  IF v_requested_role IN ('investor', 'founder', 'member') THEN
    v_safe_role := v_requested_role::public.user_role;
  END IF;

  IF lower(coalesce(NEW.raw_user_meta_data->>'preferred_language', 'ar')) = 'en' THEN
    v_lang := 'en';
  END IF;

  v_full_name := coalesce(
    nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(split_part(coalesce(NEW.email, ''), '@', 1)), ''),
    'SHARK Member'
  );

  INSERT INTO public.profiles (
    id, email, full_name, role, account_status, preferred_language, onboarding_step
  ) VALUES (
    NEW.id,
    lower(NEW.email),
    left(v_full_name, 120),
    v_safe_role,
    'pending',
    v_lang,
    'account_type'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_after_insert
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = lower(NEW.email)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_after_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_email_update();

-- 3. Column-level protection on profiles
CREATE OR REPLACE FUNCTION public.guard_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_can_review boolean := public.is_active_admin('users:review');
  v_can_suspend boolean := public.is_active_admin('users:suspend');
  v_can_manage_roles boolean := public.is_active_admin('roles:manage');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Protected identity column cannot be modified directly' USING ERRCODE = '42501';
  END IF;

  -- Nobody (not even an admin) may self-approve, self-suspend, self-promote, or alter own audit status
  IF NEW.id = auth.uid() AND (
    NEW.account_status IS DISTINCT FROM OLD.account_status
    OR (
      NEW.role IS DISTINCT FROM OLD.role
      AND NOT (
        OLD.account_status = 'pending'
        AND OLD.onboarding_completed = false
        AND NEW.role IN ('investor', 'founder', 'member')
      )
    )
  ) THEN
    RAISE EXCEPTION 'Cannot self-modify role or account_status' USING ERRCODE = '42501';
  END IF;

  -- Cross-user role changes strictly require roles:manage (prevents operations_admin escalation)
  IF NEW.id <> auth.uid() AND NEW.role IS DISTINCT FROM OLD.role AND NOT v_can_manage_roles THEN
    RAISE EXCEPTION 'Insufficient privilege to modify user role' USING ERRCODE = '42501';
  END IF;

  -- Suspending an account or editing suspension audit metadata strictly requires users:suspend
  IF (
    NEW.account_status = 'suspended'
    OR OLD.account_status = 'suspended'
    OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
    OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
  ) AND (
    NEW.account_status IS DISTINCT FROM OLD.account_status
    OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
    OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
    OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
  ) AND (NEW.id = auth.uid() OR (NOT v_can_suspend AND NOT (NEW.account_status = 'approved' AND OLD.account_status = 'suspended' AND v_can_review))) THEN
    RAISE EXCEPTION 'Insufficient privilege to modify account suspension metadata' USING ERRCODE = '42501';
  END IF;

  IF NOT v_can_review OR NEW.id = auth.uid() THEN
    IF NEW.account_status IS DISTINCT FROM OLD.account_status
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.rejected_at IS DISTINCT FROM OLD.rejected_at
      OR NEW.rejected_by IS DISTINCT FROM OLD.rejected_by
      OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
      OR NEW.suspended_by IS DISTINCT FROM OLD.suspended_by
      OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
    THEN
      RAISE EXCEPTION 'Insufficient privilege to update protected profile columns' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_guard_sensitive_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_sensitive_columns();

-- 4. Protect investor and founder privilege columns
CREATE OR REPLACE FUNCTION public.guard_investor_founder_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_is_mod boolean := public.is_active_admin('investors:moderate') OR public.is_active_admin('users:review');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot reassign profile owner' USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME = 'investors' AND NOT v_is_mod THEN
    IF NEW.is_accredited IS DISTINCT FROM OLD.is_accredited
      OR NEW.accreditation_verified_at IS DISTINCT FROM OLD.accreditation_verified_at
      OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
      OR (NEW.portfolio_count IS DISTINCT FROM OLD.portfolio_count AND pg_trigger_depth() <= 1)
    THEN
      RAISE EXCEPTION 'Insufficient privilege to update protected investor columns' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_investors_guard_columns
  BEFORE UPDATE ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_investor_founder_columns();

CREATE TRIGGER trg_founders_guard_columns
  BEFORE UPDATE ON public.founders
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_investor_founder_columns();

-- 5. Protect companies & pitches status / verification transitions (least-privilege scope split)
CREATE OR REPLACE FUNCTION public.guard_company_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_can_review boolean := public.is_active_admin('companies:review');
  v_can_verify boolean := public.is_active_admin('companies:verify');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_can_review THEN
      IF NEW.status NOT IN ('draft', 'pending') OR NEW.is_featured = true THEN
        RAISE EXCEPTION 'Insufficient privilege to create pre-approved or featured company' USING ERRCODE = '42501';
      END IF;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.rejection_reason := NULL;
      NEW.admin_feedback := NULL;
      NEW.is_featured := false;
    END IF;

    IF NOT v_can_verify THEN
      IF NEW.verification_status <> 'unverified' THEN
        RAISE EXCEPTION 'Insufficient privilege to create pre-verified company' USING ERRCODE = '42501';
      END IF;
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;

    RETURN NEW;
  END IF;

  IF NOT v_can_verify THEN
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
      OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
      OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
    THEN
      RAISE EXCEPTION 'companies:verify permission required to modify verification state' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT v_can_review THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
      OR NEW.admin_feedback IS DISTINCT FROM OLD.admin_feedback
    THEN
      RAISE EXCEPTION 'Insufficient privilege to modify company moderation metadata' USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (OLD.status IN ('draft', 'rejected') AND NEW.status = 'pending') THEN
        RAISE EXCEPTION 'Invalid company status transition for operator' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_guard_integrity
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_company_integrity();

CREATE OR REPLACE FUNCTION public.guard_pitch_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_can_review boolean := public.is_active_admin('pitches:review');
  v_can_restrict boolean := public.is_active_admin('pitches:restrict');
BEGIN
  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT v_can_review AND NOT v_can_restrict THEN
      IF NEW.status NOT IN ('draft', 'pending') OR NEW.is_featured = true THEN
        RAISE EXCEPTION 'Insufficient privilege to create pre-approved or featured pitch' USING ERRCODE = '42501';
      END IF;
      NEW.approved_at := NULL;
      NEW.approved_by := NULL;
      NEW.restricted_at := NULL;
      NEW.restricted_by := NULL;
      NEW.rejection_reason := NULL;
      NEW.is_featured := false;
      IF NEW.status = 'pending' AND NEW.submitted_at IS NULL THEN
        NEW.submitted_at := now();
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT v_can_restrict THEN
    IF NEW.restricted_at IS DISTINCT FROM OLD.restricted_at
      OR NEW.restricted_by IS DISTINCT FROM OLD.restricted_by
      OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'restricted')
      OR (NEW.status IS DISTINCT FROM OLD.status AND OLD.status = 'restricted' AND NEW.status <> 'closed')
    THEN
      RAISE EXCEPTION 'pitches:restrict permission required to modify restriction state' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT v_can_review THEN
    IF NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.is_featured IS DISTINCT FROM OLD.is_featured
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
      OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
    THEN
      RAISE EXCEPTION 'Insufficient privilege to modify pitch moderation columns' USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF (OLD.status IN ('draft', 'rejected') AND NEW.status = 'pending') THEN
        NEW.submitted_at := now();
      ELSIF (OLD.status IN ('approved', 'restricted') AND NEW.status = 'closed') THEN
        NEW.closed_at := now();
      ELSE
        RAISE EXCEPTION 'Invalid pitch status transition for operator' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pitches_guard_integrity
  BEFORE INSERT OR UPDATE ON public.pitches
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_pitch_integrity();

CREATE OR REPLACE FUNCTION public.guard_pitch_document_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_pitch_company_id uuid;
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_is_moderator boolean := public.is_active_admin('documents:moderate') OR public.is_active_admin('pitches:restrict');
BEGIN
  SELECT pt.company_id INTO v_pitch_company_id
  FROM public.pitches pt
  WHERE pt.id = NEW.pitch_id AND pt.deleted_at IS NULL;

  IF v_pitch_company_id IS NULL OR v_pitch_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'pitch_documents.company_id must match parent pitch company' USING ERRCODE = '23514';
  END IF;

  IF v_is_service THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NOT v_is_moderator THEN
    NEW.is_restricted := false;
    NEW.restriction_reason := NULL;
    NEW.restricted_at := NULL;
    NEW.restricted_by := NULL;
    NEW.scan_status := 'pending';
    NEW.is_active := true;
  ELSIF TG_OP = 'UPDATE' AND NOT v_is_moderator THEN
    IF NEW.is_restricted IS DISTINCT FROM OLD.is_restricted
      OR NEW.restriction_reason IS DISTINCT FROM OLD.restriction_reason
      OR NEW.restricted_at IS DISTINCT FROM OLD.restricted_at
      OR NEW.restricted_by IS DISTINCT FROM OLD.restricted_by
      OR NEW.scan_status IS DISTINCT FROM OLD.scan_status
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      RAISE EXCEPTION 'Insufficient privilege to modify document restriction or scan state' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pitch_documents_guard_integrity
  BEFORE INSERT OR UPDATE ON public.pitch_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_pitch_document_integrity();

CREATE OR REPLACE FUNCTION public.sync_investment_interest_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT pt.company_id INTO v_company_id
  FROM public.pitches pt
  WHERE pt.id = NEW.pitch_id AND pt.deleted_at IS NULL;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Target pitch not found' USING ERRCODE = '23503';
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_investment_interests_sync_company
  BEFORE INSERT ON public.investment_interests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_investment_interest_company();

-- 6. Guard admin_roles against self-assignment and removing the last active super_admin
CREATE OR REPLACE FUNCTION public.guard_admin_roles_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_is_service boolean := private_internal.is_privileged_trigger_actor();
  v_target_user_id uuid := COALESCE(NEW.user_id, OLD.user_id);
  v_remaining_supers integer;
BEGIN
  IF NOT v_is_service THEN
    IF NOT public.is_active_admin('roles:manage') THEN
      RAISE EXCEPTION 'Only active super_admin may manage admin_roles' USING ERRCODE = '42501';
    END IF;

    IF v_target_user_id = auth.uid() THEN
      RAISE EXCEPTION 'Admins cannot modify their own admin_roles entry' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.role_name = 'super_admin'
     AND OLD.is_active = true
     AND OLD.deleted_at IS NULL
     AND (
       TG_OP = 'DELETE'
       OR NEW.is_active = false
       OR NEW.deleted_at IS NOT NULL
       OR NEW.role_name <> 'super_admin'
     )
  THEN
    SELECT count(*) INTO v_remaining_supers
    FROM public.admin_roles ar
    WHERE ar.id <> OLD.id
      AND ar.role_name = 'super_admin'
      AND ar.is_active = true
      AND ar.deleted_at IS NULL;

    IF v_remaining_supers < 1 THEN
      RAISE EXCEPTION 'Cannot deactivate or remove the last active super_admin' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_admin_roles_guard_integrity
  BEFORE INSERT OR UPDATE OR DELETE ON public.admin_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_admin_roles_integrity();

-- 7. Guard notifications so recipients can only mark read or soft-delete
CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF private_internal.is_privileged_trigger_actor() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.sent_by IS DISTINCT FROM OLD.sent_by
    OR NEW.category IS DISTINCT FROM OLD.category
    OR NEW.title_ar IS DISTINCT FROM OLD.title_ar
    OR NEW.title_en IS DISTINCT FROM OLD.title_en
    OR NEW.body_ar IS DISTINCT FROM OLD.body_ar
    OR NEW.body_en IS DISTINCT FROM OLD.body_en
    OR NEW.deep_link IS DISTINCT FROM OLD.deep_link
    OR NEW.entity_type IS DISTINCT FROM OLD.entity_type
    OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
  THEN
    RAISE EXCEPTION 'Recipients may only update notification read status' USING ERRCODE = '42501';
  END IF;

  IF NEW.is_read = true AND OLD.is_read = false AND NEW.read_at IS NULL THEN
    NEW.read_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notifications_guard_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_notification_update();

-- 8. Validate saved_items polymorphic targets
CREATE OR REPLACE FUNCTION public.validate_saved_item_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_valid boolean := false;
BEGIN
  IF NEW.entity_type = 'investor' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.investors i
      JOIN public.profiles p ON p.id = i.user_id
      WHERE i.id = NEW.entity_id
        AND i.deleted_at IS NULL
        AND i.is_public_listed = true
        AND p.deleted_at IS NULL
        AND p.account_status = 'approved'
    ) INTO v_valid;
  ELSIF NEW.entity_type = 'company' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = NEW.entity_id
        AND c.deleted_at IS NULL
        AND c.status = 'approved'
    ) INTO v_valid;
  ELSIF NEW.entity_type = 'pitch' THEN
    v_valid := public.can_view_pitch(NEW.entity_id);
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Target entity does not exist or is not accessible' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_saved_items_validate_target
  BEFORE INSERT ON public.saved_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_saved_item_target();

-- 9. Sync investors.portfolio_count
CREATE OR REPLACE FUNCTION public.sync_investor_portfolio_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := COALESCE(NEW.investor_user_id, OLD.investor_user_id);
BEGIN
  UPDATE public.investors i
  SET portfolio_count = (
    SELECT count(*)::integer
    FROM public.portfolio_companies pc
    WHERE pc.investor_user_id = v_user_id
      AND pc.deleted_at IS NULL
  )
  WHERE i.user_id = v_user_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_portfolio_companies_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_investor_portfolio_count();

-- 10. Immutable activity_logs guard (allows ONLY PostgreSQL FK ON DELETE SET NULL upon account deletion)
CREATE OR REPLACE FUNCTION public.prevent_activity_logs_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.actor_id IS NOT NULL
     AND NEW.actor_id IS NULL
     AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id')
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.actor_id)
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'activity_logs is strictly append-only; updates and deletes are forbidden' USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER trg_activity_logs_immutable
  BEFORE UPDATE OR DELETE ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_activity_logs_mutation();
