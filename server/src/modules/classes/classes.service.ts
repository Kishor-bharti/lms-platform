// classes.service.ts — fully rewritten for v2.1 schema
// Tables used: subjects, courses, subject_teachers, subject_enrollments,
//              sessions, users
// NO old table references (classes, enrollments) remain.

import { query, queryWithClient, withTransaction } from '../../config/db';
import { createZoomMeeting, getZoomAccessToken } from '../../services/zoom.service';
import { ClassWithTeacher, SessionWithDetails } from './classes.types';

// ─── Status calculator ─────────────────────────────────────────
// DB stores lowercase: 'scheduled' | 'live' | 'completed' | 'cancelled'
// Frontend expects uppercase: 'SCHEDULED' | 'LIVE' | 'TODAY' | 'TOMORROW' | 'COMPLETED'

function calculateSessionStatus(
  session_date: string,    // e.g. "2026-02-20"
  start_time: string,      // e.g. "18:30:00+05:30"
  dbStatus: string,
  now: Date = new Date()
): string {
  // Explicit DB states always win
  if (dbStatus === 'live') return 'LIVE';
  if (dbStatus === 'completed' || dbStatus === 'cancelled') return 'COMPLETED';

  // At this point dbStatus is 'scheduled' — teacher has NOT started or ended it.
  // We only show COMPLETED if the session day has fully passed (i.e. a past date).
  // If it's today — even if the start_time has passed — the teacher can still start it.

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const afterTomorrow = new Date(tomorrowStart);
  afterTomorrow.setDate(afterTomorrow.getDate() + 1);

  const sessionDay = new Date(session_date + 'T00:00:00');

  // Past date (before today) and never started → mark as completed
  if (sessionDay < todayStart) return 'COMPLETED';

  // Today — regardless of whether start_time has passed
  if (sessionDay >= todayStart && sessionDay < tomorrowStart) return 'TODAY';

  // Tomorrow
  if (sessionDay >= tomorrowStart && sessionDay < afterTomorrow) return 'TOMORROW';

  return 'SCHEDULED';
}

// Build ISO scheduled_at string from DATE + TIMETZ columns
function buildScheduledAt(session_date: string, start_time: string): string {
  const timeStr = start_time.replace(/[+-]\d{2}:\d{2}$/, '');
  return `${session_date}T${timeStr}`;
}

// ─── TEACHER: subjects assigned via subject_teachers ───────────

export async function getTeacherSubjects(teacherId: string): Promise<ClassWithTeacher[]> {
  const rows = await query<any>(
    `SELECT
       sub.id,
       sub.name,
       sub.code,
       sub.description,
       c.name  AS course_name,
       c.code  AS course_code,
       u.first_name || ' ' || u.last_name AS teacher_name
     FROM   subjects sub
     JOIN   courses          c  ON c.id  = sub.course_id
     JOIN   subject_teachers st ON st.subject_id = sub.id
     JOIN   users            u  ON u.id  = st.teacher_id
     WHERE  st.teacher_id = $1
       AND  sub.is_active  = true
     ORDER  BY c.name, sub.name`,
    [teacherId]
  );

  return rows.map((r) => ({
    id:          r.id,
    title:       r.name,
    code:        r.code,
    description: r.description,
    course_name: r.course_name,
    course_code: r.course_code,
    teacher_name: r.teacher_name,
  }));
}

// ─── STUDENT: subjects enrolled via subject_enrollments ────────

export async function getEnrolledSubjects(studentId: string): Promise<ClassWithTeacher[]> {
  const rows = await query<any>(
    `SELECT
       sub.id,
       sub.name,
       sub.code,
       sub.description,
       c.name  AS course_name,
       c.code  AS course_code,
       u.first_name || ' ' || u.last_name AS teacher_name
     FROM   subjects sub
     JOIN   courses             c  ON c.id  = sub.course_id
     JOIN   subject_enrollments se ON se.subject_id = sub.id
     JOIN   subject_teachers    st ON st.subject_id = sub.id
     JOIN   users               u  ON u.id  = st.teacher_id
     WHERE  se.student_id       = $1
       AND  se.enrollment_status = 'active'
       AND  sub.is_active        = true
     ORDER  BY c.name, sub.name`,
    [studentId]
  );

  return rows.map((r) => ({
    id:          r.id,
    title:       r.name,
    code:        r.code,
    description: r.description,
    course_name: r.course_name,
    course_code: r.course_code,
    teacher_name: r.teacher_name,
  }));
}

// ─── ADMIN: all active subjects ────────────────────────────────

export async function getAllSubjects(): Promise<ClassWithTeacher[]> {
  const rows = await query<any>(
    `SELECT
       sub.id,
       sub.name,
       sub.code,
       sub.description,
       c.name  AS course_name,
       c.code  AS course_code,
       COALESCE(u.first_name || ' ' || u.last_name, 'Unassigned') AS teacher_name
     FROM   subjects sub
     JOIN   courses          c   ON c.id  = sub.course_id
     LEFT   JOIN subject_teachers st  ON st.subject_id = sub.id
     LEFT   JOIN users            u   ON u.id  = st.teacher_id
     WHERE  sub.is_active = true
     ORDER  BY c.name, sub.name`
  );

  return rows.map((r) => ({
    id:          r.id,
    title:       r.name,
    code:        r.code,
    description: r.description,
    course_name: r.course_name,
    course_code: r.course_code,
    teacher_name: r.teacher_name,
  }));
}

// ─── Dispatcher: my-classes-v2 ─────────────────────────────────

export async function getMyClasses(
  userId: string,
  role: string
): Promise<ClassWithTeacher[]> {
  if (role === 'teacher') return getTeacherSubjects(userId);
  if (role === 'student') return getEnrolledSubjects(userId);
  if (role === 'admin')   return getAllSubjects();
  return [];
}

// ─── TEACHER: sessions for subjects they teach ─────────────────

export async function getSessionsByTeacher(
  teacherId: string
): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       t.name         AS topic_name,
       sub.name       AS class_title,
       s.title,
       s.meeting_link,
       s.zoom_start_url,
       s.zoom_meeting_id,
       s.session_date::text  AS session_date,
       s.start_time::text    AS start_time,
       s.status
     FROM   sessions         s
     JOIN   subjects         sub ON sub.id = s.subject_id
     JOIN   subject_teachers st  ON st.subject_id = sub.id
     LEFT JOIN topics        t   ON t.id = s.topic_id
     WHERE  st.teacher_id = $1
     ORDER  BY s.session_date DESC, s.start_time DESC
     LIMIT  100`,
    [teacherId]
  );

  const now = new Date();
  return rows.map((r) => ({
    id:             r.id,
    subject_id:     r.subject_id,
    topic_id:       r.topic_id ?? undefined,
    topic_name:     r.topic_name ?? undefined,
    class_title:    r.class_title,
    title:          r.title,
    zoom_link:      r.meeting_link,
    start_url:      r.zoom_start_url ?? undefined,
    zoom_meeting_id: r.zoom_meeting_id,
    scheduled_at:   buildScheduledAt(r.session_date, r.start_time),
    status:         calculateSessionStatus(r.session_date, r.start_time, r.status, now),
  }));
}

// ─── STUDENT: sessions from enrolled subjects ──────────────────

export async function getSessionsByStudent(
  studentId: string
): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       t.name         AS topic_name,
       sub.name       AS class_title,
       s.title,
       s.meeting_link,
       s.session_date::text  AS session_date,
       s.start_time::text    AS start_time,
       s.status
     FROM   sessions             s
     JOIN   subjects             sub ON sub.id = s.subject_id
     JOIN   subject_enrollments  se  ON se.subject_id = sub.id
     LEFT JOIN topics            t   ON t.id = s.topic_id
     WHERE  se.student_id        = $1
       AND  se.enrollment_status = 'active'
     ORDER  BY s.session_date DESC, s.start_time DESC
     LIMIT  100`,
    [studentId]
  );

  const now = new Date();
  return rows.map((r) => ({
    id:          r.id,
    subject_id:  r.subject_id,
    topic_id:    r.topic_id ?? undefined,
    topic_name:  r.topic_name ?? undefined,
    class_title: r.class_title,
    title:       r.title,
    zoom_link:   r.meeting_link,
    scheduled_at: buildScheduledAt(r.session_date, r.start_time),
    status:      calculateSessionStatus(r.session_date, r.start_time, r.status, now),
  }));
}

// ─── ADMIN: all sessions ───────────────────────────────────────

export async function getAllSessions(): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       t.name         AS topic_name,
       sub.name       AS class_title,
       s.title,
       s.meeting_link,
       s.zoom_start_url,
       s.zoom_meeting_id,
       s.session_date::text  AS session_date,
       s.start_time::text    AS start_time,
       s.status
     FROM   sessions s
     JOIN   subjects sub ON sub.id = s.subject_id
     LEFT JOIN topics t  ON t.id  = s.topic_id
     ORDER  BY s.session_date DESC, s.start_time DESC
     LIMIT  100`
  );

  const now = new Date();
  return rows.map((r) => ({
    id:             r.id,
    subject_id:     r.subject_id,
    topic_id:       r.topic_id ?? undefined,
    topic_name:     r.topic_name ?? undefined,
    class_title:    r.class_title,
    title:          r.title,
    zoom_link:      r.meeting_link,
    start_url:      r.zoom_start_url ?? undefined,
    zoom_meeting_id: r.zoom_meeting_id,
    scheduled_at:   buildScheduledAt(r.session_date, r.start_time),
    status:         calculateSessionStatus(r.session_date, r.start_time, r.status, now),
  }));
}

// ─── Dispatcher: my-sessions-v2 ───────────────────────────────

export async function getMySessionsV2(
  userId: string,
  role: string
): Promise<SessionWithDetails[]> {
  if (role === 'teacher') return getSessionsByTeacher(userId);
  if (role === 'student') return getSessionsByStudent(userId);
  if (role === 'admin')   return getAllSessions();
  return [];
}

// ─── START session (teacher only) — creates Zoom meeting ───────

export async function startSessionById(
  sessionId: string,
  teacherId: string
): Promise<SessionWithDetails> {
  const ZOOM_HOST_EMAIL = process.env.ZOOM_HOST_EMAIL;
  if (!process.env.ZOOM_ACCOUNT_ID || !process.env.ZOOM_CLIENT_ID ||
      !process.env.ZOOM_CLIENT_SECRET || !ZOOM_HOST_EMAIL) {
    throw new Error('Missing Zoom credentials');
  }

  return withTransaction(async (client) => {
    // Lock the row
    const rows = await queryWithClient<any>(
      client,
      `SELECT
         s.id, s.teacher_id, s.subject_id, s.title, s.status,
         s.session_date::text AS session_date,
         s.start_time::text   AS start_time,
         sub.name AS class_title
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (!rows[0]) throw new Error('Session not found');
    const existing = rows[0];
    if (existing.teacher_id !== teacherId) {
      throw new Error('FORBIDDEN');
    }
    if (existing.status === 'live') throw new Error('Session is already LIVE');

    const accessToken = await getZoomAccessToken();
    const { joinUrl, startUrl } = await createZoomMeeting({
      accessToken,
      hostEmail: ZOOM_HOST_EMAIL,
      topic: existing.title || `${existing.class_title} — Live Session`,
      startTime: new Date(`${existing.session_date}T${existing.start_time.replace(/[+-]\d{2}:\d{2}$/, '')}`).toISOString(),
    });

    const updated = await queryWithClient<any>(
      client,
      `UPDATE sessions
       SET    meeting_link   = $1,
              zoom_start_url = $2,
              status         = 'live',
              updated_at     = now()
       WHERE  id = $3
         AND  status != 'live'
       RETURNING id, subject_id, session_date::text, start_time::text, status, title, meeting_link, zoom_start_url`,
      [joinUrl, startUrl, sessionId]
    );

    if (!updated[0]) throw new Error('Failed to mark session LIVE');

    const r = updated[0];
    return {
      id:          r.id,
      subject_id:  r.subject_id,
      class_title: existing.class_title,
      title:       r.title,
      zoom_link:   r.meeting_link,
      start_url:   r.zoom_start_url ?? undefined,
      scheduled_at: buildScheduledAt(r.session_date, r.start_time),
      status:      'LIVE',
    };
  });
}

// ─── COMPLETE session (teacher only) ──────────────────────────

export async function completeSessionById(
  sessionId: string,
  teacherId: string
): Promise<SessionWithDetails> {
  return withTransaction(async (client) => {
    const rows = await queryWithClient<any>(
      client,
      `SELECT s.id, s.teacher_id, s.subject_id, s.title, s.status,
              s.session_date::text AS session_date,
              s.start_time::text   AS start_time,
              sub.name AS class_title
       FROM   sessions s
       JOIN   subjects sub ON sub.id = s.subject_id
       WHERE  s.id = $1
       FOR UPDATE`,
      [sessionId]
    );

    if (!rows[0]) throw new Error('Session not found');
    if (rows[0].teacher_id !== teacherId) {
      throw new Error('FORBIDDEN');
    }

    const updated = await queryWithClient<any>(
      client,
      `UPDATE sessions
       SET  status     = 'completed',
            updated_at = now()
       WHERE id = $1
         AND status != 'completed'
       RETURNING id, subject_id, session_date::text, start_time::text,
                 status, title, meeting_link`,
      [sessionId]
    );

    if (!updated[0]) throw new Error('Failed to mark session COMPLETED');

    const r = updated[0];
    return {
      id:          r.id,
      subject_id:  r.subject_id,
      class_title: rows[0].class_title,
      title:       r.title,
      zoom_link:   r.meeting_link,
      scheduled_at: buildScheduledAt(r.session_date, r.start_time),
      status:      'COMPLETED',
    };
  });
}

// ─── CREATE session (teacher/admin) ────────────────────────────

export interface CreateSessionInput {
  subjectId:   string;
  teacherId:   string;
  title:       string;
  sessionDate: string;   // "YYYY-MM-DD"
  startTime:   string;   // "HH:MM:00+05:30"
  topicId?:    string;
}

export interface CreatedSession {
  id:          string;
  subject_id:  string;
  class_title: string;
  title:       string;
  scheduled_at: string;
  status:      string;
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const { subjectId, teacherId, title, sessionDate, startTime, topicId } = input;

  // End time = start time + 90 minutes (prevents CHECK constraint violation)
  const endTime = computeEndTime(startTime, 90);

  const rows = await query<any>(
    `INSERT INTO sessions (
       subject_id, teacher_id, title,
       session_date, start_time, end_time,
       timezone, status, topic_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'Asia/Kolkata', 'scheduled', $7)
     RETURNING
       id,
       subject_id,
       title,
       session_date::text  AS session_date,
       start_time::text    AS start_time,
       status`,
    [subjectId, teacherId, title, sessionDate, startTime, endTime, topicId ?? null]
  );

  if (!rows[0]) throw new Error('Failed to create session');

  const r = rows[0];

  // Fetch subject name for response
  const subjectRows = await query<any>(
    `SELECT name FROM subjects WHERE id = $1`,
    [subjectId]
  );

  const timeStr = r.start_time.replace(/[+-]\d{2}:\d{2}$/, '');

  return {
    id:          r.id,
    subject_id:  r.subject_id,
    class_title: subjectRows[0]?.name ?? '',
    title:       r.title,
    scheduled_at: `${r.session_date}T${timeStr}`,
    status:      'SCHEDULED',
  };
}

// Add minutes to a TIMETZ string like "18:30:00+05:30"
function computeEndTime(startTime: string, addMinutes: number): string {
  const tz      = startTime.match(/[+-]\d{2}:\d{2}$/)?.[0] ?? '+05:30';
  const timePart = startTime.replace(/[+-]\d{2}:\d{2}$/, '');
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);

  const totalMinutes = hh * 60 + mm + addMinutes;
  const newHH = Math.floor(totalMinutes / 60) % 24;
  const newMM = totalMinutes % 60;

  return `${String(newHH).padStart(2, '0')}:${String(newMM).padStart(2, '0')}:${String(ss ?? 0).padStart(2, '0')}${tz}`;
}
