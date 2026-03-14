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
       (SELECT STRING_AGG(u2.first_name || ' ' || u2.last_name, ', ' ORDER BY u2.first_name)
        FROM subject_teachers st2 JOIN users u2 ON u2.id = st2.teacher_id
        WHERE st2.subject_id = sub.id) AS teacher_name
     FROM   subjects sub
     JOIN   courses          c  ON c.id  = sub.course_id
     JOIN   subject_teachers st ON st.subject_id = sub.id AND st.teacher_id = $1
     WHERE  sub.is_active  = true
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
    teacher_name: r.teacher_name ?? 'Unassigned',
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
       (SELECT STRING_AGG(u2.first_name || ' ' || u2.last_name, ', ' ORDER BY u2.first_name)
        FROM subject_teachers st2 JOIN users u2 ON u2.id = st2.teacher_id
        WHERE st2.subject_id = sub.id) AS teacher_name
     FROM   subjects sub
     JOIN   courses             c  ON c.id  = sub.course_id
     JOIN   subject_enrollments se ON se.subject_id = sub.id AND se.student_id = $1
     WHERE  se.enrollment_status = 'active'
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
    teacher_name: r.teacher_name ?? 'Unassigned',
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
       COALESCE(
         (SELECT STRING_AGG(u2.first_name || ' ' || u2.last_name, ', ' ORDER BY u2.first_name)
          FROM subject_teachers st2 JOIN users u2 ON u2.id = st2.teacher_id
          WHERE st2.subject_id = sub.id),
         'Unassigned'
       ) AS teacher_name
     FROM   subjects sub
     JOIN   courses c   ON c.id  = sub.course_id
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

// ─── TEACHER: only sessions this teacher created ───────────────
// T5: filter by teacher_id (not subject_teachers join) so teachers only
// see their own sessions, not sessions created by admin or other teachers.

export async function getSessionsByTeacher(
  teacherId: string
): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       s.teacher_id,
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
     LEFT JOIN topics        t   ON t.id = s.topic_id
     WHERE  s.teacher_id = $1
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
    teacher_id:     r.teacher_id,
    zoom_link:      r.meeting_link,
    start_url:      r.zoom_start_url ?? undefined,
    zoom_meeting_id: r.zoom_meeting_id,
    scheduled_at:   buildScheduledAt(r.session_date, r.start_time),
    status:         calculateSessionStatus(r.session_date, r.start_time, r.status, now),
  }));
}

// ─── STUDENT: sessions from enrolled subjects (1-on-1 aware) ──
// T1: A session with entries in session_students is targeted — student only
// sees it if they are listed. Sessions with no session_students entries
// are visible to all enrolled students (legacy / group sessions).

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
       AND (
         -- no specific students targeted (open to all enrolled)
         NOT EXISTS (SELECT 1 FROM session_students ss WHERE ss.session_id = s.id)
         OR
         -- this student is explicitly included
         EXISTS (SELECT 1 FROM session_students ss WHERE ss.session_id = s.id AND ss.student_id = $1)
       )
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
       s.teacher_id,
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
    teacher_id:     r.teacher_id,
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

    // T5 fix: allow any teacher assigned to the subject, not just the session creator
    if (existing.teacher_id !== teacherId) {
      const assigned = await queryWithClient<any>(
        client,
        `SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2`,
        [existing.subject_id, teacherId]
      );
      if (!assigned.length) throw new Error('FORBIDDEN');
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
    // T5 fix: allow any assigned teacher for the subject
    if (rows[0].teacher_id !== teacherId) {
      const assigned = await queryWithClient<any>(
        client,
        `SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2`,
        [rows[0].subject_id, teacherId]
      );
      if (!assigned.length) throw new Error('FORBIDDEN');
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
  sessionDate: string;    // "YYYY-MM-DD"
  startTime:   string;    // "HH:MM:00+05:30"
  endTime?:    string;    // T6: optional end time; defaults to +90 min
  topicId?:    string;
  studentIds?: string[];  // T1/T6: optional list for 1-on-1 targeting
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
  const { subjectId, teacherId, title, sessionDate, startTime, topicId, studentIds } = input;

  // T6: use caller-provided end time or fall back to +90 min
  const endTime = input.endTime ?? computeEndTime(startTime, 90);

  return withTransaction(async (client) => {
    const rows = await queryWithClient<any>(
      client,
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

    // T1/T6: insert targeted students if provided
    if (studentIds && studentIds.length > 0) {
      for (const sid of studentIds) {
        await queryWithClient(
          client,
          `INSERT INTO session_students (session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [r.id, sid]
        );
      }
    }

    // Fetch subject name for response
    const subjectRows = await queryWithClient<any>(
      client,
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
  });
}

// ─── GET enrolled students for a subject (teacher-visible) ─────
// Used to populate student selectors for 1-on-1 session / assignment targeting.

export async function getSubjectStudents(subjectId: string): Promise<Array<{
  id: string; first_name: string; last_name: string; email: string;
}>> {
  return query<any>(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM   subject_enrollments se
     JOIN   users u ON u.id = se.student_id
     WHERE  se.subject_id = $1 AND se.enrollment_status = 'active'
     ORDER  BY u.first_name, u.last_name`,
    [subjectId]
  );
}

// ─── T7: Teacher session history — per-student breakdown ───────

export async function getMySessionStats(teacherId: string): Promise<Array<{
  student_id: string;
  student_name: string;
  email: string;
  sessions_count: number;
  last_session: string | null;
}>> {
  const rows = await query<any>(
    `SELECT
       u.id         AS student_id,
       u.first_name || ' ' || u.last_name AS student_name,
       u.email,
       COUNT(s.id)  AS sessions_count,
       MAX(s.session_date::text) AS last_session
     FROM   sessions s
     JOIN   subject_enrollments se ON se.subject_id = s.subject_id
     JOIN   users u ON u.id = se.student_id
     WHERE  s.teacher_id = $1
       AND  s.status = 'completed'
     GROUP  BY u.id
     ORDER  BY sessions_count DESC`,
    [teacherId]
  );
  return rows.map((r: any) => ({
    student_id:     r.student_id,
    student_name:   r.student_name,
    email:          r.email,
    sessions_count: Number(r.sessions_count),
    last_session:   r.last_session ?? null,
  }));
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

// ─── DELETE session (teacher who owns it or admin) ─────────────

export async function deleteSession(sessionId: string, requesterId: string): Promise<void> {
  const result = await query<any>(`
    UPDATE sessions SET status = 'cancelled', updated_at = now()
    WHERE id = $1
      AND (teacher_id = $2 OR EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $2 AND r.name = 'admin'
      ))
    RETURNING id
  `, [sessionId, requesterId]);

  if (!result[0]) throw new Error('FORBIDDEN');
}
