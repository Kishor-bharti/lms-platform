-- Users (password: 123, bcrypt hashed)
INSERT INTO users (name, email, password_hash, role, status)
VALUES
('Admin User', 'admin@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'ADMIN', 'ACTIVE'),
('Harman', 'harman@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'TEACHER', 'ACTIVE'),
('Kishor', 'kishor@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'STUDENT', 'ACTIVE'),
('Priya', 'priya@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'STUDENT', 'ACTIVE'),
('Rahul', 'rahul@lms.in', '$2b$10$G888FYNKrgWsAp9Q7UtvV.ZsUNaH2TeMf1vmEwQr/gsys5lSaviB6', 'STUDENT', 'ACTIVE');

-- Classes (Harman teaches 3 classes)
INSERT INTO classes (title, subject, teacher_id, start_date, end_date)
SELECT
  'AP Chemistry',
  'Chemistry',
  id,
  '2026-01-15',
  '2026-05-31'
FROM users WHERE role='TEACHER' AND name='Harman';

INSERT INTO classes (title, subject, teacher_id, start_date, end_date)
SELECT
  'IB Chemistry HL',
  'Chemistry',
  id,
  '2026-02-01',
  '2026-06-15'
FROM users WHERE role='TEACHER' AND name='Harman';

INSERT INTO classes (title, subject, teacher_id, start_date, end_date)
SELECT
  'Organic Chemistry',
  'Chemistry',
  id,
  '2026-02-15',
  '2026-07-31'
FROM users WHERE role='TEACHER' AND name='Harman';

-- Enrollments (different enrollment patterns)
-- Kishor: enrolled in AP Chemistry and IB Chemistry HL
INSERT INTO enrollments (class_id, student_id)
SELECT c.id, u.id
FROM classes c, users u
WHERE c.title IN ('AP Chemistry', 'IB Chemistry HL')
  AND u.name = 'Kishor';

-- Priya: enrolled in all three classes
INSERT INTO enrollments (class_id, student_id)
SELECT c.id, u.id
FROM classes c, users u
WHERE c.title IN ('AP Chemistry', 'IB Chemistry HL', 'Organic Chemistry')
  AND u.name = 'Priya';

-- Rahul: enrolled only in Organic Chemistry (exclusive)
INSERT INTO enrollments (class_id, student_id)
SELECT c.id, u.id
FROM classes c, users u
WHERE c.title IN ('Organic Chemistry')
  AND u.name = 'Rahul';

-- Sessions for AP Chemistry (past, today, tomorrow, future)
-- Past sessions (Feb 3-6)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Atomic Structure', 'https://zoom.mock/meeting/apch001', '2026-02-03 16:00:00', 'COMPLETED'
FROM classes WHERE title='AP Chemistry';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Periodic Table', 'https://zoom.mock/meeting/apch002', '2026-02-05 15:30:00', 'COMPLETED'
FROM classes WHERE title='AP Chemistry';

-- Today's sessions (Feb 7)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Bonding Theory', 'https://zoom.mock/meeting/apch003', '2026-02-07 09:00:00', 'SCHEDULED'
FROM classes WHERE title='AP Chemistry';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Problem Solving', 'https://zoom.mock/meeting/apch004', '2026-02-07 17:00:00', 'SCHEDULED'
FROM classes WHERE title='AP Chemistry';

-- Tomorrow's sessions (Feb 8)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Thermodynamics', 'https://zoom.mock/meeting/apch005', '2026-02-08 14:00:00', 'SCHEDULED'
FROM classes WHERE title='AP Chemistry';

-- Future sessions (Feb 10+)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Reaction Rates', 'https://zoom.mock/meeting/apch006', '2026-02-10 16:00:00', 'SCHEDULED'
FROM classes WHERE title='AP Chemistry';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'AP Chemistry - Equilibrium', 'https://zoom.mock/meeting/apch007', '2026-02-14 16:00:00', 'SCHEDULED'
FROM classes WHERE title='AP Chemistry';

-- Sessions for IB Chemistry HL (past, today, tomorrow, future)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'IB Chemistry - Stoichiometry', 'https://zoom.mock/meeting/ibch001', '2026-02-04 10:00:00', 'COMPLETED'
FROM classes WHERE title='IB Chemistry HL';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'IB Chemistry - Energetics', 'https://zoom.mock/meeting/ibch002', '2026-02-07 11:00:00', 'SCHEDULED'
FROM classes WHERE title='IB Chemistry HL';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'IB Chemistry - Kinetics', 'https://zoom.mock/meeting/ibch003', '2026-02-08 15:00:00', 'SCHEDULED'
FROM classes WHERE title='IB Chemistry HL';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'IB Chemistry - Equilibrium', 'https://zoom.mock/meeting/ibch004', '2026-02-12 10:00:00', 'SCHEDULED'
FROM classes WHERE title='IB Chemistry HL';

-- Sessions for Organic Chemistry (future sessions only, new class)
INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'Organic Chemistry - Intro', 'https://zoom.mock/meeting/orgch001', '2026-02-20 13:00:00', 'SCHEDULED'
FROM classes WHERE title='Organic Chemistry';

INSERT INTO sessions (class_id, title, zoom_link, scheduled_at, status)
SELECT id, 'Organic Chemistry - Alkanes', 'https://zoom.mock/meeting/orgch002', '2026-02-27 13:00:00', 'SCHEDULED'
FROM classes WHERE title='Organic Chemistry';
