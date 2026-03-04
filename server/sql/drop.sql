-- ============================================================
-- drop.sql — Drop all schema objects
-- Completely resets the database. Run schema.sql + seed.sql
-- afterwards to rebuild from scratch.
-- ============================================================

-- Views (depend on tables — drop first)
DROP VIEW IF EXISTS v_teacher_dashboard;
DROP VIEW IF EXISTS v_subject_resources;
DROP VIEW IF EXISTS v_student_report;
DROP VIEW IF EXISTS v_session_dashboard;

-- Tables with CASCADE (automatically drops indexes, triggers, constraints)
-- Activity
DROP TABLE IF EXISTS attempt_answers        CASCADE;
DROP TABLE IF EXISTS assignment_submissions  CASCADE;
DROP TABLE IF EXISTS quiz_attempts          CASCADE;
-- Content
DROP TABLE IF EXISTS options                CASCADE;
DROP TABLE IF EXISTS questions              CASCADE;
DROP TABLE IF EXISTS quiz_sets             CASCADE;
DROP TABLE IF EXISTS quizzes               CASCADE;
DROP TABLE IF EXISTS assignments            CASCADE;
-- Delivery
DROP TABLE IF EXISTS sessions              CASCADE;
DROP TABLE IF EXISTS session_recurrence    CASCADE;
DROP TABLE IF EXISTS subject_materials     CASCADE;
-- Activity (progress)
DROP TABLE IF EXISTS student_progress      CASCADE;
-- Courses
DROP TABLE IF EXISTS subject_enrollments   CASCADE;
DROP TABLE IF EXISTS subject_teachers      CASCADE;
DROP TABLE IF EXISTS topics                CASCADE;
DROP TABLE IF EXISTS subjects              CASCADE;
DROP TABLE IF EXISTS courses               CASCADE;
-- Identity
DROP TABLE IF EXISTS user_roles            CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;
DROP TABLE IF EXISTS roles                 CASCADE;

-- Functions (triggers are already gone with their tables)
DROP FUNCTION IF EXISTS fn_session_teacher_check() CASCADE;
DROP FUNCTION IF EXISTS fn_quiz_teacher_check()    CASCADE;
DROP FUNCTION IF EXISTS fn_set_updated_at()        CASCADE;

-- Extension
DROP EXTENSION IF EXISTS pgcrypto;
