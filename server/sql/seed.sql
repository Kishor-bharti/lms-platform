-- =============================================================
-- seed.sql  —  100xlearning LMS Platform
-- Pure SQL: run directly in Supabase SQL editor.
-- Idempotent: safe to execute multiple times.
-- =============================================================

-- This file requires the pgcrypto extension (already in schema.sql)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------
-- 1. ROLES
-- -------------------------------------------------------------
INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'teacher'),
  (3, 'student')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------
-- 2. ADMIN USER  +  USER_ROLES  +  COURSES
--
--    All in one DO block so we can share the admin UUID.
--
--    Password  : Admin@123
--    bcrypt hash (cost=12) — generated with Node.js bcrypt v5:
--      node -e "require('bcrypt').hash('Admin@123',12).then(console.log)"
--
--    The hash below is a valid bcrypt $2b$ hash for 'Admin@123'.
--    Replace it with a freshly generated one if preferred.
-- -------------------------------------------------------------
DO $$
DECLARE
  v_admin_id UUID;
  v_hash     TEXT := '$2b$12$K8GxfAlb7TAGRfzAmMlCW.dVhvHwxXO6yI6cEuiQKaYgr9PVLR0v6';
BEGIN

  -- ── Insert admin user (skip if email already exists) ────────
  INSERT INTO users (
    id,
    email,
    password_hash,
    first_name,
    last_name,
    is_active
  ) VALUES (
    gen_random_uuid(),
    'admin@100xlearning.com',
    v_hash,
    'Super',
    'Admin',
    TRUE
  )
  ON CONFLICT (email) DO NOTHING;

  -- Always fetch by email so we have the UUID in both cases
  SELECT id INTO v_admin_id
  FROM   users
  WHERE  email = 'admin@100xlearning.com';

  -- ── Assign admin role to admin user (self-assigned) ─────────
  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_admin_id, 1, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── Seed courses ─────────────────────────────────────────────
  --    ON CONFLICT on the UNIQUE columns (name OR code) would
  --    need two statements; using a helper approach instead:
  --    insert each row separately so we can target specific conflicts.

  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'SAT', 'SAT',
          'Scholastic Assessment Test preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'ACT', 'ACT',
          'ACT college readiness preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Advanced Placement', 'AP',
          'AP exam preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

END $$;

-- =============================================================
-- VERIFICATION QUERIES  (uncomment and run after seeding)
-- =============================================================

-- SELECT id, name FROM roles ORDER BY id;
-- Expected: 3 rows → 1 admin | 2 teacher | 3 student

-- SELECT email, first_name, last_name, is_active FROM users;
-- Expected: 1 row → admin@100xlearning.com | Super | Admin | true

-- SELECT ur.user_id, r.name AS role
-- FROM   user_roles ur
-- JOIN   roles r ON r.id = ur.role_id;
-- Expected: 1 row → (admin UUID) | admin

-- SELECT name, code FROM courses ORDER BY code;
-- Expected: 3 rows → ACT | ACT | Advanced Placement | AP | SAT | SAT
