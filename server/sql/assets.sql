-- portal-assets bucket
-- 1. Create the bucket
-- Supabase Dashboard > Storage > New bucket:

-- Name: portal-assets
-- Public bucket: ON
-- File size limit: 100 MB (matches server-side multer limit)
-- Allowed MIME types: leave empty (accept all types — PDFs, docs, images, videos, zips)
-- 2. Add RLS policies
-- Go to SQL Editor in Supabase and run:
-- Public read — anyone can view/download published portal content
CREATE POLICY "Public read access for portal-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'portal-assets');

-- Authenticated upload — server uploads via anon key
CREATE POLICY "Authenticated users can upload to portal-assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'portal-assets'
  AND auth.role() = 'authenticated'
);

-- Authenticated update — needed for move-on-publish (upsert)
CREATE POLICY "Authenticated users can update portal-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portal-assets')
WITH CHECK (bucket_id = 'portal-assets');

-- Authenticated delete — needed for hard-delete cleanup
CREATE POLICY "Authenticated users can delete from portal-assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'portal-assets'
  AND auth.role() = 'authenticated'
);

-- temp-uploads bucket
-- 1. Create the bucket
-- Supabase Dashboard > Storage > New bucket:

-- Name: temp-uploads
-- Public bucket: ON (students/teachers need to view their own uploads via public URL)
-- File size limit: 100 MB
-- Allowed MIME types: leave empty (accept all)
-- 2. Add RLS policies
-- Public read — users view their own uploads via public URLs
CREATE POLICY "Public read access for temp-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-uploads');

-- Authenticated upload
CREATE POLICY "Authenticated users can upload to temp-uploads"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'temp-uploads'
  AND auth.role() = 'authenticated'
);

-- Authenticated delete — needed for hard-delete + move-on-publish (delete source)
CREATE POLICY "Authenticated users can delete from temp-uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'temp-uploads'
  AND auth.role() = 'authenticated'
);


-- All in one SQL file

-- ═══════════════════════════════════════════
-- portal-assets policies
-- ═══════════════════════════════════════════
CREATE POLICY "Public read access for portal-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'portal-assets');

CREATE POLICY "Authenticated users can upload to portal-assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portal-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update portal-assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portal-assets')
WITH CHECK (bucket_id = 'portal-assets');

CREATE POLICY "Authenticated users can delete from portal-assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'portal-assets' AND auth.role() = 'authenticated');

-- ═══════════════════════════════════════════
-- temp-uploads policies
-- ═══════════════════════════════════════════
CREATE POLICY "Public read access for temp-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'temp-uploads');

CREATE POLICY "Authenticated users can upload to temp-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'temp-uploads' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete from temp-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'temp-uploads' AND auth.role() = 'authenticated');
