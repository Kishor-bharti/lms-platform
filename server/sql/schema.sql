-- ============================================================
-- 10xAccel — Canonical Schema
-- Source of truth for a fresh database setup.
-- Last synced: 2026-03-25 (matches local + production state)
-- ============================================================

-- CREATE DATABASE IF NOT EXISTS "100xlearning";

-- Extensions & Setup
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper Function (must be defined before triggers that use it)
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Domain 1 — Identity
-- ============================================================

CREATE TABLE roles (
  id         SMALLINT     PRIMARY KEY,
  name       VARCHAR(20)  NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO roles VALUES (1,'admin'),(2,'teacher'),(3,'student');

CREATE TABLE users (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  phone         VARCHAR(20),
  avatar_url    TEXT,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id     UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     SMALLINT  NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID      NOT NULL REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);


-- ============================================================
-- Domain 2 — Courses
-- ============================================================

CREATE TABLE courses (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE subjects (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID         NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  code        VARCHAR(30)  NOT NULL,
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (course_id, code)
);

CREATE TABLE topics (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  description TEXT,
  order_index SMALLINT     NOT NULL DEFAULT 0,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (subject_id, name)
);
CREATE INDEX idx_topics_subject ON topics(subject_id);
CREATE TRIGGER trg_updated_at_topics
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE subject_teachers (
  subject_id       UUID        NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by      UUID        NOT NULL REFERENCES users(id),
  permission_level VARCHAR(10) NOT NULL DEFAULT 'read' CHECK (permission_level IN ('read', 'write')),
  PRIMARY KEY (subject_id, teacher_id)
);

CREATE TABLE subject_teacher_students (
  subject_id  UUID        NOT NULL REFERENCES subjects(id)  ON DELETE CASCADE,
  teacher_id  UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  student_id  UUID        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID        NOT NULL REFERENCES users(id),
  PRIMARY KEY (subject_id, teacher_id, student_id)
);

CREATE TABLE subject_enrollments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id        UUID        NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_status VARCHAR(20) NOT NULL DEFAULT 'active',
  enrolled_by       UUID        NOT NULL REFERENCES users(id),
  enrolled_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, student_id),
  CHECK (enrollment_status IN ('active','suspended','completed'))
);


-- ============================================================
-- Domain 3 — Content
-- ============================================================

CREATE TABLE quizzes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID          REFERENCES subjects(id) ON DELETE CASCADE,
  course_id        UUID          REFERENCES courses(id) ON DELETE CASCADE,
  topic_id         UUID          REFERENCES topics(id) ON DELETE SET NULL,
  created_by       UUID          NOT NULL REFERENCES users(id),
  title            VARCHAR(255)  NOT NULL,
  quiz_type        VARCHAR(20)   NOT NULL CHECK (quiz_type IN ('test','practice')),
  description      TEXT,
  duration_minutes SMALLINT      NOT NULL,
  passing_score    NUMERIC(5,2),
  is_published     BOOLEAN       NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  available_from   TIMESTAMPTZ,
  available_until  TIMESTAMPTZ,
  max_attempts     SMALLINT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE quiz_sets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID         NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  set_number  SMALLINT     NOT NULL,
  title       VARCHAR(100),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, set_number)
);

CREATE TABLE questions (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id               UUID          NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  set_id                UUID          REFERENCES quiz_sets(id) ON DELETE CASCADE,
  topic_id              UUID          REFERENCES topics(id) ON DELETE SET NULL,
  question_text         TEXT          NOT NULL,
  image_url             TEXT,
  explanation           TEXT,
  explanation_image_url TEXT,
  difficulty            VARCHAR(10)   NOT NULL DEFAULT 'medium',
  order_index           SMALLINT      NOT NULL DEFAULT 0,
  marks                 NUMERIC(4,2)  NOT NULL DEFAULT 1.00,
  is_active             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by            UUID          NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CHECK (difficulty IN ('easy','medium','hard'))
);

CREATE TABLE options (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      UUID    NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  option_label     CHAR(1) NOT NULL CHECK (option_label IN ('A','B','C','D')),
  option_text      TEXT,
  option_image_url TEXT,
  is_correct       BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (question_id, option_label)
);

CREATE TABLE quiz_write_permissions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id    UUID        NOT NULL REFERENCES quizzes(id)  ON DELETE CASCADE,
  teacher_id UUID        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  granted_by UUID        NOT NULL REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, teacher_id)
);


-- ============================================================
-- Domain 4 — Activity
-- ============================================================

CREATE TABLE quiz_attempts (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id             UUID         NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  set_id              UUID         REFERENCES quiz_sets(id),
  student_id          UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number      SMALLINT     NOT NULL DEFAULT 1,
  status              VARCHAR(20)  NOT NULL DEFAULT 'in_progress',
  started_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  submitted_at        TIMESTAMPTZ,
  time_taken_seconds  INTEGER,
  marks_obtained      NUMERIC(7,2),
  total_marks         NUMERIC(7,2),
  score_pct           NUMERIC(5,2),
  is_passed           BOOLEAN,
  ip_address          INET,
  last_question_index INTEGER      NOT NULL DEFAULT 0,
  UNIQUE (quiz_id, student_id, attempt_number),
  CHECK (status IN ('in_progress','partial','submitted','timed_out','abandoned'))
);

CREATE TABLE attempt_answers (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id         UUID         NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id        UUID         NOT NULL REFERENCES questions(id),
  selected_option_id UUID         REFERENCES options(id),
  is_correct         BOOLEAN,
  marks_awarded      NUMERIC(4,2),
  time_spent_seconds INTEGER,
  answered_at        TIMESTAMPTZ,
  UNIQUE (attempt_id, question_id)
);

CREATE TABLE assignments (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id     UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id       UUID         REFERENCES topics(id) ON DELETE SET NULL,
  created_by     UUID         NOT NULL REFERENCES users(id),
  title          VARCHAR(255) NOT NULL,
  description    TEXT,
  due_date       TIMESTAMPTZ,
  duration_days  INTEGER,
  max_marks      NUMERIC(6,2) NOT NULL DEFAULT 100,
  is_published   BOOLEAN      NOT NULL DEFAULT FALSE,
  attachment_url TEXT,
  assigned_to    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE assignment_submissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID        NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_url  TEXT,
  notes           TEXT,
  submitted_at    TIMESTAMPTZ,
  is_late         BOOLEAN     NOT NULL DEFAULT FALSE,
  marks_awarded   NUMERIC(6,2),
  feedback        TEXT,
  feedback_file_url TEXT,
  graded_by       UUID        REFERENCES users(id),
  graded_at       TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  UNIQUE (assignment_id, student_id),
  CHECK (status IN ('pending','submitted','graded','returned'))
);

CREATE TABLE student_progress (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id            UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  quizzes_attempted     INTEGER      NOT NULL DEFAULT 0,
  quizzes_passed        INTEGER      NOT NULL DEFAULT 0,
  avg_score_pct         NUMERIC(5,2),
  best_score_pct        NUMERIC(5,2),
  total_time_spent_mins INTEGER      NOT NULL DEFAULT 0,
  assignments_submitted INTEGER      NOT NULL DEFAULT 0,
  assignments_graded    INTEGER      NOT NULL DEFAULT 0,
  avg_assignment_marks  NUMERIC(6,2),
  sessions_attended     INTEGER      NOT NULL DEFAULT 0,
  last_activity_at      TIMESTAMPTZ,
  computed_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id)
);


-- ============================================================
-- Domain 5 — Delivery
-- ============================================================

CREATE TABLE session_recurrence (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern          VARCHAR(20) NOT NULL CHECK (pattern IN ('daily','weekly','monthly')),
  interval_value   SMALLINT    NOT NULL DEFAULT 1,
  days_of_week     SMALLINT[],
  recur_until      DATE,
  max_occurrences  SMALLINT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id       UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id         UUID         REFERENCES topics(id) ON DELETE SET NULL,
  teacher_id       UUID         NOT NULL REFERENCES users(id),
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  session_date     DATE         NOT NULL,
  start_time       TIMETZ       NOT NULL,
  end_time         TIMETZ       NOT NULL,
  timezone         VARCHAR(50)  NOT NULL DEFAULT 'Asia/Kolkata',
  meeting_link     TEXT,
  meeting_password VARCHAR(100),
  zoom_meeting_id  VARCHAR(100),
  zoom_start_url   TEXT,
  zoom_host_email  VARCHAR(255),
  recording_url    TEXT,
  status           VARCHAR(20)  NOT NULL DEFAULT 'scheduled',
  is_recurring     BOOLEAN      NOT NULL DEFAULT FALSE,
  recurrence_id    UUID         REFERENCES session_recurrence(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  CHECK (status IN ('scheduled','live','completed','cancelled','missed'))
);

CREATE TABLE subject_materials (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id    UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id      UUID         REFERENCES topics(id) ON DELETE SET NULL,
  uploaded_by   UUID         NOT NULL REFERENCES users(id),
  title         VARCHAR(255) NOT NULL,
  description   TEXT,
  material_type VARCHAR(20)  NOT NULL,
  file_url      TEXT         NOT NULL,
  file_size_kb  INTEGER,
  order_index   SMALLINT     NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_published  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (material_type IN ('pdf','video','link','doc','image'))
);

CREATE TABLE session_students (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (session_id, student_id)
);

CREATE TABLE student_content_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID        REFERENCES subjects(id) ON DELETE CASCADE,
  course_id    UUID        REFERENCES courses(id)  ON DELETE CASCADE,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('quiz', 'assignment', 'material')),
  content_id   UUID        NOT NULL,
  student_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by  UUID        NOT NULL REFERENCES users(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date     TIMESTAMPTZ,
  UNIQUE (content_type, content_id, student_id)
);


-- ============================================================
-- Indexes
-- ============================================================

-- Exactly one correct answer per question — enforced at DB level
CREATE UNIQUE INDEX idx_one_correct_per_question
  ON options(question_id) WHERE is_correct = TRUE;

-- Identity
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Course & Enrollment
CREATE INDEX idx_subject_teachers_teacher  ON subject_teachers(teacher_id);
CREATE INDEX idx_subject_teachers_subject  ON subject_teachers(subject_id);
CREATE INDEX idx_enrollments_student       ON subject_enrollments(student_id);
CREATE INDEX idx_enrollments_subject       ON subject_enrollments(subject_id);
CREATE INDEX idx_enrollments_status        ON subject_enrollments(enrollment_status);
CREATE INDEX idx_sts_subject_teacher       ON subject_teacher_students(subject_id, teacher_id);
CREATE INDEX idx_sts_student               ON subject_teacher_students(student_id);

-- Content
CREATE INDEX idx_quizzes_subject     ON quizzes(subject_id);
CREATE INDEX idx_quizzes_type        ON quizzes(quiz_type);
CREATE INDEX idx_quizzes_published   ON quizzes(is_published, available_from, available_until);
CREATE INDEX idx_quizzes_is_active   ON quizzes(is_active);
CREATE INDEX idx_questions_quiz      ON questions(quiz_id);
CREATE INDEX idx_questions_set       ON questions(set_id);
CREATE INDEX idx_questions_topic     ON questions(topic_id);
CREATE INDEX idx_options_question    ON options(question_id);
CREATE INDEX idx_qwp_quiz_id         ON quiz_write_permissions(quiz_id);
CREATE INDEX idx_qwp_teacher_id      ON quiz_write_permissions(teacher_id);

-- Activity
CREATE INDEX idx_attempts_student       ON quiz_attempts(student_id);
CREATE INDEX idx_attempts_quiz          ON quiz_attempts(quiz_id);
CREATE INDEX idx_attempts_status        ON quiz_attempts(status);
CREATE INDEX idx_attempts_started       ON quiz_attempts(started_at);
CREATE INDEX idx_answers_attempt        ON attempt_answers(attempt_id);
CREATE INDEX idx_assignments_subject    ON assignments(subject_id);
CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student    ON assignment_submissions(student_id);
CREATE INDEX idx_progress_student       ON student_progress(student_id);
CREATE INDEX idx_progress_subject       ON student_progress(subject_id);

-- Sessions & Materials
CREATE INDEX idx_sessions_subject  ON sessions(subject_id);
CREATE INDEX idx_sessions_date     ON sessions(session_date);
CREATE INDEX idx_sessions_teacher  ON sessions(teacher_id, session_date, status);
CREATE INDEX idx_sessions_status   ON sessions(status);
CREATE INDEX idx_sessions_zoom_id  ON sessions(zoom_meeting_id);
CREATE INDEX idx_materials_subject ON subject_materials(subject_id, order_index);

-- Content assignments
CREATE INDEX idx_sca_student  ON student_content_assignments(student_id);
CREATE INDEX idx_sca_content  ON student_content_assignments(content_type, content_id);
CREATE INDEX idx_sca_subject  ON student_content_assignments(subject_id);
CREATE INDEX idx_sca_course   ON student_content_assignments(course_id);
CREATE INDEX idx_sca_assigner ON student_content_assignments(assigned_by);


-- ============================================================
-- Triggers — updated_at
-- ============================================================

CREATE TRIGGER trg_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_courses
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_subjects
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_quizzes
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_questions
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_sessions
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_assignments
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_updated_at_subject_materials
  BEFORE UPDATE ON subject_materials
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- Triggers — Authorization
-- ============================================================

-- Quiz: only assigned teachers (or admins) can create quizzes for a subject.
-- Course-level quizzes (subject_id IS NULL) skip the subject assignment check.
CREATE OR REPLACE FUNCTION fn_quiz_teacher_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Admins bypass all checks
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.created_by AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  -- Course-level quizzes don't belong to a subject — skip subject check
  IF NEW.course_id IS NOT NULL AND NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Subject-level: teacher must be assigned to the subject
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.created_by) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quiz_teacher_check
  BEFORE INSERT ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_quiz_teacher_check();

-- Session: only assigned teachers (or admins) can create sessions for a subject.
CREATE OR REPLACE FUNCTION fn_session_teacher_check()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.teacher_id AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.teacher_id) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_session_teacher_check
  BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_session_teacher_check();


-- ============================================================
-- Views
-- ============================================================

CREATE VIEW v_session_dashboard AS
SELECT
  s.id, s.title, s.session_date, s.start_time, s.end_time,
  s.meeting_link, s.meeting_password, s.recording_url, s.status,
  s.zoom_meeting_id, s.timezone, s.is_recurring,
  CASE
    WHEN s.status = 'live'                                  THEN 'live'
    WHEN s.session_date = CURRENT_DATE
         AND s.status = 'scheduled'                         THEN 'today'
    WHEN s.session_date = CURRENT_DATE + 1
         AND s.status = 'scheduled'                         THEN 'tomorrow'
    WHEN s.session_date > CURRENT_DATE + 1                  THEN 'scheduled'
    ELSE s.status
  END AS display_status,
  sub.name  AS subject_name,
  sub.code  AS subject_code,
  c.name    AS course_name,
  c.code    AS course_code,
  t.first_name || ' ' || t.last_name AS teacher_name,
  t.email   AS teacher_email,
  sr.pattern, sr.days_of_week, sr.recur_until
FROM sessions s
JOIN subjects sub            ON sub.id = s.subject_id
JOIN courses  c              ON c.id   = sub.course_id
JOIN users    t              ON t.id   = s.teacher_id
LEFT JOIN session_recurrence sr ON sr.id = s.recurrence_id;

CREATE VIEW v_student_report AS
SELECT
  sp.*,
  u.first_name || ' ' || u.last_name AS student_name,
  u.email AS student_email,
  sub.name AS subject_name,
  sub.code AS subject_code,
  c.name   AS course_name,
  c.code   AS course_code
FROM student_progress sp
JOIN users    u   ON u.id   = sp.student_id
JOIN subjects sub ON sub.id = sp.subject_id
JOIN courses  c   ON c.id   = sub.course_id;

CREATE VIEW v_subject_resources AS
SELECT
  sub.id AS subject_id,
  sub.name AS subject_name,
  c.name AS course_name,
  COUNT(DISTINCT CASE WHEN q.quiz_type='test'     THEN q.id END) AS test_quizzes,
  COUNT(DISTINCT CASE WHEN q.quiz_type='practice' THEN q.id END) AS practice_quizzes,
  COUNT(DISTINCT a.id)  AS total_assignments,
  COUNT(DISTINCT sm.id) AS total_materials
FROM subjects sub
JOIN courses  c   ON c.id   = sub.course_id
LEFT JOIN quizzes          q  ON q.subject_id  = sub.id AND q.is_published = TRUE
LEFT JOIN assignments       a  ON a.subject_id  = sub.id AND a.is_published = TRUE
LEFT JOIN subject_materials sm ON sm.subject_id = sub.id AND sm.is_active    = TRUE
GROUP BY sub.id, sub.name, c.name;

CREATE VIEW v_teacher_dashboard AS
SELECT
  st.teacher_id,
  t.first_name || ' ' || t.last_name AS teacher_name,
  sub.id   AS subject_id,
  sub.name AS subject_name,
  c.name   AS course_name,
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.enrollment_status='active') AS enrolled_students,
  COUNT(DISTINCT q.id)          AS total_quizzes,
  COUNT(DISTINCT a.id)          AS total_assignments
FROM subject_teachers st
JOIN users    t   ON t.id   = st.teacher_id
JOIN subjects sub ON sub.id = st.subject_id
JOIN courses  c   ON c.id   = sub.course_id
LEFT JOIN subject_enrollments se ON se.subject_id = sub.id
LEFT JOIN quizzes             q  ON q.subject_id  = sub.id
LEFT JOIN assignments          a  ON a.subject_id  = sub.id
GROUP BY st.teacher_id, t.first_name, t.last_name, sub.id, sub.name, c.name;


-- ============================================================
-- Scheduled Jobs (pg_cron) — for later
-- ============================================================

-- SELECT cron.schedule(
--   'auto-complete-sessions',
--   '*/5 * * * *',
--   $$
--     UPDATE sessions
--     SET    status = 'completed',
--            updated_at = now()
--     WHERE  status = 'live'
--     AND    (session_date + end_time) < now();
--   $$
-- );

-- SELECT cron.schedule(
--   'refresh-student-progress',
--   '*/15 * * * *',
--   $$
--     INSERT INTO student_progress (
--       student_id, subject_id,
--       quizzes_attempted, quizzes_passed,
--       avg_score_pct, best_score_pct,
--       total_time_spent_mins, computed_at
--     )
--     SELECT
--       qa.student_id,
--       q.subject_id,
--       COUNT(*)                             AS quizzes_attempted,
--       COUNT(*) FILTER (WHERE qa.is_passed) AS quizzes_passed,
--       AVG(qa.score_pct)                    AS avg_score_pct,
--       MAX(qa.score_pct)                    AS best_score_pct,
--       COALESCE(SUM(qa.time_taken_seconds)/60,0) AS total_time_spent_mins,
--       now()
--     FROM quiz_attempts qa
--     JOIN quizzes q ON q.id = qa.quiz_id
--     WHERE qa.status = 'submitted'
--     GROUP BY qa.student_id, q.subject_id
--     ON CONFLICT (student_id, subject_id) DO UPDATE SET
--       quizzes_attempted     = EXCLUDED.quizzes_attempted,
--       quizzes_passed        = EXCLUDED.quizzes_passed,
--       avg_score_pct         = EXCLUDED.avg_score_pct,
--       best_score_pct        = EXCLUDED.best_score_pct,
--       total_time_spent_mins = EXCLUDED.total_time_spent_mins,
--       computed_at           = EXCLUDED.computed_at;
--   $$
-- );
