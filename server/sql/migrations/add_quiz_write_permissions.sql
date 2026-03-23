-- Migration: per-quiz write permissions for teachers
-- A teacher granted write on a specific quiz can see it (even unpublished) and add questions.
-- Separate from subject_teachers.permission_level which is subject-wide.

CREATE TABLE IF NOT EXISTS quiz_write_permissions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID        NOT NULL REFERENCES quizzes(id)  ON DELETE CASCADE,
  teacher_id  UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  granted_by  UUID        NOT NULL REFERENCES users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_qwp_quiz_id    ON quiz_write_permissions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_qwp_teacher_id ON quiz_write_permissions(teacher_id);
