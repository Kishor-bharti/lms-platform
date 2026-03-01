# Supabase Storage Bucket Setup — Quiz Images

This guide ensures the `quiz-images` bucket is correctly configured so that:
- **Teachers/Admins** can upload images via the API (using the `anon` key)
- **Students (and everyone)** can view/read images via public URLs

---

## The Problem

`getPublicUrl()` in the Supabase JS client generates a URL like:

```
https://<project>.supabase.co/storage/v1/object/public/quiz-images/quiz-images/1234-abc.png
```

This URL **always returns a URL string** — even if the bucket isn't public. But the actual HTTP request to that URL will return **400 / 404 / empty** if:

1. The bucket is not marked as **Public**, OR
2. There is no **RLS policy** allowing `SELECT` (read) on the `storage.objects` table

---

## Step-by-Step Setup

### 1. Go to Supabase Dashboard → Storage

URL: `https://supabase.com/dashboard/project/<your-project-ref>/storage/buckets`

### 2. Create the bucket (if it doesn't exist)

- Click **"New bucket"**
- **Name:** `quiz-images`
- ✅ **Toggle "Public bucket" ON** ← This is the critical setting
- **File size limit:** `2MB` (matches our server-side multer limit)
- **Allowed MIME types:** `image/jpeg, image/png, image/gif, image/webp`
- Click **"Create bucket"**

> **If the bucket already exists but is private:**
> 1. Click the bucket name (`quiz-images`)
> 2. Click the **⚙️ gear icon** (bucket settings) at the top right
> 3. Toggle **"Public bucket"** ON
> 4. Save

### 3. Add RLS Policies

Go to: **Storage → Policies** (or **SQL Editor**)

You need **two** policies on the `storage.objects` table:

#### Policy A — Allow anyone to READ (view/download) images

This lets the public URL actually serve the file.

```sql
-- Allow public read access to quiz-images bucket
CREATE POLICY "Public read access for quiz-images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'quiz-images');
```

#### Policy B — Allow authenticated users to UPLOAD images

This lets teachers/admins upload via the API.

```sql
-- Allow authenticated users to upload to quiz-images bucket
CREATE POLICY "Authenticated users can upload quiz images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'quiz-images'
  AND auth.role() = 'authenticated'
);
```

> **Quick way — run both in SQL Editor:**
>
> Go to **SQL Editor** in the Supabase dashboard and run:
>
> ```sql
> -- 1. Public read
> CREATE POLICY "Public read access for quiz-images"
> ON storage.objects FOR SELECT
> USING (bucket_id = 'quiz-images');
>
> -- 2. Authenticated upload
> CREATE POLICY "Authenticated users can upload quiz images"
> ON storage.objects FOR INSERT
> WITH CHECK (
>   bucket_id = 'quiz-images'
>   AND auth.role() = 'authenticated'
> );
> ```

### 4. Verify the URL structure

Our upload code stores the file at path:

```
quiz-images/<timestamp>-<random>.jpg
```

inside the bucket named `quiz-images`. So the resulting public URL will be:

```
https://<project>.supabase.co/storage/v1/object/public/quiz-images/quiz-images/1234-abc.jpg
                                                       ^^^^^^^^^^^^ ^^^^^^^^^^^^
                                                       bucket name   file path
```

This is correct — the double `quiz-images` is expected (bucket name + folder inside it).

### 5. Test it

1. Open the URL from one of your existing quiz question `image_url` values directly in the browser (incognito / logged out)
2. If you see the image → ✅ Setup is correct
3. If you get a JSON error like `{"statusCode":"404","error":"Not found"}` or `{"error":"Bucket not public"}` → the bucket is still private or the SELECT policy is missing

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Upload works but image URL returns 400/404 | Bucket is **private** | Toggle bucket to **Public** in settings |
| Upload works, URL returns empty/broken image | SELECT policy missing | Add the `FOR SELECT` policy above |
| Upload fails with 403 | INSERT policy missing or wrong auth | Add the `FOR INSERT` policy above |
| URL has unexpected path | Bucket name vs folder confusion | The path `quiz-images/...` inside bucket `quiz-images` is correct by our code |
| "new row violates RLS" on upload | No INSERT policy | Add the `FOR INSERT` policy above |

---

## Environment Variables (already configured)

In `server/.env.development` and `server/.env.production`:

```env
SUPABASE_URL_PUBLIC=https://<project>.supabase.co
SUPABASE_ANON_KEY=eyJ...
```

These are used in `server/src/modules/upload/upload.controller.ts` to create the Supabase client for uploads.

---

## Summary

The **two things** most likely missing are:

1. **Bucket is not set to Public** → toggle it ON in bucket settings
2. **No SELECT (read) RLS policy** → images upload fine but nobody can view them via the public URL
