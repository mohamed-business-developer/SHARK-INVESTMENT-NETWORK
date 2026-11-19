-- SEC-08: Storage Bucket Privacy & Storage Object RLS Boundary Tests
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET LOCAL search_path TO extensions, public, auth, storage, pg_catalog;

SELECT plan(7);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'pitch-documents'),
  false,
  'SEC-08: pitch-documents bucket is strictly private'
);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'verification-documents'),
  false,
  'SEC-08: verification-documents bucket is strictly private'
);

SELECT is(
  (SELECT public FROM storage.buckets WHERE id = 'public-assets'),
  true,
  'SEC-08: public-assets bucket is configured public for approved avatars/logos'
);

SELECT is(
  (SELECT count(*)
   FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND cmd = 'SELECT'
     AND (qual ILIKE '%pitch-documents%' OR qual ILIKE '%verification-documents%')),
  0::bigint,
  'SEC-08: zero client SELECT policies allow direct listing or download on private buckets'
);

SELECT is(
  public.try_parse_uuid('not-a-valid-uuid'),
  NULL::uuid,
  'SEC-08: try_parse_uuid returns NULL safely on malformed storage paths'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-4111-8111-111111111104', 'role', 'authenticated', 'aud', 'authenticated')::text,
  true
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('verification-documents', '11111111-1111-4111-8111-111111111105/22222222-2222-4222-8222-222222222201/33333333-3333-4333-8333-333333333301.pdf', '11111111-1111-4111-8111-111111111104')$$,
  '42501',
  NULL,
  'SEC-08: user cannot upload verification object under another user UUID folder'
);

SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('pitch-documents', '22222222-2222-4222-8222-222222222201/33333333-3333-4333-8333-333333333301/44444444-4444-4444-8444-444444444499.pdf', '11111111-1111-4111-8111-111111111104')$$,
  '42501',
  NULL,
  'SEC-08: non-member user cannot upload pitch object into another company folder'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
