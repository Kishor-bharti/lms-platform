-- ============================================================
-- Migration: Super Admin flag + User description
-- Date: 2026-03-31
-- ============================================================

-- 1. Add is_super_admin flag to users table
--    Only ONE user should have this set to TRUE (the seeded admin)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add description column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

-- 3. Mark the original seeded admin as super admin
UPDATE users SET is_super_admin = TRUE WHERE email = 'admin@10xaccel.com';

-- 4. Ensure only one super admin can exist (database-level enforcement)
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_super_admin
  ON users (is_super_admin) WHERE is_super_admin = TRUE;
