import { query, withTransaction, queryWithClient } from '../../config/db';
import { hashPassword, comparePassword } from '../../utils/password';
import { deleteFilesByUrls, parseStorageUrl } from '../../utils/storage';
import logger from '../../config/logger';

// ---- Types ----

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  description: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}

export interface AdminCourse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  subject_count: number;
}

export interface AdminSubject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  course_id: string;
  course_name: string;
  teacher_ids: string[];
  teacher_names: string[];
  enrolled_ids: string[];
  enrolled_count: number;
}

export interface AdminStats {
  total_students: number;
  total_teachers: number;
  total_sessions: number;
  live_sessions: number;
  total_courses: number;
  total_subjects: number;
}

// ---- Stats ----

export async function getStats(): Promise<AdminStats> {
  const rows = await query<any>(`
    SELECT
      (SELECT COUNT(*)
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'student')                                               AS total_students,
      (SELECT COUNT(*)
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE r.name = 'teacher')                                               AS total_teachers,
      (SELECT COUNT(*) FROM sessions)                                         AS total_sessions,
      (SELECT COUNT(*) FROM sessions WHERE status = 'live')                  AS live_sessions,
      (SELECT COUNT(*) FROM courses  WHERE is_active = true)                 AS total_courses,
      (SELECT COUNT(*) FROM subjects WHERE is_active = true)                 AS total_subjects
  `);
  const r = rows[0];
  return {
    total_students: Number(r.total_students),
    total_teachers: Number(r.total_teachers),
    total_sessions: Number(r.total_sessions),
    live_sessions:  Number(r.live_sessions),
    total_courses:  Number(r.total_courses),
    total_subjects: Number(r.total_subjects),
  };
}

// ---- Users ----

export async function getUsers(
  roleFilter?: string,
  page: number = 1,
  limit: number = 20,
  activeFilter?: string   // 'active' | 'inactive' | undefined
): Promise<{ users: AdminUser[]; total: number; page: number; totalPages: number }> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (roleFilter && roleFilter !== 'all') {
    params.push(roleFilter);
    conditions.push(`EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = $${params.length}
    )`);
  }

  if (activeFilter === 'active') {
    conditions.push(`u.is_active = TRUE`);
  } else if (activeFilter === 'inactive') {
    conditions.push(`u.is_active = FALSE`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<any>(`
    SELECT
      COUNT(*) OVER() AS total_count,
      u.id, u.email, u.first_name, u.last_name, u.phone, u.description,
      u.is_active, u.is_super_admin, u.last_login_at, u.created_at,
      COALESCE(
        array_agg(r.name ORDER BY r.id) FILTER (WHERE r.name IS NOT NULL),
        '{}'
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ${whereClause}
    GROUP BY u.id, u.email, u.first_name, u.last_name,
             u.phone, u.description, u.is_active, u.is_super_admin,
             u.last_login_at, u.created_at
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, (page - 1) * limit]);

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  return {
    users: rows.map((r) => ({
      id:             r.id,
      email:          r.email,
      first_name:     r.first_name,
      last_name:      r.last_name,
      phone:          r.phone,
      description:    r.description,
      is_active:      r.is_active,
      is_super_admin: r.is_super_admin,
      last_login_at:  r.last_login_at,
      created_at:     r.created_at,
      roles:          r.roles ?? [],
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createUser(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  description?: string;
  role: string;
  adminId: string;
}): Promise<AdminUser> {
  const hash = await hashPassword(data.password);

  return withTransaction(async (client) => {
    const userRows = await queryWithClient<any>(client, `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, phone, description, is_active, is_super_admin, created_at
    `, [data.email, hash, data.first_name, data.last_name, data.phone ?? null, data.description ?? null]);

    const user = userRows[0];

    // Get role_id
    const roleRows = await queryWithClient<any>(client,
      `SELECT id FROM roles WHERE name = $1`, [data.role]
    );
    if (!roleRows[0]) throw new Error(`Role '${data.role}' not found`);

    await queryWithClient(client, `
      INSERT INTO user_roles (user_id, role_id, assigned_by)
      VALUES ($1, $2, $3)
    `, [user.id, roleRows[0].id, data.adminId]);

    return {
      ...user,
      last_login_at: null,
      roles: [data.role],
    };
  });
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<void> {
  await query(`
    UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2
  `, [isActive, userId]);
}

export async function assignRole(userId: string, roleName: string, adminId: string): Promise<void> {
  const roleRows = await query<any>(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  if (!roleRows[0]) throw new Error(`Role '${roleName}' not found`);

  await query(`
    INSERT INTO user_roles (user_id, role_id, assigned_by)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [userId, roleRows[0].id, adminId]);
}

export async function removeRole(userId: string, roleName: string): Promise<void> {
  const roleRows = await query<any>(`SELECT id FROM roles WHERE name = $1`, [roleName]);
  if (!roleRows[0]) return;

  await query(`
    DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2
  `, [userId, roleRows[0].id]);
}

// ---- Courses ----

export async function getCourses(): Promise<AdminCourse[]> {
  const rows = await query<any>(`
    SELECT
      c.id, c.name, c.code, c.description, c.is_active, c.created_at,
      COUNT(s.id) AS subject_count
    FROM courses c
    LEFT JOIN subjects s ON s.course_id = c.id AND s.is_active = true
    GROUP BY c.id, c.name, c.code, c.description, c.is_active, c.created_at
    ORDER BY c.created_at DESC
  `);

  return rows.map((r) => ({
    id:            r.id,
    name:          r.name,
    code:          r.code,
    description:   r.description,
    is_active:     r.is_active,
    created_at:    r.created_at,
    subject_count: Number(r.subject_count),
  }));
}

export async function createCourse(data: {
  name: string;
  code: string;
  description?: string;
  adminId: string;
}): Promise<AdminCourse> {
  const rows = await query<any>(`
    INSERT INTO courses (name, code, description, created_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, code, description, is_active, created_at
  `, [data.name, data.code.toUpperCase(), data.description ?? null, data.adminId]);

  return { ...rows[0], subject_count: 0 };
}

// ---- Subjects ----

export async function getSubjects(courseId?: string): Promise<AdminSubject[]> {
  const params: any[] = [];
  const whereClause = courseId ? `WHERE sub.course_id = $1` : '';
  if (courseId) params.push(courseId);

  const rows = await query<any>(`
    SELECT
      sub.id, sub.name, sub.code, sub.description, sub.is_active,
      sub.course_id, c.name AS course_name,
      COALESCE(
        array_agg(DISTINCT st.teacher_id) FILTER (WHERE st.teacher_id IS NOT NULL),
        '{}'
      ) AS teacher_ids,
      COALESCE(
        array_agg(DISTINCT (u.first_name || ' ' || u.last_name))
          FILTER (WHERE u.first_name IS NOT NULL),
        '{}'
      ) AS teacher_names,
      COALESCE(
        array_agg(DISTINCT se.student_id) FILTER (WHERE se.enrollment_status = 'active'),
        '{}'
      ) AS enrolled_ids,
      COUNT(DISTINCT se.student_id)
        FILTER (WHERE se.enrollment_status = 'active') AS enrolled_count
    FROM subjects sub
    JOIN courses c ON c.id = sub.course_id
    LEFT JOIN subject_teachers  st ON st.subject_id = sub.id
    LEFT JOIN users             u  ON u.id = st.teacher_id
    LEFT JOIN subject_enrollments se ON se.subject_id = sub.id
    ${whereClause}
    GROUP BY sub.id, sub.name, sub.code, sub.description,
             sub.is_active, sub.course_id, c.name
    ORDER BY c.name, sub.name
  `, params);

  return rows.map((r) => ({
    id:            r.id,
    name:          r.name,
    code:          r.code,
    description:   r.description,
    is_active:     r.is_active,
    course_id:     r.course_id,
    course_name:   r.course_name,
    teacher_ids:   r.teacher_ids ?? [],
    teacher_names: r.teacher_names ?? [],
    enrolled_ids:  r.enrolled_ids ?? [],
    enrolled_count: Number(r.enrolled_count),
  }));
}

export async function createSubject(data: {
  course_id: string;
  name: string;
  code: string;
  description?: string;
  adminId: string;
}): Promise<AdminSubject> {
  const rows = await query<any>(`
    INSERT INTO subjects (course_id, name, code, description, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, code, description, is_active, course_id, created_at
  `, [data.course_id, data.name, data.code.toUpperCase(), data.description ?? null, data.adminId]);

  const courseRows = await query<any>(
    `SELECT name FROM courses WHERE id = $1`, [data.course_id]
  );

  return {
    ...rows[0],
    course_name:    courseRows[0]?.name ?? '',
    teacher_ids:    [],
    teacher_names:  [],
    enrolled_ids:   [],
    enrolled_count: 0,
  };
}

export async function assignTeacher(
  subjectId: string, teacherId: string, adminId: string
): Promise<void> {
  await query(`
    INSERT INTO subject_teachers (subject_id, teacher_id, assigned_by)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
  `, [subjectId, teacherId, adminId]);
}

export async function removeTeacher(subjectId: string, teacherId: string): Promise<void> {
  await query(`
    DELETE FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2
  `, [subjectId, teacherId]);
}

export async function setTeacherPermission(
  subjectId: string,
  teacherId: string,
  permissionLevel: string
): Promise<void> {
  if (!['read', 'write'].includes(permissionLevel)) {
    throw new Error('INVALID_PERMISSION_LEVEL');
  }
  const result = await query<any>(
    `UPDATE subject_teachers SET permission_level = $1
     WHERE subject_id = $2 AND teacher_id = $3
     RETURNING teacher_id`,
    [permissionLevel, subjectId, teacherId]
  );
  if (!result[0]) throw new Error('TEACHER_NOT_ASSIGNED');
}

export async function enrollStudent(
  subjectId: string, studentId: string, adminId: string
): Promise<void> {
  await query(`
    INSERT INTO subject_enrollments (subject_id, student_id, enrolled_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (subject_id, student_id) DO UPDATE
      SET enrollment_status = 'active'
  `, [subjectId, studentId, adminId]);
}

export async function unenrollStudent(subjectId: string, studentId: string): Promise<void> {
  await query(`
    UPDATE subject_enrollments
    SET enrollment_status = 'suspended'
    WHERE subject_id = $1 AND student_id = $2
  `, [subjectId, studentId]);
}

// ---- Get enrolled students for a subject ----

export interface EnrolledStudent {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  enrolled_at: string;
}

export async function getEnrolledStudents(subjectId: string): Promise<EnrolledStudent[]> {
  const rows = await query<any>(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      se.enrollment_status AS status,
      se.enrolled_at
    FROM subject_enrollments se
    JOIN users u ON u.id = se.student_id
    WHERE se.subject_id = $1 AND se.enrollment_status = 'active'
    ORDER BY se.enrolled_at DESC
  `, [subjectId]);

  return rows.map((r) => ({
    id:          r.id,
    email:       r.email,
    first_name:  r.first_name,
    last_name:   r.last_name,
    status:      r.status,
    enrolled_at: r.enrolled_at,
  }));
}

// ---- Update subject ----

export async function updateSubject(
  subjectId: string,
  data: { course_id?: string; name?: string; code?: string; description?: string }
): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.course_id) {
    sets.push(`course_id = $${idx++}`);
    params.push(data.course_id);
  }
  if (data.name) {
    sets.push(`name = $${idx++}`);
    params.push(data.name);
  }
  if (data.code) {
    sets.push(`code = $${idx++}`);
    params.push(data.code.toUpperCase());
  }
  if (data.description !== undefined) {
    sets.push(`description = $${idx++}`);
    params.push(data.description || null);
  }

  if (sets.length === 0) return;

  params.push(subjectId);
  await query(`
    UPDATE subjects SET ${sets.join(', ')}, updated_at = NOW()
    WHERE id = $${idx}
  `, params);
}

// ---- Delete subject ----

export async function deleteSubject(subjectId: string): Promise<void> {
  // attempt_answers.question_id has no ON DELETE CASCADE — must clear manually
  // before the cascade on quizzes→questions fires and blocks the delete
  await query(`
    DELETE FROM attempt_answers WHERE question_id IN (
      SELECT q.id FROM questions q
      JOIN quizzes qz ON qz.id = q.quiz_id
      WHERE qz.subject_id = $1
    )
  `, [subjectId]);
  await query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
}

// ---- Teacher-Student Allocations ----

export interface TeacherAllocationStudent {
  student_id:  string;
  student_name: string;
  email:       string;
  assigned_at: string;
}

export interface TeacherAllocation {
  teacher_id:       string;
  teacher_name:     string;
  teacher_email:    string;
  permission_level: string;
  students:         TeacherAllocationStudent[];
}

export async function getSubjectAllocations(subjectId: string): Promise<TeacherAllocation[]> {
  const rows = await query<any>(`
    SELECT
      st.teacher_id,
      u_t.first_name || ' ' || u_t.last_name  AS teacher_name,
      u_t.email                                AS teacher_email,
      st.permission_level,
      COALESCE(
        json_agg(
          json_build_object(
            'student_id',   u_s.id,
            'student_name', u_s.first_name || ' ' || u_s.last_name,
            'email',        u_s.email,
            'assigned_at',  sts.assigned_at
          ) ORDER BY u_s.first_name
        ) FILTER (WHERE u_s.id IS NOT NULL),
        '[]'::json
      ) AS students
    FROM  subject_teachers st
    JOIN  users u_t ON u_t.id = st.teacher_id
    LEFT JOIN subject_teacher_students sts
          ON  sts.subject_id = st.subject_id
          AND sts.teacher_id = st.teacher_id
    LEFT JOIN users u_s ON u_s.id = sts.student_id
    WHERE st.subject_id = $1
    GROUP BY st.teacher_id, u_t.first_name, u_t.last_name, u_t.email, st.permission_level
    ORDER BY u_t.first_name
  `, [subjectId]);

  return rows.map((r) => ({
    teacher_id:       r.teacher_id,
    teacher_name:     r.teacher_name,
    teacher_email:    r.teacher_email,
    permission_level: r.permission_level,
    students: Array.isArray(r.students)
      ? r.students
      : (r.students ? JSON.parse(r.students) : []),
  }));
}

export async function assignStudentToTeacher(
  subjectId: string, teacherId: string, studentId: string, adminId: string
): Promise<void> {
  await query(`
    INSERT INTO subject_teacher_students (subject_id, teacher_id, student_id, assigned_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `, [subjectId, teacherId, studentId, adminId]);
}

export async function removeStudentFromTeacher(
  subjectId: string, teacherId: string, studentId: string
): Promise<void> {
  await query(`
    DELETE FROM subject_teacher_students
    WHERE subject_id = $1 AND teacher_id = $2 AND student_id = $3
  `, [subjectId, teacherId, studentId]);
}

// ---- Admin session management (A6 / A7) ----

export interface AdminCreateSessionInput {
  teacherId:   string;
  subjectId:   string;
  title:       string;
  sessionDate: string;   // 'YYYY-MM-DD'
  startTime:   string;   // 'HH:MM'
  endTime:     string;   // 'HH:MM'
  topicId?:    string;
  studentIds?: string[]; // optional 1-on-1 targeting
  // recurring fields
  isRecurring?:  boolean;
  recurPattern?: 'daily' | 'weekly';
  recurDays?:    number[]; // 0=Sun … 6=Sat (weekly only)
  recurEndDate?: string;   // 'YYYY-MM-DD'
}

function generateRecurDates(
  startDate: string,
  endDate: string,
  pattern: 'daily' | 'weekly',
  days: number[],
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T00:00:00Z');
  let   cur = new Date(startDate + 'T00:00:00Z');
  const MAX = 365;

  while (cur <= end && dates.length < MAX) {
    const dow = cur.getUTCDay();
    const iso = cur.toISOString().slice(0, 10);
    if (pattern === 'daily') {
      dates.push(iso);
    } else if (days.length === 0 || days.includes(dow)) {
      dates.push(iso);
    }
    cur = new Date(cur.getTime() + 86400000);
  }
  return dates;
}

export async function createAdminSession(input: AdminCreateSessionInput): Promise<{ sessions: any[] }> {
  const {
    teacherId, subjectId, title, sessionDate, startTime, endTime,
    topicId, studentIds,
    isRecurring, recurPattern, recurDays, recurEndDate,
  } = input;

  return withTransaction(async (client) => {
    let recurrenceId: string | null = null;
    let sessionDates: string[]      = [sessionDate];

    if (isRecurring && recurEndDate) {
      const pattern = recurPattern || 'weekly';
      const days    = recurDays    || [];

      const recRows = await queryWithClient<any>(client, `
        INSERT INTO session_recurrence
          (pattern, interval_value, days_of_week, recur_until)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [pattern, 1, days.length ? days : null, recurEndDate]);

      recurrenceId = recRows[0].id;
      sessionDates = generateRecurDates(sessionDate, recurEndDate, pattern, days);
    }

    const created: any[] = [];
    for (const date of sessionDates) {
      const rows = await queryWithClient<any>(client, `
        INSERT INTO sessions
          (subject_id, teacher_id, title, session_date, start_time, end_time,
           topic_id, is_recurring, recurrence_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, title, session_date::text, start_time::text, status
      `, [
        subjectId, teacherId, title, date, startTime, endTime,
        topicId || null,
        Boolean(isRecurring && recurrenceId),
        recurrenceId,
      ]);

      const session = rows[0];
      created.push(session);

      if (studentIds && studentIds.length > 0) {
        for (const sid of studentIds) {
          await queryWithClient(client, `
            INSERT INTO session_students (session_id, student_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [session.id, sid]);
        }
      }
    }

    return { sessions: created };
  });
}

export async function updateAdminSession(
  sessionId: string,
  data: { title?: string; sessionDate?: string; startTime?: string; endTime?: string; topicId?: string | null }
): Promise<void> {
  const sets:   string[] = [];
  const params: any[]    = [];
  let idx = 1;

  if (data.title       !== undefined) { sets.push(`title        = $${idx++}`); params.push(data.title); }
  if (data.sessionDate !== undefined) { sets.push(`session_date = $${idx++}`); params.push(data.sessionDate); }
  if (data.startTime   !== undefined) { sets.push(`start_time   = $${idx++}`); params.push(data.startTime); }
  if (data.endTime     !== undefined) { sets.push(`end_time     = $${idx++}`); params.push(data.endTime); }
  if (data.topicId     !== undefined) { sets.push(`topic_id     = $${idx++}`); params.push(data.topicId); }

  // Reset status to scheduled when date or time changes (reschedule of missed/cancelled sessions)
  if (data.sessionDate !== undefined || data.startTime !== undefined) {
    sets.push(`status = 'scheduled'`);
  }

  if (sets.length === 0) return;
  params.push(sessionId);
  await query(`UPDATE sessions SET ${sets.join(', ')}, updated_at = now() WHERE id = $${idx}`, params);
}

export async function deleteAdminSession(sessionId: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

// ---- Bulk delete sessions (by IDs) ----

export async function bulkDeleteSessions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await withTransaction(async (client) => {
    await queryWithClient(client,
      `DELETE FROM session_students WHERE session_id = ANY($1::uuid[])`, [ids]);
    await queryWithClient(client,
      `DELETE FROM sessions WHERE id = ANY($1::uuid[])`, [ids]);
  });
}

// ---- Delete recurring session (Google Calendar–style scope) ----

export async function deleteRecurringSession(
  sessionId:    string,
  recurrenceId: string,
  mode:         'this' | 'this_and_following' | 'all',
  sessionDate:  string,
): Promise<void> {
  await withTransaction(async (client) => {
    if (mode === 'this') {
      await queryWithClient(client,
        `DELETE FROM session_students WHERE session_id = $1`, [sessionId]);
      await queryWithClient(client,
        `DELETE FROM sessions WHERE id = $1`, [sessionId]);

    } else if (mode === 'this_and_following') {
      const toDelete = await queryWithClient<{ id: string }>(client,
        `SELECT id FROM sessions WHERE recurrence_id = $1 AND session_date >= $2`,
        [recurrenceId, sessionDate]);
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((r) => r.id);
        await queryWithClient(client,
          `DELETE FROM session_students WHERE session_id = ANY($1::uuid[])`, [deleteIds]);
        await queryWithClient(client,
          `DELETE FROM sessions WHERE recurrence_id = $1 AND session_date >= $2`,
          [recurrenceId, sessionDate]);
      }
      // If no sessions remain, clean up recurrence record
      const remaining = await queryWithClient<{ cnt: string }>(client,
        `SELECT COUNT(*) AS cnt FROM sessions WHERE recurrence_id = $1`, [recurrenceId]);
      if (Number(remaining[0]?.cnt) === 0) {
        await queryWithClient(client,
          `DELETE FROM session_recurrence WHERE id = $1`, [recurrenceId]);
      }

    } else { // 'all'
      const toDelete = await queryWithClient<{ id: string }>(client,
        `SELECT id FROM sessions WHERE recurrence_id = $1`, [recurrenceId]);
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map((r) => r.id);
        await queryWithClient(client,
          `DELETE FROM session_students WHERE session_id = ANY($1::uuid[])`, [deleteIds]);
        await queryWithClient(client,
          `DELETE FROM sessions WHERE recurrence_id = $1`, [recurrenceId]);
      }
      await queryWithClient(client,
        `DELETE FROM session_recurrence WHERE id = $1`, [recurrenceId]);
    }
  });
}

// ---- Update recurring session (Google Calendar–style scope) ----

export async function updateRecurringSession(
  sessionId:    string,
  recurrenceId: string,
  mode:         'this' | 'this_and_following' | 'all',
  originalDate: string,
  data: { title?: string; sessionDate?: string; startTime?: string; endTime?: string; topicId?: string | null },
): Promise<void> {
  if (mode === 'this') {
    await updateAdminSession(sessionId, data);
    return;
  }

  // For this_and_following / all: update title/times/topic, not individual dates
  const sets: string[] = [];
  const params: any[]  = [];
  let   idx = 1;

  if (data.title     !== undefined) { sets.push(`title      = $${idx++}`); params.push(data.title); }
  if (data.startTime !== undefined) { sets.push(`start_time = $${idx++}`); params.push(data.startTime); }
  if (data.endTime   !== undefined) { sets.push(`end_time   = $${idx++}`); params.push(data.endTime); }
  if (data.topicId   !== undefined) { sets.push(`topic_id   = $${idx++}`); params.push(data.topicId); }

  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);

  if (mode === 'this_and_following') {
    params.push(recurrenceId, originalDate);
    await query(
      `UPDATE sessions SET ${sets.join(', ')} WHERE recurrence_id = $${idx} AND session_date >= $${idx + 1}`,
      params);
  } else { // 'all'
    params.push(recurrenceId);
    await query(
      `UPDATE sessions SET ${sets.join(', ')} WHERE recurrence_id = $${idx}`,
      params);
  }
}

// ---- Admin Dashboard Overview ----

export async function getAdminDashboardOverview(): Promise<{ students: any[]; teachers: any[] }> {
  const parseJson = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') try { return JSON.parse(v); } catch { return []; }
    return v ?? [];
  };

  const [studentRows, teacherRows] = await Promise.all([
    query<any>(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name AS name,
        u.email,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', sub.id,
            'name', sub.name,
            'course_name', c.name
          )) FILTER (WHERE sub.id IS NOT NULL AND se.enrollment_status = 'active'),
          '[]'
        ) AS subjects,
        (
          SELECT COALESCE(json_agg(t_data), '[]'::json)
          FROM (
            SELECT json_build_object(
              'teacher_id',   sts2.teacher_id,
              'teacher_name', u_t.first_name || ' ' || u_t.last_name,
              'subjects', json_agg(json_build_object(
                'subject_id',   sts2.subject_id,
                'subject_name', sub3.name
              ) ORDER BY sub3.name)
            ) AS t_data
            FROM subject_teacher_students sts2
            JOIN users    u_t  ON u_t.id  = sts2.teacher_id
            JOIN subjects sub3 ON sub3.id = sts2.subject_id
            WHERE sts2.student_id = u.id
            GROUP BY sts2.teacher_id, u_t.first_name, u_t.last_name
          ) t_inner
        ) AS teachers
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r       ON r.id = ur.role_id AND r.name = 'student'
      LEFT JOIN subject_enrollments se ON se.student_id = u.id AND se.enrollment_status = 'active'
      LEFT JOIN subjects sub ON sub.id = se.subject_id
      LEFT JOIN courses  c   ON c.id   = sub.course_id
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY u.first_name, u.last_name
    `),
    query<any>(`
      SELECT
        u.id,
        u.first_name || ' ' || u.last_name AS name,
        u.email,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', sub.id,
            'name', sub.name,
            'course_name', c.name
          )) FILTER (WHERE sub.id IS NOT NULL),
          '[]'
        ) AS subjects,
        COUNT(DISTINCT sts.student_id)::int AS total_students,
        (
          SELECT COALESCE(json_agg(s_row ORDER BY s_row->>'student_name'), '[]'::json)
          FROM (
            SELECT DISTINCT ON (u_s.id)
              json_build_object(
                'student_id',   u_s.id,
                'student_name', u_s.first_name || ' ' || u_s.last_name
              ) AS s_row
            FROM subject_teacher_students sts2
            JOIN users u_s ON u_s.id = sts2.student_id
            WHERE sts2.teacher_id = u.id
          ) s_inner
        ) AS students_list
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r       ON r.id = ur.role_id AND r.name = 'teacher'
      LEFT JOIN subject_teachers         st  ON st.teacher_id  = u.id
      LEFT JOIN subjects                 sub ON sub.id = st.subject_id
      LEFT JOIN courses                  c   ON c.id   = sub.course_id
      LEFT JOIN subject_teacher_students sts ON sts.teacher_id = u.id
      WHERE u.is_active = true
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY u.first_name, u.last_name
    `),
  ]);

  return {
    students: studentRows.map((r) => ({
      id:       r.id,
      name:     r.name,
      email:    r.email,
      subjects: parseJson(r.subjects),
      teachers: parseJson(r.teachers),
    })),
    teachers: teacherRows.map((r) => ({
      id:             r.id,
      name:           r.name,
      email:          r.email,
      subjects:       parseJson(r.subjects),
      total_students: r.total_students ?? 0,
      students:       parseJson(r.students_list),
    })),
  };
}

// ---- All sessions (admin view) ----

export interface AdminSessionFilters {
  date?:      string;
  courseId?:  string;
  subjectId?: string;
  teacherId?: string;
  studentId?: string;
  status?:    string;
}

export async function getAllSessionsAdmin(filters: AdminSessionFilters = {}) {
  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.date) {
    params.push(filters.date);
    conditions.push(`s.session_date = $${params.length}`);
  }
  if (filters.courseId) {
    params.push(filters.courseId);
    conditions.push(`sub.course_id = $${params.length}`);
  }
  if (filters.subjectId) {
    params.push(filters.subjectId);
    conditions.push(`s.subject_id = $${params.length}`);
  }
  if (filters.teacherId) {
    params.push(filters.teacherId);
    conditions.push(`s.teacher_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`s.status = $${params.length}`);
  }
  if (filters.studentId) {
    params.push(filters.studentId);
    conditions.push(`EXISTS (
      SELECT 1 FROM session_students ss_f
      WHERE  ss_f.session_id = s.id AND ss_f.student_id = $${params.length}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query<any>(`
    SELECT
      s.id, s.title, s.status,
      s.subject_id,
      s.recurrence_id,
      s.is_recurring,
      s.session_date::text AS session_date,
      s.start_time::text   AS start_time,
      s.end_time::text     AS end_time,
      s.meeting_link,
      t.name   AS topic_name,
      sub.id   AS subject_id_col,
      sub.name AS subject_name,
      c.id     AS course_id,
      c.name   AS course_name,
      u.id     AS teacher_id,
      u.first_name || ' ' || u.last_name AS teacher_name,
      u.email  AS teacher_email,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'student_id',   u_s.id,
          'student_name', u_s.first_name || ' ' || u_s.last_name
        ) ORDER BY u_s.first_name), '[]'::json)
        FROM session_students ss
        JOIN users u_s ON u_s.id = ss.student_id
        WHERE ss.session_id = s.id
      ) AS session_students_list
    FROM sessions s
    JOIN subjects sub ON sub.id = s.subject_id
    JOIN courses  c   ON c.id   = sub.course_id
    JOIN users    u   ON u.id   = s.teacher_id
    LEFT JOIN topics t ON t.id  = s.topic_id
    ${whereClause}
    ORDER BY s.session_date ASC, s.start_time ASC
    LIMIT 500
  `, params);

  const parseJson = (v: any): any[] => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') try { return JSON.parse(v); } catch { return []; }
    return [];
  };

  return rows.map((r) => ({
    id:             r.id,
    title:          r.title,
    status:         r.status,
    subject_id:     r.subject_id,
    recurrence_id:  r.recurrence_id ?? null,
    is_recurring:   r.is_recurring ?? false,
    teacher_id:     r.teacher_id,
    course_id:      r.course_id,
    session_date: r.session_date,
    start_time:   r.start_time,
    end_time:     r.end_time,
    scheduled_at: `${r.session_date}T${r.start_time.slice(0, 8)}`,
    zoom_link:    r.meeting_link,
    topic_name:   r.topic_name ?? null,
    subject_name: r.subject_name,
    course_name:  r.course_name,
    teacher_name: r.teacher_name,
    teacher_email: r.teacher_email,
    students:     parseJson(r.session_students_list),
  }));
}

// ============================================================
// Super Admin — User Detail, Password, Hard Delete
// ============================================================

/**
 * Check if the requesting admin is the super admin.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT is_super_admin FROM users WHERE id = $1`, [userId]
  );
  return rows[0]?.is_super_admin === true;
}

/**
 * Get detailed user info (for super admin user detail modal).
 */
export async function getUserDetail(userId: string) {
  const rows = await query<any>(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.phone, u.description,
      u.avatar_url, u.is_active, u.is_super_admin, u.last_login_at,
      u.created_at, u.updated_at,
      COALESCE(
        array_agg(r.name ORDER BY r.id) FILTER (WHERE r.name IS NOT NULL),
        '{}'
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1
    GROUP BY u.id
  `, [userId]);

  if (!rows[0]) throw new Error('USER_NOT_FOUND');
  return rows[0];
}

/**
 * Verify admin password (super admin confirms their own password before sensitive ops).
 */
export async function verifyAdminPassword(adminId: string, password: string): Promise<boolean> {
  const rows = await query<any>(
    `SELECT password_hash FROM users WHERE id = $1`, [adminId]
  );
  if (!rows[0]) return false;
  return comparePassword(password, rows[0].password_hash);
}

/**
 * Reset a user's password (super admin only).
 */
export async function resetUserPassword(targetUserId: string, newPassword: string): Promise<void> {
  if (newPassword.length < 6) throw new Error('TOO_SHORT');
  const hash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, targetUserId]);
}

/**
 * Hard delete a user and all their data. Rules:
 * - Cannot delete the super admin
 * - For teachers: published content (quizzes, assignments, materials) is preserved
 *   (ownership is transferred to the super admin). Only unpublished content is deleted.
 * - For students: all data is deleted
 * - Storage files for deleted content are also removed
 */
export async function hardDeleteUser(targetUserId: string, superAdminId: string): Promise<{ deletedFiles: number }> {
  // Safety checks
  const targetRows = await query<any>(
    `SELECT is_super_admin FROM users WHERE id = $1`, [targetUserId]
  );
  if (!targetRows[0]) throw new Error('USER_NOT_FOUND');
  if (targetRows[0].is_super_admin) throw new Error('CANNOT_DELETE_SUPER_ADMIN');

  // Determine user roles
  const roleRows = await query<any>(
    `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
    [targetUserId]
  );
  const roles = roleRows.map((r: any) => r.name);
  const isTeacher = roles.includes('teacher');

  // Collect file URLs to delete from storage
  const filesToDelete: string[] = [];

  return withTransaction(async (client) => {
    // ── 1. Collect & handle teacher-specific content ──────────────────
    if (isTeacher) {
      // Transfer published quizzes created_by to super admin
      await queryWithClient(client, `
        UPDATE quizzes SET created_by = $1
        WHERE created_by = $2 AND is_published = true
      `, [superAdminId, targetUserId]);

      // Transfer published assignments created_by to super admin
      await queryWithClient(client, `
        UPDATE assignments SET created_by = $1
        WHERE created_by = $2 AND is_published = true
      `, [superAdminId, targetUserId]);

      // Transfer published materials uploaded_by to super admin
      await queryWithClient(client, `
        UPDATE subject_materials SET uploaded_by = $1
        WHERE uploaded_by = $2 AND is_published = true
      `, [superAdminId, targetUserId]);

      // Transfer published questions created_by to super admin
      await queryWithClient(client, `
        UPDATE questions SET created_by = $1
        WHERE created_by = $2 AND quiz_id IN (SELECT id FROM quizzes WHERE is_published = true)
      `, [superAdminId, targetUserId]);

      // Collect unpublished material file URLs before deleting
      const unpubMaterials = await queryWithClient<any>(client, `
        SELECT file_url FROM subject_materials WHERE uploaded_by = $1 AND is_published = false
      `, [targetUserId]);
      unpubMaterials.forEach((m: any) => { if (m.file_url) filesToDelete.push(m.file_url); });

      // Collect unpublished assignment attachment URLs
      const unpubAssignments = await queryWithClient<any>(client, `
        SELECT attachment_url FROM assignments WHERE created_by = $1 AND is_published = false
      `, [targetUserId]);
      unpubAssignments.forEach((a: any) => { if (a.attachment_url) filesToDelete.push(a.attachment_url); });

      // Collect unpublished quiz question images
      const unpubQuizImages = await queryWithClient<any>(client, `
        SELECT q.image_url, q.explanation_image_url
        FROM questions q
        JOIN quizzes qz ON qz.id = q.quiz_id
        WHERE q.created_by = $1 AND qz.is_published = false
      `, [targetUserId]);
      unpubQuizImages.forEach((q: any) => {
        if (q.image_url) filesToDelete.push(q.image_url);
        if (q.explanation_image_url) filesToDelete.push(q.explanation_image_url);
      });

      // Collect unpublished quiz question option images
      const unpubOptionImages = await queryWithClient<any>(client, `
        SELECT o.option_image_url
        FROM options o
        JOIN questions q ON q.id = o.question_id
        JOIN quizzes qz ON qz.id = q.quiz_id
        WHERE q.created_by = $1 AND qz.is_published = false AND o.option_image_url IS NOT NULL
      `, [targetUserId]);
      unpubOptionImages.forEach((o: any) => { if (o.option_image_url) filesToDelete.push(o.option_image_url); });

      // Delete unpublished materials
      await queryWithClient(client, `
        DELETE FROM subject_materials WHERE uploaded_by = $1 AND is_published = false
      `, [targetUserId]);

      // Delete attempt_answers for unpublished quiz attempts before deleting quizzes
      await queryWithClient(client, `
        DELETE FROM attempt_answers WHERE attempt_id IN (
          SELECT qa.id FROM quiz_attempts qa
          JOIN quizzes qz ON qz.id = qa.quiz_id
          WHERE qz.created_by = $1 AND qz.is_published = false
        )
      `, [targetUserId]);

      // Delete unpublished assignments (cascade deletes submissions)
      await queryWithClient(client, `
        DELETE FROM assignments WHERE created_by = $1 AND is_published = false
      `, [targetUserId]);

      // Delete unpublished quizzes (cascade deletes questions, options, quiz_sets, attempts)
      await queryWithClient(client, `
        DELETE FROM quizzes WHERE created_by = $1 AND is_published = false
      `, [targetUserId]);

      // Delete all sessions by this teacher
      const teacherSessions = await queryWithClient<{ id: string }>(client, `
        SELECT id FROM sessions WHERE teacher_id = $1
      `, [targetUserId]);
      if (teacherSessions.length > 0) {
        const sessionIds = teacherSessions.map(s => s.id);
        await queryWithClient(client, `
          DELETE FROM session_students WHERE session_id = ANY($1::uuid[])
        `, [sessionIds]);
        await queryWithClient(client, `
          DELETE FROM sessions WHERE teacher_id = $1
        `, [targetUserId]);
      }

      // Remove from subject_teachers, subject_teacher_students
      await queryWithClient(client, `
        DELETE FROM subject_teacher_students WHERE teacher_id = $1
      `, [targetUserId]);
      await queryWithClient(client, `
        DELETE FROM subject_teachers WHERE teacher_id = $1
      `, [targetUserId]);

      // Clean up quiz_write_permissions
      await queryWithClient(client, `
        DELETE FROM quiz_write_permissions WHERE teacher_id = $1
      `, [targetUserId]);
    }

    // ── 2. Handle student-specific data ──────────────────────────────
    if (roles.includes('student')) {
      // Collect student upload file URLs
      const studentUploads = await queryWithClient<any>(client, `
        SELECT file_url, feedback_file_url FROM student_uploads WHERE student_id = $1
      `, [targetUserId]);
      studentUploads.forEach((u: any) => {
        if (u.file_url) filesToDelete.push(u.file_url);
        if (u.feedback_file_url) filesToDelete.push(u.feedback_file_url);
      });

      // Collect assignment submission file URLs
      const submissions = await queryWithClient<any>(client, `
        SELECT submission_url, feedback_file_url FROM assignment_submissions WHERE student_id = $1
      `, [targetUserId]);
      submissions.forEach((s: any) => {
        if (s.submission_url) filesToDelete.push(s.submission_url);
        if (s.feedback_file_url) filesToDelete.push(s.feedback_file_url);
      });

      // Delete attempt_answers for this student
      await queryWithClient(client, `
        DELETE FROM attempt_answers WHERE attempt_id IN (
          SELECT id FROM quiz_attempts WHERE student_id = $1
        )
      `, [targetUserId]);

      // Delete quiz_attempts
      await queryWithClient(client, `
        DELETE FROM quiz_attempts WHERE student_id = $1
      `, [targetUserId]);

      // Delete assignment_submissions
      await queryWithClient(client, `
        DELETE FROM assignment_submissions WHERE student_id = $1
      `, [targetUserId]);

      // Delete student_uploads
      await queryWithClient(client, `
        DELETE FROM student_uploads WHERE student_id = $1
      `, [targetUserId]);

      // Delete student_progress
      await queryWithClient(client, `
        DELETE FROM student_progress WHERE student_id = $1
      `, [targetUserId]);

      // Delete student_content_assignments
      await queryWithClient(client, `
        DELETE FROM student_content_assignments WHERE student_id = $1
      `, [targetUserId]);

      // Remove from enrollments
      await queryWithClient(client, `
        DELETE FROM subject_enrollments WHERE student_id = $1
      `, [targetUserId]);

      // Remove from session_students
      await queryWithClient(client, `
        DELETE FROM session_students WHERE student_id = $1
      `, [targetUserId]);

      // Remove from subject_teacher_students
      await queryWithClient(client, `
        DELETE FROM subject_teacher_students WHERE student_id = $1
      `, [targetUserId]);
    }

    // ── 3. Clean up references where this user assigned/enrolled others ─
    // These have ON DELETE SET NULL or we need to handle them
    // Update assigned_by references in user_roles to super admin
    await queryWithClient(client, `
      UPDATE user_roles SET assigned_by = $1 WHERE assigned_by = $2
    `, [superAdminId, targetUserId]);

    // Update enrolled_by references
    await queryWithClient(client, `
      UPDATE subject_enrollments SET enrolled_by = $1 WHERE enrolled_by = $2
    `, [superAdminId, targetUserId]);

    // Update assigned_by in subject_teachers
    await queryWithClient(client, `
      UPDATE subject_teachers SET assigned_by = $1 WHERE assigned_by = $2
    `, [superAdminId, targetUserId]);

    // Update assigned_by in subject_teacher_students
    await queryWithClient(client, `
      UPDATE subject_teacher_students SET assigned_by = $1 WHERE assigned_by = $2
    `, [superAdminId, targetUserId]);

    // Update assigned_by in student_content_assignments
    await queryWithClient(client, `
      UPDATE student_content_assignments SET assigned_by = $1 WHERE assigned_by = $2
    `, [superAdminId, targetUserId]);

    // Update granted_by in quiz_write_permissions
    await queryWithClient(client, `
      UPDATE quiz_write_permissions SET granted_by = $1 WHERE granted_by = $2
    `, [superAdminId, targetUserId]);

    // Update graded_by in assignment_submissions
    await queryWithClient(client, `
      UPDATE assignment_submissions SET graded_by = $1 WHERE graded_by = $2
    `, [superAdminId, targetUserId]);

    // Update created_by references for courses, subjects, topics (admin-created stuff)
    await queryWithClient(client, `
      UPDATE courses SET created_by = $1 WHERE created_by = $2
    `, [superAdminId, targetUserId]);
    await queryWithClient(client, `
      UPDATE subjects SET created_by = $1 WHERE created_by = $2
    `, [superAdminId, targetUserId]);
    await queryWithClient(client, `
      UPDATE topics SET created_by = $1 WHERE created_by = $2
    `, [superAdminId, targetUserId]);

    // ── 4. Delete user_roles and then the user ──────────────────────
    await queryWithClient(client, `
      DELETE FROM user_roles WHERE user_id = $1
    `, [targetUserId]);

    await queryWithClient(client, `
      DELETE FROM users WHERE id = $1
    `, [targetUserId]);

    // ── 5. Delete storage files (outside transaction for safety) ─────
    // We'll do this after the transaction commits
    return { deletedFiles: filesToDelete.length };
  }).then(async (result) => {
    // Delete files from storage after transaction succeeds
    if (filesToDelete.length > 0) {
      try {
        await deleteFilesByUrls(filesToDelete);
        logger.info(`[hardDelete] Deleted ${filesToDelete.length} files for user ${targetUserId}`);
      } catch (err) {
        logger.error(`[hardDelete] Failed to delete some files for user ${targetUserId}:`, err);
      }
    }
    return result;
  });
}
