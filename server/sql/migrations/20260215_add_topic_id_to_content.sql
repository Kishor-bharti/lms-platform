-- Migration: Add topic_id FK to sessions, assignments, subject_materials, and quizzes
-- This lets teachers tag content to a specific topic so students see only relevant content per topic.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

ALTER TABLE assignments
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

ALTER TABLE subject_materials
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;

ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
