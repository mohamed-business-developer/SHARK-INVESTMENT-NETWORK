-- ============================================================================
-- Non-Production Synthetic Development & RLS Verification Fixtures
-- STRICTLY FOR LOCAL / STAGING TEST DATABASES — NEVER RUN IN PRODUCTION
-- ============================================================================

DO $$
DECLARE
  v_fintech_id uuid;
  v_admin_id uuid := '11111111-1111-4111-8111-111111111101';
  v_ops_admin_id uuid := '11111111-1111-4111-8111-111111111102';
  v_investor_approved_id uuid := '11111111-1111-4111-8111-111111111103';
  v_investor_ungranted_id uuid := '11111111-1111-4111-8111-111111111104';
  v_founder_id uuid := '11111111-1111-4111-8111-111111111105';
  v_pending_id uuid := '11111111-1111-4111-8111-111111111106';
  v_rejected_id uuid := '11111111-1111-4111-8111-111111111107';
  v_suspended_id uuid := '11111111-1111-4111-8111-111111111108';
  v_company_id uuid := '22222222-2222-4222-8222-222222222201';
  v_pitch_approved_id uuid := '33333333-3333-4333-8333-333333333301';
  v_pitch_restricted_id uuid := '33333333-3333-4333-8333-333333333302';
  v_doc_standard_id uuid := '44444444-4444-4444-8444-444444444401';
  v_doc_restricted_id uuid := '44444444-4444-4444-8444-444444444402';
BEGIN
  SELECT id INTO v_fintech_id FROM public.sectors WHERE slug = 'fintech' LIMIT 1;

  -- Synthetic auth.users rows (disabled unusable password hashes for test impersonation)
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'superadmin@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Super Admin"}', now(), now()),
    (v_ops_admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ops@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Ops Admin"}', now(), now()),
    (v_investor_approved_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor.granted@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Granted Investor","role":"investor"}', now(), now()),
    (v_investor_ungranted_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'investor.ungranted@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Ungranted Investor","role":"investor"}', now(), now()),
    (v_founder_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'founder@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Approved Founder","role":"founder"}', now(), now()),
    (v_pending_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Pending Applicant","role":"investor"}', now(), now()),
    (v_rejected_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rejected@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Rejected Applicant","role":"member"}', now(), now()),
    (v_suspended_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'suspended@shark.test', '', now(), '{"provider":"email"}', '{"full_name":"Suspended Account","role":"investor"}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Set synthetic test roles & statuses directly via privileged seed context
  UPDATE public.profiles SET role = 'admin', account_status = 'approved', onboarding_completed = true, approved_at = now() WHERE id IN (v_admin_id, v_ops_admin_id);
  UPDATE public.profiles SET role = 'investor', account_status = 'approved', onboarding_completed = true, approved_at = now(), phone = '+966500000001' WHERE id IN (v_investor_approved_id, v_investor_ungranted_id);
  UPDATE public.profiles SET role = 'founder', account_status = 'approved', onboarding_completed = true, approved_at = now() WHERE id = v_founder_id;
  UPDATE public.profiles SET role = 'member', account_status = 'rejected', rejection_reason = 'Incomplete synthetic verification fixture' WHERE id = v_rejected_id;
  UPDATE public.profiles SET role = 'investor', account_status = 'suspended', suspension_reason = 'Compliance test hold' WHERE id = v_suspended_id;

  INSERT INTO public.admin_roles (user_id, role_name, permissions, is_active, assigned_by)
  VALUES
    (v_admin_id, 'super_admin', ARRAY['*'], true, v_admin_id),
    (v_ops_admin_id, 'operations_admin', ARRAY['users:read','users:review','users:suspend','companies:read','companies:review','pitches:read','notifications:send','support:read','support:manage','analytics:read'], true, v_admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.investors (user_id, investor_type, firm_name_ar, firm_name_en, ticket_min_usd, ticket_max_usd, is_accredited, is_featured, is_public_listed)
  VALUES
    (v_investor_approved_id, 'vc_fund', 'صندوق آفاق', 'Horizon Ventures', 250000, 1000000, true, true, true),
    (v_investor_ungranted_id, 'angel', 'مستثمر ملائكي', 'Angel Fixture', 50000, 200000, false, false, true)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.companies (id, owner_id, slug, name_ar, name_en, sector_id, stage, country_code, registration_number, status, verification_status, approved_at, approved_by, verified_at, verified_by)
  VALUES
    (v_company_id, v_founder_id, 'madar-fintech-fixture', 'منظومة مدار', 'Madar FinTech Fixture', v_fintech_id, 'series_a', 'SA', 'CR-1010999888', 'approved', 'verified', now(), v_admin_id, now(), v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pitches (id, company_id, created_by, sector_id, title_ar, title_en, funding_stage, instrument, target_amount_usd, equity_offered_pct, status, approved_at, approved_by)
  VALUES
    (v_pitch_approved_id, v_company_id, v_founder_id, v_fintech_id, 'جولة مدار المفتوحة', 'Madar Open Series A', 'series_a', 'equity', 2500000, 15, 'approved', now(), v_admin_id),
    (v_pitch_restricted_id, v_company_id, v_founder_id, v_fintech_id, 'جولة مدار المقيدة', 'Madar Confidential Round', 'series_a', 'equity', 5000000, 12, 'restricted', now(), v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pitch_documents (id, pitch_id, company_id, uploaded_by, category, file_name, storage_path, mime_type, file_size_bytes, is_restricted, scan_status)
  VALUES
    (v_doc_standard_id, v_pitch_approved_id, v_company_id, v_founder_id, 'pitch_deck', 'madar-deck.pdf', v_company_id::text || '/' || v_pitch_approved_id::text || '/' || v_doc_standard_id::text || '.pdf', 'application/pdf', 1024000, false, 'clean'),
    (v_doc_restricted_id, v_pitch_restricted_id, v_company_id, v_founder_id, 'financial_model', 'madar-model.xlsx', v_company_id::text || '/' || v_pitch_restricted_id::text || '/' || v_doc_restricted_id::text || '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 512000, true, 'clean')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.pitch_access_grants (pitch_id, pitch_document_id, user_id, granted_by, reason)
  VALUES
    (v_pitch_restricted_id, NULL, v_investor_approved_id, v_admin_id, 'Fixture clearance for granted investor')
  ON CONFLICT DO NOTHING;
END $$;
