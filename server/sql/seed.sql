-- Users (password: 123, bcrypt hashed)
INSERT INTO users (name, email, password_hash, role, status)
VALUES
('Admin User', 'admin@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'ADMIN', 'ACTIVE'),
('Harman', 'harman@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'TEACHER', 'ACTIVE'),
('Kishor Bharti', 'kishor@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'STUDENT', 'ACTIVE');


-- Classes (using user IDs from previous insert)
INSERT INTO classes (title, subject, teacher_id, start_date, end_date)
SELECT
  'AP Chemistry',
  'Chemistry',
  id,
  '2026-01-01',
  '2026-03-31'
FROM users WHERE role='TEACHER';

INSERT INTO classes (title, subject, teacher_id, start_date, end_date)
SELECT
  'IB Chemistry HL',
  'Chemistry',
  id,
  '2026-02-01',
  '2026-04-30'
FROM users WHERE role='TEACHER';

-- Enrollments
INSERT INTO enrollments (class_id, student_id)
SELECT
  c.id,
  u.id
FROM classes c, users u
WHERE u.role='STUDENT';

-- Sessions
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT
  id,
  'AP Chemistry - Session 1',
  'https://zoom.mock/meeting/' || id,
  '2026-01-21 16:00:00',
  'SCHEDULED'
FROM classes
WHERE title='AP Chemistry';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT
  id,
  'IB Chemistry HL - Session 1',
  'https://zoom.mock/meeting/' || id,
  '2026-02-02 18:00:00',
  'SCHEDULED'
FROM classes
WHERE title='IB Chemistry HL';
