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
--  Student 1: alice@100xlearning.com   / Student@123
--  Student 2: bob@100xlearning.com     / Student@123
--
--  Hashes generated with bcrypt cost=12 in Node.js:
--    node -e "require('bcrypt').hash('PASSWORD',12).then(console.log)"
-- -------------------------------------------------------------
DO $$
DECLARE
  v_admin_id   UUID;
  v_teacher_id UUID;
  v_alice_id   UUID;
  v_bob_id     UUID;

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
  VALUES (gen_random_uuid(), 'teacher@100xlearning.com', v_teacher_hash, 'Sarah', 'Mitchell', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_teacher_id FROM users WHERE email = 'teacher@100xlearning.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_teacher_id, 2, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── STUDENT 1 — Alice ────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'alice@100xlearning.com', v_student_hash, 'Alice', 'Johnson', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_alice_id FROM users WHERE email = 'alice@100xlearning.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_alice_id, 3, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── STUDENT 2 — Bob ─────────────────────────────────────────
  INSERT INTO users (id, email, password_hash, first_name, last_name, is_active)
  VALUES (gen_random_uuid(), 'bob@100xlearning.com', v_student_hash, 'Bob', 'Williams', TRUE)
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_bob_id FROM users WHERE email = 'bob@100xlearning.com';

  INSERT INTO user_roles (user_id, role_id, assigned_by)
  VALUES (v_bob_id, 3, v_admin_id)
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
