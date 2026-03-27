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
  now: Date = new Date(),
  timeZone: string = 'UTC'
): string {
  // Explicit DB states always win
  if (dbStatus === 'live') return 'LIVE';
  if (dbStatus === 'completed' || dbStatus === 'cancelled') return 'COMPLETED';
  // DB-marked missed is also definitive
  if (dbStatus === 'missed') return 'MISSED';

  const dateKeyInTz = (d: Date): string => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  };

  const tzOffset = start_time.match(/[+-]\d{2}:\d{2}$/)?.[0] ?? '+00:00';
  const timePart = start_time.slice(0, 8);
  const sessionInstant = new Date(`${session_date}T${timePart}${tzOffset}`);
  if (Number.isNaN(sessionInstant.getTime())) return 'SCHEDULED';

  const gracePeriodMs = 10 * 60 * 1000;
  if (now.getTime() > sessionInstant.getTime() + gracePeriodMs) return 'MISSED';

  const todayKey = dateKeyInTz(now);
  const tomorrowKey = dateKeyInTz(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const sessionKey = dateKeyInTz(sessionInstant);

  if (sessionKey === todayKey) return 'TODAY';
  if (sessionKey === tomorrowKey) return 'TOMORROW';

  return 'SCHEDULED';
}

// Build ISO scheduled_at string from DATE + TIMETZ columns
function buildScheduledAt(session_date: string, start_time: string): string {
  // slice(0, 8) extracts HH:MM:SS regardless of timezone suffix (+05:30, +00, etc.)
  const timeStr = start_time.slice(0, 8);
  const tzOffset = start_time.match(/[+-]\d{2}:\d{2}$/)?.[0] ?? '+00:00';
  return `${session_date}T${timeStr}${tzOffset}`;
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
       st.permission_level,
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
    id:               r.id,
    title:            r.name,
    code:             r.code,
    description:      r.description,
    course_name:      r.course_name,
    permission_level: r.permission_level,
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

function getWeekBounds(week: string): [string, string] {
  const d = new Date(week + 'T00:00:00Z');
  const dow = d.getUTCDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d.getTime() + diffToMon * 86400000);
  const sun = new Date(mon.getTime() + 7 * 86400000);
  return [mon.toISOString().slice(0, 10), sun.toISOString().slice(0, 10)];
}

export async function getSessionsByTeacher(
  teacherId: string,
  date?: string,
  month?: string,
  timeZone: string = 'UTC',
  week?: string
): Promise<SessionWithDetails[]> {
  // Auto-mark sessions past the 10-min grace window as 'missed'
  await query(
    `UPDATE sessions
     SET    status     = 'missed',
            updated_at = now()
     WHERE  teacher_id = $1
       AND  status     = 'scheduled'
       AND  (session_date::date + start_time::timetz + interval '10 minutes') < now()`,
    [teacherId]
  );

  let dateClause = '';
  const params: any[] = [teacherId];
  if (date) {
    dateClause = ' AND s.session_date = $2';
    params.push(date);
  } else if (week) {
    const [monStr, sunStr] = getWeekBounds(week);
    dateClause = ' AND s.session_date >= $2 AND s.session_date < $3';
    params.push(monStr, sunStr);
  } else if (month) {
    const [yStr, mStr] = month.split('-');
    const y = Number(yStr); const m = Number(mStr);
    const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    dateClause = ' AND s.session_date >= $2 AND s.session_date < $3';
    params.push(`${month}-01`, nextStart);
  }
  const limitClause = (month || week) ? '' : 'LIMIT 100';
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       s.teacher_id,
       t.name               AS topic_name,
       sub.name             AS class_title,
       c.name               AS course_name,
       s.title,
       s.meeting_link,
       s.zoom_start_url,
       s.zoom_meeting_id,
       s.session_date::text AS session_date,
       s.start_time::text   AS start_time,
       s.end_time::text     AS end_time,
       s.is_recurring,
       sr.pattern           AS recur_pattern,
       sr.days_of_week      AS recur_days,
       sr.recur_until::text AS recur_until,
       (SELECT STRING_AGG(u2.first_name || ' ' || u2.last_name, ', ' ORDER BY u2.first_name)
        FROM   session_students ss2
        JOIN   users u2 ON u2.id = ss2.student_id
        WHERE  ss2.session_id = s.id)        AS target_students,
       (SELECT COUNT(*)::int
        FROM   session_students ss3
        WHERE  ss3.session_id = s.id)        AS target_count,
       s.recurrence_id,
       s.status
     FROM   sessions              s
     JOIN   subjects              sub ON sub.id = s.subject_id
     JOIN   courses               c   ON c.id   = sub.course_id
     LEFT JOIN topics             t   ON t.id   = s.topic_id
     LEFT JOIN session_recurrence sr  ON sr.id  = s.recurrence_id
     WHERE  s.teacher_id = $1${dateClause}
     ORDER  BY s.session_date DESC, s.start_time DESC
     ${limitClause}`,
    params
  );

  const now = new Date();
  return rows.map((r) => ({
    id:              r.id,
    subject_id:      r.subject_id,
    topic_id:        r.topic_id    ?? undefined,
    topic_name:      r.topic_name  ?? undefined,
    class_title:     r.class_title,
    course_name:     r.course_name,
    title:           r.title,
    teacher_id:      r.teacher_id,
    zoom_link:       r.meeting_link,
    start_url:       r.zoom_start_url ?? undefined,
    zoom_meeting_id: r.zoom_meeting_id,
    scheduled_at:    buildScheduledAt(r.session_date, r.start_time),
    session_date:    r.session_date,
    start_time:      r.start_time,
    end_time:        r.end_time     ?? undefined,
    recurrence_id:   r.recurrence_id ?? undefined,
    is_recurring:    Boolean(r.is_recurring),
    recur_pattern:   r.recur_pattern ?? undefined,
    recur_days:      r.recur_days    ?? undefined,
    recur_until:     r.recur_until   ?? undefined,
    target_students: r.target_students ?? undefined,
    target_count:    r.target_count  ?? 0,
    status:          calculateSessionStatus(r.session_date, r.start_time, r.status, now, timeZone),
  }));
}

// ─── STUDENT: sessions from enrolled subjects (1-on-1 aware) ──
// T1: A session with entries in session_students is targeted — student only
// sees it if they are listed. Sessions with no session_students entries
// are visible to all enrolled students (legacy / group sessions).

export async function getSessionsByStudent(
  studentId: string,
  date?: string,
  month?: string,
  timeZone: string = 'UTC',
  week?: string
): Promise<SessionWithDetails[]> {
  let dateClause = '';
  const params: any[] = [studentId];
  if (date) {
    dateClause = ' AND s.session_date = $2';
    params.push(date);
  } else if (week) {
    const [monStr, sunStr] = getWeekBounds(week);
    dateClause = ' AND s.session_date >= $2 AND s.session_date < $3';
    params.push(monStr, sunStr);
  } else if (month) {
    const [yStr, mStr] = month.split('-');
    const y = Number(yStr); const m = Number(mStr);
    const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    dateClause = ' AND s.session_date >= $2 AND s.session_date < $3';
    params.push(`${month}-01`, nextStart);
  }
  const limitClause = (month || week) ? '' : 'LIMIT 100';
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       t.name               AS topic_name,
       sub.name             AS class_title,
       c.name               AS course_name,
       s.title,
       s.meeting_link,
       s.session_date::text AS session_date,
       s.start_time::text   AS start_time,
       s.end_time::text     AS end_time,
       s.is_recurring,
       sr.pattern           AS recur_pattern,
       sr.days_of_week      AS recur_days,
       sr.recur_until::text AS recur_until,
       u.first_name || ' ' || u.last_name AS teacher_name,
       s.recurrence_id,
       s.status
     FROM   sessions              s
     JOIN   subjects              sub ON sub.id  = s.subject_id
     JOIN   courses               c   ON c.id    = sub.course_id
     JOIN   users                 u   ON u.id    = s.teacher_id
     JOIN   subject_enrollments   se  ON se.subject_id = sub.id
     LEFT JOIN topics             t   ON t.id    = s.topic_id
     LEFT JOIN session_recurrence sr  ON sr.id   = s.recurrence_id
     WHERE  se.student_id        = $1
       AND  se.enrollment_status = 'active'${dateClause}
       AND EXISTS (
         SELECT 1 FROM subject_teacher_students sts
         WHERE  sts.subject_id = s.subject_id
           AND  sts.teacher_id = s.teacher_id
           AND  sts.student_id = $1
       )
       AND (
         NOT EXISTS (SELECT 1 FROM session_students ss WHERE ss.session_id = s.id)
         OR
         EXISTS (SELECT 1 FROM session_students ss WHERE ss.session_id = s.id AND ss.student_id = $1)
       )
     ORDER  BY s.session_date DESC, s.start_time DESC
     ${limitClause}`,
    params
  );

  const now = new Date();
  return rows.map((r) => ({
    id:            r.id,
    subject_id:    r.subject_id,
    topic_id:      r.topic_id     ?? undefined,
    topic_name:    r.topic_name   ?? undefined,
    class_title:   r.class_title,
    course_name:   r.course_name,
    title:         r.title,
    zoom_link:     r.meeting_link,
    scheduled_at:  buildScheduledAt(r.session_date, r.start_time),
    session_date:  r.session_date,
    start_time:    r.start_time,
    end_time:      r.end_time     ?? undefined,
    recurrence_id: r.recurrence_id ?? undefined,
    is_recurring:  Boolean(r.is_recurring),
    recur_pattern: r.recur_pattern ?? undefined,
    recur_days:    r.recur_days    ?? undefined,
    recur_until:   r.recur_until   ?? undefined,
    teacher_name:  r.teacher_name,
    status:        calculateSessionStatus(r.session_date, r.start_time, r.status, now, timeZone),
  }));
}

// ─── ADMIN: all sessions ───────────────────────────────────────

export async function getAllSessions(date?: string, month?: string, timeZone: string = 'UTC', week?: string): Promise<SessionWithDetails[]> {
  let dateClause = '';
  const params: any[] = [];
  if (date) {
    dateClause = 'WHERE s.session_date = $1';
    params.push(date);
  } else if (week) {
    const [monStr, sunStr] = getWeekBounds(week);
    dateClause = 'WHERE s.session_date >= $1 AND s.session_date < $2';
    params.push(monStr, sunStr);
  } else if (month) {
    const [yStr, mStr] = month.split('-');
    const y = Number(yStr); const m = Number(mStr);
    const nextStart = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    dateClause = 'WHERE s.session_date >= $1 AND s.session_date < $2';
    params.push(`${month}-01`, nextStart);
  }
  const limitClause = (month || week) ? '' : 'LIMIT 100';
  const rows = await query<any>(
    `SELECT
       s.id,
       s.subject_id,
       s.topic_id,
       s.teacher_id,
       t.name               AS topic_name,
       sub.name             AS class_title,
       c.name               AS course_name,
       s.title,
       s.meeting_link,
       s.zoom_start_url,
       s.zoom_meeting_id,
       s.session_date::text AS session_date,
       s.start_time::text   AS start_time,
       s.end_time::text     AS end_time,
       s.is_recurring,
       sr.pattern           AS recur_pattern,
       sr.days_of_week      AS recur_days,
       sr.recur_until::text AS recur_until,
       u.first_name || ' ' || u.last_name AS teacher_name,
       (SELECT STRING_AGG(u2.first_name || ' ' || u2.last_name, ', ' ORDER BY u2.first_name)
        FROM   session_students ss2
        JOIN   users u2 ON u2.id = ss2.student_id
        WHERE  ss2.session_id = s.id)        AS target_students,
       (SELECT COUNT(*)::int
        FROM   session_students ss3
        WHERE  ss3.session_id = s.id)        AS target_count,
       s.recurrence_id,
       s.status
     FROM   sessions              s
     JOIN   subjects              sub ON sub.id  = s.subject_id
     JOIN   courses               c   ON c.id    = sub.course_id
     JOIN   users                 u   ON u.id    = s.teacher_id
     LEFT JOIN topics             t   ON t.id    = s.topic_id
     LEFT JOIN session_recurrence sr  ON sr.id   = s.recurrence_id
     ${dateClause}
     ORDER  BY s.session_date DESC, s.start_time DESC
     ${limitClause}`,
    params
  );

  const now = new Date();
  return rows.map((r) => ({
    id:              r.id,
    subject_id:      r.subject_id,
    topic_id:        r.topic_id     ?? undefined,
    topic_name:      r.topic_name   ?? undefined,
    class_title:     r.class_title,
    course_name:     r.course_name,
    title:           r.title,
    teacher_id:      r.teacher_id,
    teacher_name:    r.teacher_name,
    zoom_link:       r.meeting_link,
    start_url:       r.zoom_start_url ?? undefined,
    zoom_meeting_id: r.zoom_meeting_id,
    scheduled_at:    buildScheduledAt(r.session_date, r.start_time),
    session_date:    r.session_date,
    start_time:      r.start_time,
    end_time:        r.end_time      ?? undefined,
    recurrence_id:   r.recurrence_id ?? undefined,
    is_recurring:    Boolean(r.is_recurring),
    recur_pattern:   r.recur_pattern ?? undefined,
    recur_days:      r.recur_days    ?? undefined,
    recur_until:     r.recur_until   ?? undefined,
    target_students: r.target_students ?? undefined,
    target_count:    r.target_count   ?? 0,
    status:          calculateSessionStatus(r.session_date, r.start_time, r.status, now, timeZone),
  }));
}

// ─── Dispatcher: my-sessions-v2 ───────────────────────────────

export async function getMySessionsV2(
  userId: string,
  role: string,
  date?: string,
  month?: string,
  timeZone: string = 'UTC',
  week?: string
): Promise<SessionWithDetails[]> {
  if (role === 'teacher') return getSessionsByTeacher(userId, date, month, timeZone, week);
  if (role === 'student') return getSessionsByStudent(userId, date, month, timeZone, week);
  if (role === 'admin')   return getAllSessions(date, month, timeZone, week);
  return [];
}

// ─── START session (teacher only) — creates Zoom meeting ───────

export async function startSessionById(
  sessionId: string,
  teacherId: string,
  role?: string
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

    // A5: admin bypasses ownership; T5: any assigned teacher can start
    if (role !== 'admin' && existing.teacher_id !== teacherId) {
      const assigned = await queryWithClient<any>(
        client,
        `SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2`,
        [existing.subject_id, teacherId]
      );
      if (!assigned.length) throw new Error('FORBIDDEN');
    }

    if (existing.status === 'live')   throw new Error('Session is already LIVE');
    if (existing.status === 'missed') throw new Error('Session was missed');

    // Teachers may only start a session from 5 minutes before its scheduled time.
    // Admins bypass this restriction.
    if (role !== 'admin') {
      const tz       = existing.start_time.match(/[+-]\d{2}:\d{2}$/)?.[0] ?? '+05:30';
      const timePart = existing.start_time.slice(0, 8);
      const scheduledMs = new Date(`${existing.session_date}T${timePart}${tz}`).getTime();
      const FIVE_MIN_MS = 5 * 60 * 1000;
      if (Date.now() < scheduledMs - FIVE_MIN_MS) {
        const minsLeft = Math.ceil((scheduledMs - Date.now()) / 60000);
        throw Object.assign(new Error('TOO_EARLY'), { minsLeft });
      }
    }

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
  teacherId: string,
  role?: string
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
    // A5: admin bypasses ownership; T5: any assigned teacher can complete
    if (role !== 'admin' && rows[0].teacher_id !== teacherId) {
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
  subjectId:    string;
  teacherId:    string;
  title:        string;
  sessionDate:  string;   // "YYYY-MM-DD"
  startTime:    string;   // "HH:MM:00+05:30"
  endTime?:     string;   // T6: optional end time; defaults to +90 min
  topicId?:     string;
  studentIds?:  string[]; // T1/T6: optional list for 1-on-1 targeting
  // A6: recurring session support
  isRecurring?:  boolean;
  recurPattern?: 'daily' | 'weekly';
  recurDays?:    number[]; // 0=Sun … 6=Sat (weekly only)
  recurEndDate?: string;   // "YYYY-MM-DD"
}

function generateDates(
  startDate: string, endDate: string,
  pattern: 'daily' | 'weekly', days: number[],
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T00:00:00Z');
  let   cur = new Date(startDate + 'T00:00:00Z');
  while (cur <= end && dates.length < 365) {
    const dow = cur.getUTCDay();
    const iso = cur.toISOString().slice(0, 10);
    if (pattern === 'daily' || days.length === 0 || days.includes(dow)) dates.push(iso);
    cur = new Date(cur.getTime() + 86400000);
  }
  return dates;
}

export interface CreatedSession {
  id:          string;
  subject_id:  string;
  class_title: string;
  title:       string;
  scheduled_at: string;
  status:      string;
}

export async function createSession(input: CreateSessionInput): Promise<{ sessions: CreatedSession[]; count: number }> {
  const {
    subjectId, teacherId, title, sessionDate, startTime, topicId, studentIds,
    isRecurring, recurPattern, recurDays, recurEndDate,
  } = input;

  const endTime = input.endTime ?? computeEndTime(startTime, 90);

  return withTransaction(async (client) => {
    // Fetch subject name once
    const subjectRows = await queryWithClient<any>(client, `SELECT name FROM subjects WHERE id = $1`, [subjectId]);
    const class_title = subjectRows[0]?.name ?? '';

    let recurrenceId: string | null = null;
    let sessionDates: string[]      = [sessionDate];

    if (isRecurring && recurEndDate) {
      const pattern = recurPattern || 'weekly';
      const days    = recurDays    || [];
      const recRows = await queryWithClient<any>(client, `
        INSERT INTO session_recurrence (pattern, interval_value, days_of_week, recur_until)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [pattern, 1, days.length ? days : null, recurEndDate]);
      recurrenceId = recRows[0].id;
      sessionDates = generateDates(sessionDate, recurEndDate, pattern, days);
    }

    const created: CreatedSession[] = [];
    for (const date of sessionDates) {
      const rows = await queryWithClient<any>(
        client,
        `INSERT INTO sessions (
           subject_id, teacher_id, title,
           session_date, start_time, end_time,
           timezone, status, topic_id, is_recurring, recurrence_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, 'Asia/Kolkata', 'scheduled', $7, $8, $9)
         RETURNING id, subject_id, title, session_date::text, start_time::text, status`,
        [subjectId, teacherId, title, date, startTime, endTime,
         topicId ?? null, Boolean(isRecurring && recurrenceId), recurrenceId]
      );

      if (!rows[0]) throw new Error('Failed to create session');
      const r = rows[0];

      if (studentIds && studentIds.length > 0) {
        for (const sid of studentIds) {
          await queryWithClient(client,
            `INSERT INTO session_students (session_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [r.id, sid]
          );
        }
      }

      const timeStr = r.start_time.replace(/[+-]\d{2}:\d{2}$/, '');
      created.push({
        id:           r.id,
        subject_id:   r.subject_id,
        class_title,
        title:        r.title,
        scheduled_at: `${r.session_date}T${timeStr}`,
        status:       'SCHEDULED',
      });
    }

    return { sessions: created, count: created.length };
  });
}

// ─── GET teachers assigned to a subject ────────────────────────

export async function getSubjectTeachers(subjectId: string): Promise<Array<{
  id: string; first_name: string; last_name: string; email: string; permission_level: string;
}>> {
  return query<any>(
    `SELECT u.id, u.first_name, u.last_name, u.email, st.permission_level
     FROM   subject_teachers st
     JOIN   users u ON u.id = st.teacher_id
     WHERE  st.subject_id = $1
     ORDER  BY u.first_name, u.last_name`,
    [subjectId]
  );
}

// ─── GET enrolled students for a subject (teacher-visible) ─────
// Used to populate student selectors for 1-on-1 session / assignment targeting.

export async function getSubjectStudents(
  subjectId: string,
  teacherId?: string
): Promise<Array<{ id: string; first_name: string; last_name: string; email: string }>> {
  if (teacherId) {
    // Teacher: only students explicitly allocated to them for this subject
    return query<any>(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM   subject_teacher_students sts
       JOIN   users u ON u.id = sts.student_id
       WHERE  sts.subject_id = $1 AND sts.teacher_id = $2
       ORDER  BY u.first_name, u.last_name`,
      [subjectId, teacherId]
    );
  }
  // Admin: all enrolled students for the subject
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
     FROM   subject_teacher_students sts
     JOIN   users u ON u.id = sts.student_id
     LEFT JOIN sessions s
       ON  s.subject_id = sts.subject_id
       AND s.teacher_id = sts.teacher_id
       AND s.status = 'completed'
     WHERE  sts.teacher_id = $1
     GROUP  BY u.id, u.first_name, u.last_name, u.email
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

export async function deleteSession(sessionId: string, requesterId: string, role?: string): Promise<void> {
  if (role === 'admin') {
    // Hard delete: remove session_students first (FK), then the session itself
    await withTransaction(async (client) => {
      // Verify session exists (no ownership check for admin)
      const rows = await queryWithClient<any>(client, `SELECT id FROM sessions WHERE id = $1`, [sessionId]);
      if (!rows[0]) throw new Error('FORBIDDEN');

      await queryWithClient(client, `DELETE FROM session_students WHERE session_id = $1`, [sessionId]);
      await queryWithClient(client, `DELETE FROM sessions WHERE id = $1`, [sessionId]);
    });
  } else {
    // Soft cancel: teacher can only cancel their own session
    const result = await query<any>(`
      UPDATE sessions SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND teacher_id = $2
      RETURNING id
    `, [sessionId, requesterId]);

    if (!result[0]) throw new Error('FORBIDDEN');
  }
}
