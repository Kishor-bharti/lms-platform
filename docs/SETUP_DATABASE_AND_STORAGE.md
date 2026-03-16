# Database & Storage Setup Guide

Complete reference for all PostgreSQL migrations and Supabase Storage configuration
required to run the 10xAccel LMS platform.

Run migrations against your target database (e.g. `10x_db_clone` for dev).
All SQL in this file is **idempotent** — safe to re-run.

---

## Part 1 — PostgreSQL Migrations

### How to run

```bash
# option A — psql directly
psql $DATABASE_URL -f server/sql/latest_migration.sql

# option B — npm script
cd server && npm run migrate
```

---

### Migration 1 — Core schema (run once on a fresh DB)

```bash
psql $DATABASE_URL -f server/sql/schema.sql
```

This creates every table, index, trigger, view, and function.
Do **not** run this against a DB that already has data — it will fail on duplicate table errors.

---

### Migration 2 — T1 / T2 / T6 / T8 / T10 (feature branch: `blindfold-updates`)

File: `server/sql/latest_migration.sql`

```sql
-- T2/T8: Per-student assignment targeting
-- NULL = visible to all enrolled students, UUID = specific student only
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- T1: 1-on-1 session targeting
-- No rows for a session → open to all enrolled students.
-- Rows present → only those students can see/join the session.
CREATE TABLE IF NOT EXISTS session_students (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (session_id, student_id)
);

-- T10: Image upload support for quiz answer options
ALTER TABLE options
  ADD COLUMN IF NOT EXISTS option_image_url TEXT;

-- option_text is now optional at DB level (app enforces: text OR image required)
ALTER TABLE options
  ALTER COLUMN option_text DROP NOT NULL;
```

> **Note:** `session_recurrence` and all other tables used by A5/A6/A7 (admin
> session scheduling, recurring sessions) already exist in `schema.sql`.
> No extra migration is needed for those features.

---

### Quick reference — what each column/table does

| Object | Purpose |
|--------|---------|
| `assignments.assigned_to` | When set, only that student sees the assignment. NULL = all enrolled students. |
| `session_students` | Join table for 1-on-1 sessions. Empty = public to subject. Populated = restricted. |
| `options.option_image_url` | URL of the image used as an answer option in a quiz question. |
| `options.option_text` | Now nullable — either text or image is required (enforced at app level). |
| `session_recurrence` | Stores recurrence rules (pattern, days_of_week, recur_until). Already in schema. |
| `sessions.recurrence_id` | FK to `session_recurrence`. Set for all sessions in a recurring series. |
| `sessions.is_recurring` | Boolean flag, true for sessions that are part of a recurring series. |

---

## Part 2 — Supabase Storage

The server uses the **Supabase anon key** for all storage operations (no user JWT is
forwarded). This means every RLS INSERT policy must grant access to the **`anon` role**.

---

### Bucket 1 — `quiz-images` (already exists)

Used for quiz answer option images (T10).

#### Settings
| Setting | Value |
|---------|-------|
| Name | `quiz-images` |
| Public | ✅ Yes |
| Allowed MIME types | `image/jpeg, image/png, image/gif, image/webp` |
| File size limit | 2 MB |

#### Required RLS policies

Run in **Supabase Dashboard → SQL Editor**:

```sql
-- Allow the server (anon key) to upload quiz images
CREATE POLICY "Allow anon uploads to quiz-images"
ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'quiz-images');

-- Allow anyone to read/view images via public URL
CREATE POLICY "Allow public reads from quiz-images"
ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'quiz-images');
```

> If these policies already exist you will see a "policy already exists" error — that is fine, skip them.

---

### Bucket 2 — `assignment-files` (create this)

Used for assignment attachments (teacher uploads) and student submission files (T3).

#### Step 1 — Create the bucket

1. Go to **Supabase Dashboard → Storage → New bucket**
2. **Name:** `assignment-files`
3. **Public bucket:** ✅ ON
4. **Allowed MIME types:** leave blank (allows all types — PDF, Word, Excel, images)
5. **File size limit:** `10` MB
6. Click **Create bucket**

#### Step 2 — Add RLS policies

Run in **Supabase Dashboard → SQL Editor**:

```sql
-- Allow the server (anon key) to upload assignment files
CREATE POLICY "Allow anon uploads to assignment-files"
ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'assignment-files');

-- Allow anyone to read/download files via public URL
CREATE POLICY "Allow public reads from assignment-files"
ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'assignment-files');
```

---

### Why `anon` and not `authenticated`?

The server never forwards the user's JWT to Supabase.
It creates the Supabase client with only the anon key:

```ts
createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY)
```

Our app has its own JWT signed with `JWT_SECRET` — Supabase cannot verify it (different
signing secret), so passing it causes **"signature verification failed"**.

Result: every Supabase storage request runs as the **`anon`** role. Policies targeting
`authenticated` will never match from server-side uploads.

---

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `new row violates row-level security policy` | No INSERT policy for `anon` role | Add the `FOR INSERT TO anon` policy above |
| `signature verification failed` | App JWT forwarded to Supabase | Don't forward the JWT — use plain anon client |
| `Bucket not found` | Bucket was not created | Create bucket in Supabase Dashboard → Storage |
| Upload works but URL returns 404 | Bucket is private or no SELECT policy | Toggle bucket Public + add SELECT policy |
| `Unsupported file type` | File MIME not in server allowlist | Update `allowed` array in `upload.controller.ts` |
| `PayloadTooLargeError` | File exceeds multer limit | 2 MB for images, 10 MB for assignment files |

---

## Part 3 — Environment variables (server)

These must be set in `server/.env.development` (and `.env.production`):

```env
# PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Auth
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Supabase Storage
SUPABASE_URL_PUBLIC=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...

# Optional — override the bucket used for assignment file uploads
# Default: assignment-files
# SUPABASE_ASSIGNMENT_BUCKET=assignment-files

# Zoom (required in production, optional in dev)
ZOOM_ACCOUNT_ID=
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_HOST_EMAIL=
```

---

## Checklist — fresh environment setup

- [ ] Run `server/sql/schema.sql` against the new DB
- [ ] Run `server/sql/latest_migration.sql` (or the idempotent SQL in Migration 2 above)
- [ ] Create Supabase bucket `quiz-images` (public, image MIME types, 2 MB)
- [ ] Add RLS policies for `quiz-images` (anon INSERT + public SELECT)
- [ ] Create Supabase bucket `assignment-files` (public, no MIME restriction, 10 MB)
- [ ] Add RLS policies for `assignment-files` (anon INSERT + public SELECT)
- [ ] Set all required env vars in `server/.env.development`
- [ ] `cd server && npm run dev` — confirm no startup errors
- [ ] `cd client && npm start` — confirm app loads
