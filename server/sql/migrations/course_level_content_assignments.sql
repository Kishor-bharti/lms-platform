-- Allow course-level content assignments (e.g. course quizzes not tied to a subject)
-- subject_id becomes optional; course_id added for course-scoped assignments

ALTER TABLE student_content_assignments
  ALTER COLUMN subject_id DROP NOT NULL;

ALTER TABLE student_content_assignments
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_sca_course ON student_content_assignments(course_id);
