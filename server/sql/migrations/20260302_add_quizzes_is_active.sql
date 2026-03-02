-- Add is_active column to quizzes table for soft delete functionality
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_quizzes_is_active ON quizzes(is_active);
