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
