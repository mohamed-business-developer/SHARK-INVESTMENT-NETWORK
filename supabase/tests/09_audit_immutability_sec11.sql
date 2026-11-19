-- SEC-11: Audit Log Immutability, FORCE ROW LEVEL SECURITY, and Column Privilege Verification
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(6);

SELECT is(
  (SELECT count(*)
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity = true
     AND c.relforcerowsecurity = true),
  20::bigint,
  'SEC-11: all 20 canonical public tables enforce ENABLE + FORCE ROW LEVEL SECURITY'
);

SELECT is(
  has_column_privilege('authenticated', 'public.verification_requests', 'internal_notes', 'SELECT'),
  false,
  'SEC-11: verification_requests.internal_notes is hidden from authenticated client SELECT'
);

SELECT is(
  has_column_privilege('anon', 'public.verification_requests', 'internal_notes', 'SELECT'),
  false,
  'SEC-11: verification_requests.internal_notes is hidden from anon client SELECT'
);

INSERT INTO public.activity_logs (action, entity_type, reason)
VALUES ('sec11.fixture_event', 'system', 'Immutability test row');

SELECT throws_ok(
  $$UPDATE public.activity_logs SET reason = 'Tampered reason' WHERE action = 'sec11.fixture_event'$$,
  '42501',
  NULL,
  'SEC-11: activity_logs UPDATE is strictly blocked even by privileged owner'
);

SELECT throws_ok(
  $$DELETE FROM public.activity_logs WHERE action = 'sec11.fixture_event'$$,
  '42501',
  NULL,
  'SEC-11: activity_logs DELETE is strictly blocked even by privileged owner'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.activity_logs WHERE action = 'sec11.fixture_event'
  ),
  'SEC-11: audit log record remains intact after rejected tamper attempts'
);

SELECT * FROM finish();
ROLLBACK;
