-- SEC-09 & SEC-10: Founder Self-Approval Block & Admin Authorization Boundary Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(10);

-- SEC-09: Founder cannot self-approve a newly created company or pitch
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111105', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO public.companies (owner_id, slug, name_ar, name_en, sector_id, country_code, status) VALUES ('11111111-1111-4111-8111-111111111105', 'bypass-co', 'شركة اختبار', 'Bypass Co', (SELECT id FROM public.sectors LIMIT 1), 'SA', 'approved')$$,
  '42501',
  NULL,
  'SEC-09: founder cannot insert pre-approved company'
);

SELECT throws_ok(
  $$INSERT INTO public.pitches (company_id, created_by, sector_id, title_ar, title_en, funding_stage, target_amount_usd, status) VALUES ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111105', (SELECT id FROM public.sectors LIMIT 1), 'عرض اختبار', 'Bypass Pitch', 'series_a', 1000000, 'approved')$$,
  '42501',
  NULL,
  'SEC-09: founder cannot insert pre-approved pitch'
);

-- SEC-10: Non-admin user cannot invoke privileged admin RPCs directly
SELECT throws_ok(
  $$SELECT public.admin_execute_user_action('11111111-1111-4111-8111-111111111105'::uuid, 'approve', '11111111-1111-4111-8111-111111111106'::uuid)$$,
  '42501',
  NULL,
  'SEC-10: non-admin user blocked from admin_execute_user_action'
);

SELECT throws_ok(
  $$SELECT public.admin_execute_entity_review('11111111-1111-4111-8111-111111111105'::uuid, 'company', '22222222-2222-4222-8222-222222222201'::uuid, 'approved')$$,
  '42501',
  NULL,
  'SEC-10: non-admin user blocked from admin_execute_entity_review'
);

-- SEC-10 Regression: operations_admin (users:review + companies:review, NO roles:manage / companies:verify)
-- cannot escalate a user's profile.role to admin or mark a company verified via direct PostgREST UPDATE
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111102', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-4111-8111-111111111106'$$,
  '42501',
  NULL,
  'SEC-10: operations_admin without roles:manage cannot escalate another user role directly'
);

SELECT throws_ok(
  $$UPDATE public.companies SET verification_status = 'unverified' WHERE id = '22222222-2222-4222-8222-222222222201'$$,
  '42501',
  NULL,
  'SEC-10: companies:review admin without companies:verify cannot alter verification_status'
);

RESET ROLE;

SELECT throws_ok(
  $$SELECT public.admin_execute_user_action('11111111-1111-4111-8111-111111111102'::uuid, 'assign_admin_role', '11111111-1111-4111-8111-111111111103'::uuid, NULL::public.user_role, 'super_admin'::public.admin_role_name, NULL::text[], 'Escalation test reason', 'req-1', NULL::text)$$,
  '42501',
  NULL,
  'SEC-10: operations_admin without roles:manage scope cannot grant admin roles'
);

SELECT throws_ok(
  $$SELECT public.admin_execute_user_action('11111111-1111-4111-8111-111111111101'::uuid, 'suspend', '11111111-1111-4111-8111-111111111101'::uuid, NULL::public.user_role, NULL::public.admin_role_name, NULL::text[], 'Self action block test', 'req-2', NULL::text)$$,
  '42501',
  NULL,
  'SEC-10: super_admin cannot execute user action targeting self'
);

-- Admin co-member cannot moderate their own pitch document
INSERT INTO public.company_members (company_id, user_id, member_role, status, can_manage_pitches, can_manage_documents)
VALUES ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101', 'advisor', 'active', true, true)
ON CONFLICT DO NOTHING;

SELECT throws_ok(
  $$SELECT public.admin_execute_entity_review('11111111-1111-4111-8111-111111111101'::uuid, 'pitch_document', '44444444-4444-4444-8444-444444444402'::uuid, 'unrestricted', 'Self unrestrict bypass attempt', NULL::text, NULL::text, '{}'::jsonb, false, 'req-doc-self', NULL::text)$$,
  '42501',
  NULL,
  'SEC-10: super_admin who is company operator cannot moderate own pitch_document'
);

SELECT lives_ok(
  $$SELECT public.admin_execute_user_action('11111111-1111-4111-8111-111111111101'::uuid, 'approve', '11111111-1111-4111-8111-111111111106'::uuid, NULL::public.user_role, NULL::public.admin_role_name, NULL::text[], 'Verified test approval', 'req-3', NULL::text)$$,
  'SEC-10: super_admin can approve pending user and append immutable audit log'
);

SELECT * FROM finish();
ROLLBACK;
