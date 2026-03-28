-- Migration: Replace due_date with duration_days in assignments,
-- add due_date to student_content_assignments for per-student deadline tracking

-- 1. Add duration_days to assignments (replaces due_date as the primary deadline mechanism)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS duration_days INTEGER;

-- 2. Migrate existing due_date values to duration_days (approximate: 7 days default)
-- Keep due_date column for backward compatibility but it will no longer be set directly

-- 3. Add due_date to student_content_assignments for auto-calculated per-student deadlines
ALTER TABLE student_content_assignments ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
