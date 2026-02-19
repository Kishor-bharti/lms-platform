-- =============================================================
-- seed_sessions.sql  —  100xlearning LMS Platform
-- Phase 1: Subjects, Teacher Assignments, Student Enrollments, Sessions
--
-- Run AFTER seed.sql (needs admin, harman, kishor, priya users + SAT/ACT/AP courses)
-- Command: psql -U postgres -d "100xlearning" -f sql/seed_sessions.sql
--
-- Idempotent: safe to run multiple times.
-- =============================================================

DO $$
DECLARE
  -- User IDs (fetched by email)
  v_admin_id   UUID;
  v_harman_id  UUID;
  v_kishor_id  UUID;
  v_priya_id   UUID;

  -- Course IDs
  v_sat_id     UUID;
  v_act_id     UUID;
  v_ap_id      UUID;

  -- Subject IDs
  v_sat_math_id     UUID;
  v_sat_reading_id  UUID;
  v_sat_writing_id  UUID;
  v_ap_chem_id      UUID;
  v_act_english_id  UUID;

BEGIN

  -- ── Fetch existing user IDs ────────────────────────────────
  SELECT id INTO v_admin_id   FROM users WHERE email = 'admin@100xlearning.com';
  SELECT id INTO v_harman_id  FROM users WHERE email = 'harman@gmail.com';
  SELECT id INTO v_kishor_id  FROM users WHERE email = 'kishor@gmail.com';
  SELECT id INTO v_priya_id   FROM users WHERE email = 'priya@gmail.com';

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found. Run seed.sql first.';
  END IF;
  IF v_harman_id IS NULL THEN
    RAISE EXCEPTION 'Teacher (harman@gmail.com) not found. Run seed.sql first.';
  END IF;

  -- ── Fetch course IDs ────────────────────────────────────────
  SELECT id INTO v_sat_id FROM courses WHERE code = 'SAT';
  SELECT id INTO v_act_id FROM courses WHERE code = 'ACT';
  SELECT id INTO v_ap_id  FROM courses WHERE code = 'AP';

  IF v_sat_id IS NULL THEN
    RAISE EXCEPTION 'SAT course not found. Run seed.sql first.';
  END IF;

  -- ── SUBJECTS ────────────────────────────────────────────────

  -- SAT Math
  INSERT INTO subjects (id, course_id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), v_sat_id, 'SAT Math', 'SAT-MATH',
          'Algebra, problem solving, data analysis and advanced math', TRUE, v_admin_id)
  ON CONFLICT (course_id, code) DO NOTHING;

  SELECT id INTO v_sat_math_id FROM subjects WHERE code = 'SAT-MATH' AND course_id = v_sat_id;

  -- SAT Reading & Writing
  INSERT INTO subjects (id, course_id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), v_sat_id, 'SAT Reading', 'SAT-READ',
          'Reading comprehension and evidence-based analysis', TRUE, v_admin_id)
  ON CONFLICT (course_id, code) DO NOTHING;

  SELECT id INTO v_sat_reading_id FROM subjects WHERE code = 'SAT-READ' AND course_id = v_sat_id;

  INSERT INTO subjects (id, course_id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), v_sat_id, 'SAT Writing', 'SAT-WRITE',
          'Grammar, usage and rhetorical skills', TRUE, v_admin_id)
  ON CONFLICT (course_id, code) DO NOTHING;

  SELECT id INTO v_sat_writing_id FROM subjects WHERE code = 'SAT-WRITE' AND course_id = v_sat_id;

  -- AP Chemistry
  INSERT INTO subjects (id, course_id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), v_ap_id, 'AP Chemistry', 'AP-CHEM',
          'Advanced chemistry covering atomic structure, bonding and reactions', TRUE, v_admin_id)
  ON CONFLICT (course_id, code) DO NOTHING;

  SELECT id INTO v_ap_chem_id FROM subjects WHERE code = 'AP-CHEM' AND course_id = v_ap_id;

  -- ACT English
  INSERT INTO subjects (id, course_id, name, code, description, is_active, created_by)
  VALUES (gen_random_uuid(), v_act_id, 'ACT English', 'ACT-ENG',
          'English grammar and usage for the ACT exam', TRUE, v_admin_id)
  ON CONFLICT (course_id, code) DO NOTHING;

  SELECT id INTO v_act_english_id FROM subjects WHERE code = 'ACT-ENG' AND course_id = v_act_id;

  -- ── TEACHER ASSIGNMENTS (Harman teaches SAT Math, SAT Reading, AP Chem) ──

  INSERT INTO subject_teachers (subject_id, teacher_id, assigned_by)
  VALUES (v_sat_math_id,    v_harman_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO subject_teachers (subject_id, teacher_id, assigned_by)
  VALUES (v_sat_reading_id, v_harman_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO subject_teachers (subject_id, teacher_id, assigned_by)
  VALUES (v_ap_chem_id,     v_harman_id, v_admin_id)
  ON CONFLICT DO NOTHING;

  -- ── STUDENT ENROLLMENTS ─────────────────────────────────────

  -- Kishor enrolled in SAT Math + SAT Reading
  INSERT INTO subject_enrollments (id, subject_id, student_id, enrollment_status, enrolled_by)
  VALUES (gen_random_uuid(), v_sat_math_id,    v_kishor_id, 'active', v_admin_id)
  ON CONFLICT (subject_id, student_id) DO NOTHING;

  INSERT INTO subject_enrollments (id, subject_id, student_id, enrollment_status, enrolled_by)
  VALUES (gen_random_uuid(), v_sat_reading_id, v_kishor_id, 'active', v_admin_id)
  ON CONFLICT (subject_id, student_id) DO NOTHING;

  -- Priya enrolled in SAT Math + AP Chemistry
  INSERT INTO subject_enrollments (id, subject_id, student_id, enrollment_status, enrolled_by)
  VALUES (gen_random_uuid(), v_sat_math_id, v_priya_id, 'active', v_admin_id)
  ON CONFLICT (subject_id, student_id) DO NOTHING;

  INSERT INTO subject_enrollments (id, subject_id, student_id, enrollment_status, enrolled_by)
  VALUES (gen_random_uuid(), v_ap_chem_id, v_priya_id, 'active', v_admin_id)
  ON CONFLICT (subject_id, student_id) DO NOTHING;

  -- ── SESSIONS ────────────────────────────────────────────────
  -- Mix of statuses: completed, scheduled, today (adjust dates as needed)
  -- Note: session_date is DATE, start_time/end_time are TIMETZ

  -- Session 1: SAT Math - Algebra Basics (COMPLETED, past date)
  INSERT INTO sessions (
    id, subject_id, teacher_id, title, description,
    session_date, start_time, end_time, timezone, status
  )
  SELECT
    gen_random_uuid(), v_sat_math_id, v_harman_id,
    'Algebra Basics', 'Introduction to algebraic expressions and equations',
    CURRENT_DATE - INTERVAL '7 days',
    '18:30:00+05:30', '20:00:00+05:30', 'Asia/Kolkata', 'completed'
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions WHERE title = 'Algebra Basics' AND subject_id = v_sat_math_id
  );

  -- Session 2: SAT Math - Quadratic Equations (COMPLETED, 3 days ago)
  INSERT INTO sessions (
    id, subject_id, teacher_id, title, description,
    session_date, start_time, end_time, timezone, status
  )
  SELECT
    gen_random_uuid(), v_sat_math_id, v_harman_id,
    'Quadratic Equations', 'Solving quadratic equations and word problems',
    CURRENT_DATE - INTERVAL '3 days',
    '18:30:00+05:30', '20:00:00+05:30', 'Asia/Kolkata', 'completed'
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions WHERE title = 'Quadratic Equations' AND subject_id = v_sat_math_id
  );

  -- Session 3: SAT Reading - Evidence Analysis (SCHEDULED, 2 days from now)
  INSERT INTO sessions (
    id, subject_id, teacher_id, title, description,
    session_date, start_time, end_time, timezone, status
  )
  SELECT
    gen_random_uuid(), v_sat_reading_id, v_harman_id,
    'Evidence-Based Reading', 'Strategies for evidence-based reading questions',
    CURRENT_DATE + INTERVAL '2 days',
    '16:00:00+05:30', '17:30:00+05:30', 'Asia/Kolkata', 'scheduled'
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions WHERE title = 'Evidence-Based Reading' AND subject_id = v_sat_reading_id
  );

  -- Session 4: AP Chemistry - Atomic Structure (SCHEDULED, 5 days from now)
  INSERT INTO sessions (
    id, subject_id, teacher_id, title, description,
    session_date, start_time, end_time, timezone, status
  )
  SELECT
    gen_random_uuid(), v_ap_chem_id, v_harman_id,
    'Atomic Structure', 'Electrons, protons, neutrons and the periodic table',
    CURRENT_DATE + INTERVAL '5 days',
    '09:30:00+05:30', '11:00:00+05:30', 'Asia/Kolkata', 'scheduled'
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions WHERE title = 'Atomic Structure' AND subject_id = v_ap_chem_id
  );

  -- Session 5: SAT Math - TODAY's session (status = 'scheduled', date = today → UI shows TODAY)
  INSERT INTO sessions (
    id, subject_id, teacher_id, title, description,
    session_date, start_time, end_time, timezone, status
  )
  SELECT
    gen_random_uuid(), v_sat_math_id, v_harman_id,
    'Data Analysis & Statistics', 'Statistics, probability and data interpretation',
    CURRENT_DATE,
    '19:00:00+05:30', '20:30:00+05:30', 'Asia/Kolkata', 'scheduled'
  WHERE NOT EXISTS (
    SELECT 1 FROM sessions WHERE title = 'Data Analysis & Statistics' AND subject_id = v_sat_math_id
  );

END $$;

-- =============================================================
-- VERIFICATION QUERIES (uncomment to check)
-- =============================================================

-- Check subjects created:
-- SELECT s.name, s.code, c.name AS course FROM subjects s JOIN courses c ON c.id = s.course_id ORDER BY c.name, s.name;

-- Check teacher assignments:
-- SELECT u.first_name, sub.name AS subject FROM subject_teachers st JOIN users u ON u.id = st.teacher_id JOIN subjects sub ON sub.id = st.subject_id;

-- Check student enrollments:
-- SELECT u.first_name, sub.name AS subject FROM subject_enrollments se JOIN users u ON u.id = se.student_id JOIN subjects sub ON sub.id = se.subject_id;

-- Check sessions:
-- SELECT s.title, sub.name AS subject, s.session_date, s.status FROM sessions s JOIN subjects sub ON sub.id = s.subject_id ORDER BY s.session_date;
