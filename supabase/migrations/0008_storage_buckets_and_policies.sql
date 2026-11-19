-- ============================================================================
-- Migration 0008: Storage Buckets & Strict Private Object RLS Policies
-- Reference: docs/DATABASE.md §9 & docs/SECURITY.md §5
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'public-assets',
    'public-assets',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'pitch-documents',
    'pitch-documents',
    false,
    26214400,
    ARRAY[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg'
    ]
  ),
  (
    'verification-documents',
    'verification-documents',
    false,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png']
  )
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Safe UUID segment parser so malformed storage paths never trigger cast errors
CREATE OR REPLACE FUNCTION public.try_parse_uuid(input text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN input ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN input::uuid
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.try_parse_uuid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_parse_uuid(text) TO authenticated;

-- ============================================================================
-- public-assets: Public read; owner-scoped avatar or company operator uploads
-- ============================================================================

CREATE POLICY public_assets_read
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'public-assets');

CREATE POLICY public_assets_insert_scoped
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'public-assets'
    AND public.is_not_suspended()
    AND (
      (
        split_part(name, '/', 1) = 'avatars'
        AND split_part(name, '/', 2) = auth.uid()::text
        AND name ~ '^avatars/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      )
      OR (
        split_part(name, '/', 1) = 'companies'
        AND name ~ '^companies/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9_]+_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
        AND public.is_company_operator(public.try_parse_uuid(split_part(name, '/', 2)))
      )
    )
  );

CREATE POLICY public_assets_update_scoped
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'public-assets'
    AND public.is_not_suspended()
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'companies' AND public.is_company_operator(public.try_parse_uuid(split_part(name, '/', 2))))
    )
  );

CREATE POLICY public_assets_delete_scoped
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'public-assets'
    AND (
      (split_part(name, '/', 1) = 'avatars' AND split_part(name, '/', 2) = auth.uid()::text)
      OR (split_part(name, '/', 1) = 'companies' AND public.is_company_operator(public.try_parse_uuid(split_part(name, '/', 2))))
    )
  );

-- ============================================================================
-- pitch-documents (STRICT PRIVATE): Zero direct client SELECT policies!
-- Short-lived Signed URLs issued exclusively by Edge Function get-signed-document-url.
-- ============================================================================

CREATE POLICY pitch_documents_storage_insert_operator
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pitch-documents'
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|pptx|xlsx|png|jpg|jpeg)$'
    AND public.is_company_operator(public.try_parse_uuid(split_part(name, '/', 1)))
  );

CREATE POLICY pitch_documents_storage_delete_operator_or_admin
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pitch-documents'
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|pptx|xlsx|png|jpg|jpeg)$'
    AND (
      public.is_company_operator(public.try_parse_uuid(split_part(name, '/', 1)))
      OR public.is_active_admin('documents:moderate')
    )
  );

-- ============================================================================
-- verification-documents (STRICT PRIVATE): Zero direct client SELECT policies!
-- ============================================================================

CREATE POLICY verification_documents_storage_insert_owner
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND public.is_not_suspended()
    AND split_part(name, '/', 1) = auth.uid()::text
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|jpeg)$'
  );

CREATE POLICY verification_documents_storage_delete_owner
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND public.is_not_suspended()
  );
