-- ============================================================
-- Migration: Content Assignment System
-- Adds teacher permission levels, material publish flag, and
-- the student_content_assignments table for teacher→student
-- content delegation.
-- ============================================================

-- 1. Teacher permission level per subject (default: read-only)
ALTER TABLE subject_teachers
  ADD COLUMN IF NOT EXISTS permission_level VARCHAR(10) NOT NULL DEFAULT 'read'
  CHECK (permission_level IN ('read', 'write'));

-- 2. Published flag for materials (mirrors quizzes / assignments)
--    Existing materials are set to published so teachers can still see them.
ALTER TABLE subject_materials
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT false;

UPDATE subject_materials SET is_published = true WHERE is_active = true;

-- 3. Teacher-to-student content assignments
CREATE TABLE IF NOT EXISTS student_content_assignments (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  content_type VARCHAR(20)  NOT NULL,
  content_id   UUID         NOT NULL,
  student_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID         NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (content_type, content_id, student_id),
  CHECK (content_type IN ('quiz', 'assignment', 'material'))
);

CREATE INDEX IF NOT EXISTS idx_sca_student ON student_content_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_sca_content ON student_content_assignments(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_sca_subject ON student_content_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_sca_assigner ON student_content_assignments(assigned_by);
