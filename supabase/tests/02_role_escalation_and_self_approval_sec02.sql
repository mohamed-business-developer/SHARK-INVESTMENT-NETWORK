-- SEC-02: Role Escalation & Self-Approval Prevention Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(6);

-- Simulate hostile signup attempting to inject role=admin & account_status=approved
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '99999999-9999-4999-8999-999999999901',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'attacker.signup@shark.test',
  '',
  now(),
  '{"provider":"email"}'::jsonb,
  '{"full_name":"Escalation Test","role":"admin","account_status":"approved"}'::jsonb,
  now(),
  now()
);

SELECT is(
  (SELECT role::text FROM public.profiles WHERE id = '99999999-9999-4999-8999-999999999901'),
  'member',
  'SEC-02: handle_new_user downgrades forged admin signup role to member'
);

SELECT is(
  (SELECT account_status::text FROM public.profiles WHERE id = '99999999-9999-4999-8999-999999999901'),
  'pending',
  'SEC-02: handle_new_user forces new signup account_status to pending'
);

-- Authenticate as pending user
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111106', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT throws_ok(
  $$UPDATE public.profiles SET role = 'admin' WHERE id = '11111111-1111-4111-8111-111111111106'$$,
  '42501',
  NULL,
  'SEC-02: user cannot escalate own profile role to admin'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET account_status = 'approved' WHERE id = '11111111-1111-4111-8111-111111111106'$$,
  '42501',
  NULL,
  'SEC-02: user cannot self-approve own account_status'
);

SELECT throws_ok(
  $$UPDATE public.profiles SET approved_at = now(), approved_by = '11111111-1111-4111-8111-111111111106' WHERE id = '11111111-1111-4111-8111-111111111106'$$,
  '42501',
  NULL,
  'SEC-02: user cannot tamper with approval metadata columns'
);

SELECT throws_ok(
  $$INSERT INTO public.admin_roles (user_id, role_name, permissions, is_active) VALUES ('11111111-1111-4111-8111-111111111106', 'super_admin', ARRAY['*'], true)$$,
  '42501',
  NULL,
  'SEC-02: non-admin user cannot insert into admin_roles'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
