-- =============================================================
-- seed.sql  —  100xlearning LMS Platform
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
-- 2. USERS + ROLES + COURSES
--
--  Admin    : admin@100xlearning.com   / Admin@123
--  Teacher  : teacher@100xlearning.com / Teacher@123
--  Student 1: kishor@gmail.com   / Student@123
--  Student 2: priya@gmail.com     / Student@123
--
--  Hashes generated with bcrypt cost=12 in Node.js:
--    node -e "require('bcrypt').hash('PASSWORD',12).then(console.log)"
-- -------------------------------------------------------------
DO $$
DECLARE
  v_admin_id   UUID;
  v_harman_id UUID;
  v_kishor_id   UUID;
  v_priya_id     UUID;

  -- bcrypt cost=12 hashes
  v_admin_hash   TEXT := '$2b$12$K8GxfAlb7TAGRfzAmMlCW.dVhvHwxXO6yI6cEuiQKaYgr9PVLR0v6';  -- Admin@123
  v_teacher_hash TEXT := '$2b$12$LVk3OmIzPlE.5Xy1KcVAyuklEiGvD1v8rH3M/Sh4wFqG6zNkX6vJy';  -- Teacher@123
  v_student_hash TEXT := '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWFvhSK';  -- Student@123

BEGIN

  -- ── ADMIN ───────────────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'admin@100xlearning.com', v_admin_hash, 'Super', 'Admin', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_admin_id FROM users WHERE email = 'admin@100xlearning.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_admin_id, 1, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── TEACHER ─────────────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'harman@gmail.com', v_teacher_hash, 'Harmanpreet', 'Singh', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_harman_id FROM users WHERE email = 'harman@gmail.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_harman_id, 2, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── STUDENT 1 — Kishor ────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'kishor@gmail.com', v_student_hash, 'Kishor', 'Bharti', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_kishor_id FROM users WHERE email = 'kishor@gmail.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_kishor_id, 3, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── STUDENT 2 — Priya ─────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'priya@gmail.com', v_student_hash, 'Priya', 'Singh', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_priya_id FROM users WHERE email = 'priya@gmail.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_priya_id, 3, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── COURSES ─────────────────────────────────────────────────
  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'SAT', 'SAT', 'Scholastic Assessment Test preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'ACT', 'ACT', 'ACT college readiness preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO courses (id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), 'Advanced Placement', 'AP', 'AP exam preparation', TRUE, v_admin_id)
  ON CONFLICT (code) DO NOTHING;

END $$;

-- =============================================================
-- VERIFICATION  (uncomment and run after seeding)
-- =============================================================
-- SELECT u.email, u.first_name, r.name AS role
-- FROM   users u
-- JOIN   user_roles ur ON ur.user_id = u.id
-- JOIN   roles r ON r.id = ur.role_id
-- ORDER  BY r.id;
-- Expected: 4 rows — 1 admin, 1 teacher, 2 students
