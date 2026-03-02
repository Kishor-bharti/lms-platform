-- Truncate All Data While Keeping Schema & Indexes
-- This script clears all data but preserves tables, indexes, triggers, and functions

-- Disable triggers to avoid constraint violations during truncation
ALTER TABLE attempt_answers DISABLE TRIGGER ALL;
ALTER TABLE assignment_submissions DISABLE TRIGGER ALL;
ALTER TABLE assignments DISABLE TRIGGER ALL;
ALTER TABLE quiz_attempts DISABLE TRIGGER ALL;
ALTER TABLE questions DISABLE TRIGGER ALL;
ALTER TABLE options DISABLE TRIGGER ALL;
ALTER TABLE quiz_sets DISABLE TRIGGER ALL;
ALTER TABLE quizzes DISABLE TRIGGER ALL;
ALTER TABLE sessions DISABLE TRIGGER ALL;
ALTER TABLE subject_materials DISABLE TRIGGER ALL;
ALTER TABLE student_progress DISABLE TRIGGER ALL;
ALTER TABLE subject_enrollments DISABLE TRIGGER ALL;
ALTER TABLE subject_teachers DISABLE TRIGGER ALL;
ALTER TABLE topics DISABLE TRIGGER ALL;
ALTER TABLE subjects DISABLE TRIGGER ALL;
ALTER TABLE courses DISABLE TRIGGER ALL;
ALTER TABLE user_roles DISABLE TRIGGER ALL;
ALTER TABLE users DISABLE TRIGGER ALL;

-- Truncate Tables (in reverse dependency order)
-- This deletes all data but keeps the schema intact
TRUNCATE TABLE attempt_answers CASCADE;
TRUNCATE TABLE assignment_submissions CASCADE;
TRUNCATE TABLE assignments CASCADE;
TRUNCATE TABLE quiz_attempts CASCADE;
TRUNCATE TABLE questions CASCADE;
TRUNCATE TABLE options CASCADE;
TRUNCATE TABLE quiz_sets CASCADE;
TRUNCATE TABLE quizzes CASCADE;
TRUNCATE TABLE sessions CASCADE;
TRUNCATE TABLE session_recurrence CASCADE;
TRUNCATE TABLE subject_materials CASCADE;
TRUNCATE TABLE student_progress CASCADE;
TRUNCATE TABLE subject_enrollments CASCADE;
TRUNCATE TABLE subject_teachers CASCADE;
TRUNCATE TABLE topics CASCADE;
TRUNCATE TABLE subjects CASCADE;
TRUNCATE TABLE courses CASCADE;
TRUNCATE TABLE user_roles CASCADE;
TRUNCATE TABLE users CASCADE;
TRUNCATE TABLE roles CASCADE;

-- Re-enable all triggers
ALTER TABLE users ENABLE TRIGGER ALL;
ALTER TABLE user_roles ENABLE TRIGGER ALL;
ALTER TABLE courses ENABLE TRIGGER ALL;
ALTER TABLE subjects ENABLE TRIGGER ALL;
ALTER TABLE topics ENABLE TRIGGER ALL;
ALTER TABLE subject_teachers ENABLE TRIGGER ALL;
ALTER TABLE subject_enrollments ENABLE TRIGGER ALL;
ALTER TABLE student_progress ENABLE TRIGGER ALL;
ALTER TABLE subject_materials ENABLE TRIGGER ALL;
ALTER TABLE session_recurrence ENABLE TRIGGER ALL;
ALTER TABLE sessions ENABLE TRIGGER ALL;
ALTER TABLE quiz_sets ENABLE TRIGGER ALL;
ALTER TABLE quizzes ENABLE TRIGGER ALL;
ALTER TABLE options ENABLE TRIGGER ALL;
ALTER TABLE questions ENABLE TRIGGER ALL;
ALTER TABLE quiz_attempts ENABLE TRIGGER ALL;
ALTER TABLE assignments ENABLE TRIGGER ALL;
ALTER TABLE assignment_submissions ENABLE TRIGGER ALL;
ALTER TABLE attempt_answers ENABLE TRIGGER ALL;

-- Verify all data is cleared
SELECT 'attempt_answers' AS table_name, COUNT(*) AS row_count FROM attempt_answers
UNION ALL
SELECT 'assignment_submissions', COUNT(*) FROM assignment_submissions
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL
SELECT 'quiz_attempts', COUNT(*) FROM quiz_attempts
UNION ALL
SELECT 'questions', COUNT(*) FROM questions
UNION ALL
SELECT 'options', COUNT(*) FROM options
UNION ALL
SELECT 'quiz_sets', COUNT(*) FROM quiz_sets
UNION ALL
SELECT 'quizzes', COUNT(*) FROM quizzes
UNION ALL
SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL
SELECT 'subject_materials', COUNT(*) FROM subject_materials
UNION ALL
SELECT 'student_progress', COUNT(*) FROM student_progress
UNION ALL
SELECT 'subject_enrollments', COUNT(*) FROM subject_enrollments
UNION ALL
SELECT 'subject_teachers', COUNT(*) FROM subject_teachers
UNION ALL
SELECT 'topics', COUNT(*) FROM topics
UNION ALL
SELECT 'subjects', COUNT(*) FROM subjects
UNION ALL
SELECT 'courses', COUNT(*) FROM courses
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'roles', COUNT(*) FROM roles
ORDER BY table_name;
