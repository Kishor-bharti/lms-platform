-- ============================================================
-- Supabase Storage policies for LMS buckets
-- Idempotent version (safe to re-run)
-- ============================================================

-- Drop existing policies first to avoid:
-- ERROR: policy "..." for table "objects" already exists
DROP POLICY IF EXISTS "Public read access for portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anon and authenticated users can upload to portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anon and authenticated users can update portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from portal-assets" ON storage.objects;
DROP POLICY IF EXISTS "Anon and authenticated users can delete from portal-assets" ON storage.objects;

DROP POLICY IF EXISTS "Public read access for temp-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to temp-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anon and authenticated users can upload to temp-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete from temp-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anon and authenticated users can delete from temp-uploads" ON storage.objects;

-- ═══════════════════════════════════════════
-- portal-assets policies
-- ═══════════════════════════════════════════

-- SELECT: public (includes anon + authenticated)
CREATE POLICY "Public read access for portal-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'portal-assets');

-- INSERT: anon + authenticated
CREATE POLICY "Anon and authenticated users can upload to portal-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portal-assets' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

-- UPDATE: anon + authenticated (needed for upsert move flow)
CREATE POLICY "Anon and authenticated users can update portal-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portal-assets' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'))
WITH CHECK (bucket_id = 'portal-assets' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

-- DELETE: anon + authenticated
CREATE POLICY "Anon and authenticated users can delete from portal-assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'portal-assets' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

-- ═══════════════════════════════════════════
-- temp-uploads policies
-- ═══════════════════════════════════════════

-- SELECT: public (includes anon + authenticated)
CREATE POLICY "Public read access for temp-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-uploads');

-- INSERT: anon + authenticated
CREATE POLICY "Anon and authenticated users can upload to temp-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'temp-uploads' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));

-- DELETE: anon + authenticated
CREATE POLICY "Anon and authenticated users can delete from temp-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'temp-uploads' AND (auth.role() = 'anon' OR auth.role() = 'authenticated'));
