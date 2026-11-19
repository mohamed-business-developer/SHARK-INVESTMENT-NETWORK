-- SEC-05: Suspended Account Immediate Revocation Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(6);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111108', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is(
  public.is_approved_user(),
  false,
  'SEC-05: is_approved_user() evaluates false for suspended investor'
);

SELECT is(
  public.is_active_admin(),
  false,
  'SEC-05: is_active_admin() evaluates false for suspended user'
);

SELECT is_empty(
  $$SELECT id FROM public.pitches$$,
  'SEC-05: suspended user cannot read any pitches'
);

SELECT is_empty(
  $$SELECT id FROM public.pitch_documents$$,
  'SEC-05: suspended user cannot read any pitch_documents'
);

SELECT throws_ok(
  $$INSERT INTO public.investment_interests (pitch_id, company_id, investor_id, indicative_amount_usd) VALUES ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111108', 25000)$$,
  '42501',
  NULL,
  'SEC-05: suspended user cannot insert investment_interests'
);

UPDATE public.profiles
SET bio_en = 'Bypass attempt'
WHERE id = '11111111-1111-4111-8111-111111111108';

RESET ROLE;

SELECT is(
  (SELECT bio_en FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111108'),
  NULL::text,
  'SEC-05: suspended user cannot mutate own profile (0 rows updated under RLS)'
);

SELECT * FROM finish();
ROLLBACK;
