-- ================================================================
-- Migration: Session 'missed' status support
-- Run BEFORE deploying the session time-gate feature.
-- ================================================================
-- (DON't Forget to run this!!')
-- Drop the old check constraint (auto-named by Postgres)
DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname
  FROM   pg_constraint
  WHERE  conrelid = 'sessions'::regclass
    AND  contype  = 'c'
    AND  pg_get_constraintdef(oid) LIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE sessions DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
END $$;

-- Add updated constraint that includes 'missed'
ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('scheduled','live','completed','cancelled','missed'));


-- ================================================================
-- Migration: T1/T2/T6/T7/T8/T10 — Teacher UX & Quiz Image Options
-- Run on: 10x_db_clone
-- ================================================================

-- T2/T8: Per-student assignment targeting
-- NULL = visible to all enrolled students, non-NULL = specific student only
ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- T6/T1: 1-on-1 session targeting
-- Stores which students a session is explicitly for.
-- If no rows exist for a session → it's open to all enrolled students.
CREATE TABLE IF NOT EXISTS session_students (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (session_id, student_id)
);

-- T10: Image upload support for quiz answer options
ALTER TABLE options
  ADD COLUMN IF NOT EXISTS option_image_url TEXT;

-- option_text is now optional (either text or image required at app level)
ALTER TABLE options
  ALTER COLUMN option_text DROP NOT NULL;



-- ================================================================
-- after creating a new bucket "assignment-files" in S3, run the following to update the default value for the "assignment_image_url" column:
-- ================================================================

-- read SETUP_DATABASE_AND_STORAGE.md for instructions on how to create the bucket and get the URL


-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to assignment-files"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-files');

-- Allow public reads (so uploaded files are accessible)
CREATE POLICY "Allow public reads from assignment-files"
ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'assignment-files');


-- update policy on supabase
CREATE POLICY "Allow anon uploads to assignment-files"
ON storage.objects
FOR INSERT TO anon
WITH CHECK (bucket_id = 'assignment-files');
