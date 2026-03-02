-- Migration: Add explanation_image_url to questions table
-- Date: 2025-01-XX
-- Purpose: Support image uploads for quiz question explanations

ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_image_url TEXT;

-- Update the schema.sql for reference
COMMENT ON COLUMN questions.explanation_image_url IS 'URL for optional explanation image';
