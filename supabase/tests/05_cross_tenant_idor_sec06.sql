-- SEC-06: Cross-Tenant IDOR & Ownership Boundary Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(7);

SET LOCAL ROLE authenticated;
-- Impersonate Ungranted Approved Investor (...1104)
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111104', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is_empty(
  $$SELECT id FROM public.profiles WHERE id <> '11111111-1111-4111-8111-111111111104'$$,
  'SEC-06: approved user cannot read another user profile row directly'
);

SELECT is_empty(
  $$SELECT id FROM public.notifications WHERE user_id <> '11111111-1111-4111-8111-111111111104'$$,
  'SEC-06: approved user cannot read another user notifications'
);

SELECT is_empty(
  $$SELECT id FROM public.saved_items WHERE user_id <> '11111111-1111-4111-8111-111111111104'$$,
  'SEC-06: approved user cannot read another user saved_items'
);

SELECT is_empty(
  $$SELECT id FROM public.verification_requests WHERE user_id <> '11111111-1111-4111-8111-111111111104'$$,
  'SEC-06: approved user cannot read another user KYC/KYB verification_requests'
);

UPDATE public.companies
SET name_en = 'Hijacked Company Name'
WHERE id = '22222222-2222-4222-8222-222222222201';

RESET ROLE;
SELECT is(
  (SELECT name_en FROM public.companies WHERE id = '22222222-2222-4222-8222-222222222201'),
  'Madar FinTech Fixture',
  'SEC-06: cross-tenant investor cannot modify founder company'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111104', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO public.investment_interests (pitch_id, company_id, investor_id, indicative_amount_usd) VALUES ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111103', 100000)$$,
  '42501',
  NULL,
  'SEC-06: user cannot spoof another investor_id in investment_interests'
);

SELECT throws_ok(
  $$INSERT INTO public.pitches (company_id, created_by, sector_id, title_ar, title_en, funding_stage, target_amount_usd) VALUES ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111104', (SELECT id FROM public.sectors LIMIT 1), 'عرض دخيل', 'Hijacked Pitch', 'seed', 1000000)$$,
  '42501',
  NULL,
  'SEC-06: non-member investor cannot create a pitch under founder company'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
