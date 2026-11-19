-- SEC-01: Guest / Anonymous Access & Zero-PII Public Projection Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(13);

SET LOCAL ROLE anon;

SELECT lives_ok(
  $$SELECT investor_id, investor_type, firm_name_en, ticket_min_usd FROM public.public_investors_directory LIMIT 5$$,
  'SEC-01: anon can query public_investors_directory'
);

SELECT lives_ok(
  $$SELECT id, slug, name_en, verification_status FROM public.public_companies_directory LIMIT 5$$,
  'SEC-01: anon can query public_companies_directory'
);

SELECT lives_ok(
  $$SELECT id, slug, name_en FROM public.sectors WHERE is_active = true LIMIT 5$$,
  'SEC-01: anon can query active sectors'
);

SELECT lives_ok(
  $$SELECT public.get_public_system_flags()$$,
  'SEC-01: anon can call get_public_system_flags()'
);

SELECT throws_ok(
  $$SELECT email FROM public.profiles LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query raw profiles table'
);

SELECT throws_ok(
  $$SELECT id FROM public.investors LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query raw investors table'
);

SELECT throws_ok(
  $$SELECT id FROM public.companies LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query raw companies table'
);

SELECT throws_ok(
  $$SELECT id FROM public.pitches LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query raw pitches table'
);

SELECT throws_ok(
  $$SELECT id FROM public.pitch_documents LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query raw pitch_documents table'
);

SELECT throws_ok(
  $$SELECT id FROM public.verification_requests LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query verification_requests'
);

SELECT throws_ok(
  $$SELECT id FROM public.activity_logs LIMIT 1$$,
  '42501',
  NULL,
  'SEC-01: anon cannot query activity_logs'
);

RESET ROLE;

SELECT is(
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'public_investors_directory'
     AND column_name IN ('email', 'phone', 'rejection_reason', 'suspension_reason', 'is_accredited')),
  0::bigint,
  'SEC-01: public_investors_directory exposes zero private PII or verification columns'
);

SELECT is(
  (SELECT count(*) FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'public_companies_directory'
     AND column_name IN ('registration_number', 'rejection_reason', 'admin_feedback', 'owner_id')),
  0::bigint,
  'SEC-01: public_companies_directory exposes zero sensitive/registration columns'
);

SELECT * FROM finish();
ROLLBACK;
