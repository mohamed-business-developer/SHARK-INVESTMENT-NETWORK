-- SEC-07: Confidential Pitch & Restricted Document Grant Enforcement Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(8);

-- Impersonate Ungranted Approved Investor (...1104)
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111104', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.pitches WHERE id = '33333333-3333-4333-8333-333333333301'),
  1::bigint,
  'SEC-07: approved investor can view approved public pitch'
);

SELECT is_empty(
  $$SELECT id FROM public.pitches WHERE id = '33333333-3333-4333-8333-333333333302'$$,
  'SEC-07: ungranted approved investor cannot view restricted pitch'
);

SELECT is_empty(
  $$SELECT id FROM public.pitch_documents WHERE id = '44444444-4444-4444-8444-444444444402'$$,
  'SEC-07: ungranted approved investor cannot view restricted pitch_document'
);

-- Impersonate Granted Approved Investor (...1103)
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111103', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is(
  (SELECT count(*) FROM public.pitches WHERE id = '33333333-3333-4333-8333-333333333302'),
  1::bigint,
  'SEC-07: granted approved investor can view restricted pitch'
);

SELECT is(
  (SELECT count(*) FROM public.pitch_documents WHERE id = '44444444-4444-4444-8444-444444444402'),
  1::bigint,
  'SEC-07: granted approved investor can view restricted pitch_document metadata'
);

-- Simulate expired grant
RESET ROLE;
UPDATE public.pitch_access_grants
SET expires_at = now() - interval '1 minute'
WHERE pitch_id = '33333333-3333-4333-8333-333333333302'
  AND user_id = '11111111-1111-4111-8111-111111111103';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111103', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is_empty(
  $$SELECT id FROM public.pitches WHERE id = '33333333-3333-4333-8333-333333333302'$$,
  'SEC-07: expired grant immediately revokes restricted pitch access'
);

SELECT is_empty(
  $$SELECT id FROM public.pitch_documents WHERE id = '44444444-4444-4444-8444-444444444402'$$,
  'SEC-07: expired grant immediately revokes restricted document access'
);

-- Quarantine regression check: even on standard approved pitch, quarantined docs are hidden from investors
RESET ROLE;
UPDATE public.pitch_documents
SET scan_status = 'quarantined'
WHERE id = '44444444-4444-4444-8444-444444444401';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111103', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT is_empty(
  $$SELECT id FROM public.pitch_documents WHERE id = '44444444-4444-4444-8444-444444444401'$$,
  'SEC-07: quarantined pitch document is hidden from approved investors'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
