-- SEC-03 & SEC-04: Pending and Rejected Account Access Restrictions
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(8);

-- SEC-03: Pending account
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111106', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111106'),
  1::bigint,
  'SEC-03: pending user can read own profile'
);

SELECT is_empty(
  $$SELECT id FROM public.pitches$$,
  'SEC-03: pending user cannot view any pitches'
);

SELECT throws_ok(
  $$INSERT INTO public.investment_interests (pitch_id, company_id, investor_id, indicative_amount_usd) VALUES ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111106', 50000)$$,
  '42501',
  NULL,
  'SEC-03: pending user cannot submit investment_interests'
);

SELECT throws_ok(
  $$INSERT INTO public.companies (owner_id, slug, name_ar, name_en, sector_id, country_code) VALUES ('11111111-1111-4111-8111-111111111106', 'pending-co', 'شركة معلقة', 'Pending Co', (SELECT id FROM public.sectors LIMIT 1), 'SA')$$,
  '42501',
  NULL,
  'SEC-03: pending user cannot create a company before approval'
);

-- SEC-04: Rejected account
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111107', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111107'),
  1::bigint,
  'SEC-04: rejected user can read own profile and rejection reason'
);

SELECT is_empty(
  $$SELECT id FROM public.pitches$$,
  'SEC-04: rejected user cannot view approved or restricted pitches'
);

SELECT is_empty(
  $$SELECT id FROM public.pitch_documents$$,
  'SEC-04: rejected user cannot view pitch_documents'
);

SELECT lives_ok(
  $$INSERT INTO public.support_requests (user_id, category, subject, message) VALUES ('11111111-1111-4111-8111-111111111107', 'appeal', 'Appeal review', 'Requesting re-verification of submitted materials.')$$,
  'SEC-04: rejected user can open an appeal support request'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
