-- ============================================================
-- truncate.sql — Clear all data, preserve schema
-- Deletes all rows from every table, then re-seeds the static
-- roles reference data. Safe to run multiple times.
-- ============================================================

-- TRUNCATE fires statement-level triggers only (not row-level),
-- so authorization / updated_at triggers do NOT fire — no need
-- to disable them. CASCADE handles FK ordering automatically.
TRUNCATE TABLE
  attempt_answers,
  assignment_submissions,
  quiz_attempts,
  options,
  questions,
  quiz_sets,
  quizzes,
  assignments,
  sessions,
  session_recurrence,
  subject_materials,
  student_progress,
  subject_enrollments,
  subject_teachers,
  topics,
  subjects,
  courses,
  user_roles,
  users,
  roles
CASCADE;

-- Re-seed static reference data (required by user_roles FK)
INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'teacher'),
  (3, 'student');
