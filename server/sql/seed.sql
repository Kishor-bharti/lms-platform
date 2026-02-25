-- =============================================================
-- seed.sql  —  10xlearning LMS Platform
-- Fresh start with single admin account only
-- Idempotent: safe to run multiple times.
-- =============================================================

-- -------------------------------------------------------------
-- 1. ROLES
-- -------------------------------------------------------------
INSERT INTO roles (id, name) VALUES
  (1, 'admin'),
  (2, 'teacher'),
  (3, 'student')
ON CONFLICT DO NOTHING;

-- -------------------------------------------------------------
-- 2. SINGLE ADMIN USER
--
--  Admin: admin@10xlearning.com / Admin@#7684
--
--  Hash generated with bcrypt cost=12 in Node.js:
--    node -e "require('bcrypt').hash('Admin@#7684',12).then(console.log)"
-- -------------------------------------------------------------
DO $$
DECLARE
  v_admin_id UUID;
  -- bcrypt cost=12 hash for Admin@#7684
  v_admin_hash TEXT := '$2b$12$LHMomg9rR.mpDFMdP50wYe4iTmrP4lPb4SezDgFuncYjHHeoZqH8G';

BEGIN

  -- ── ADMIN ───────────────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'admin@10xlearning.com', v_admin_hash, 'Super', 'Admin', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_admin_id FROM users WHERE email = 'admin@10xlearning.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_admin_id, 1, v_admin_id)
  ON CONFLICT DO NOTHING;

END $$;

-- =============================================================
-- VERIFICATION  (uncomment and run after seeding)
-- =============================================================
-- SELECT u.email, u.first_name, r.name AS role
-- FROM   users u
-- JOIN   user_roles ur ON ur.user_id = u.id
-- JOIN   roles r ON r.id = ur.role_id
-- ORDER  BY r.id;
-- Expected: 1 row — 1 admin only
