import { query, withTransaction, queryWithClient } from '../../config/db';
import { hashPassword } from '../../utils/password';

// ---- Types ----

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
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
  limit: number = 20
): Promise<{ users: AdminUser[]; total: number; page: number; totalPages: number }> {
  let roleWhere = '';
  const params: any[] = [];

  if (roleFilter && roleFilter !== 'all') {
    roleWhere = `WHERE EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r2 ON r2.id = ur2.role_id
      WHERE ur2.user_id = u.id AND r2.name = $1
    )`;
    params.push(roleFilter);
  }

  const rows = await query<any>(`
    SELECT
      COUNT(*) OVER() AS total_count,
      u.id, u.email, u.first_name, u.last_name, u.phone,
      u.is_active, u.last_login_at, u.created_at,
      COALESCE(
        array_agg(r.name ORDER BY r.id) FILTER (WHERE r.name IS NOT NULL),
        '{}'
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    ${roleWhere}
    GROUP BY u.id, u.email, u.first_name, u.last_name,
             u.phone, u.is_active, u.last_login_at, u.created_at
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, (page - 1) * limit]);

  const total = rows[0] ? Number(rows[0].total_count) : 0;

  return {
    users: rows.map((r) => ({
      id:            r.id,
      email:         r.email,
      first_name:    r.first_name,
      last_name:     r.last_name,
      phone:         r.phone,
      is_active:     r.is_active,
      last_login_at: r.last_login_at,
      created_at:    r.created_at,
      roles:         r.roles ?? [],
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
  role: string;
  adminId: string;
}): Promise<AdminUser> {
  const hash = await hashPassword(data.password);

  return withTransaction(async (client) => {
    const userRows = await queryWithClient<any>(client, `
      INSERT INTO users (email, password_hash, first_name, last_name, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, email, first_name, last_name, phone, is_active, created_at
    `, [data.email, hash, data.first_name, data.last_name, data.phone ?? null]);

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
  // Delete related records first
  await query(`DELETE FROM subject_teachers WHERE subject_id = $1`, [subjectId]);
  await query(`DELETE FROM subject_enrollments WHERE subject_id = $1`, [subjectId]);
  // Now delete the subject
  await query(`DELETE FROM subjects WHERE id = $1`, [subjectId]);
}

// ---- All sessions (admin view) ----

export async function getAllSessionsAdmin() {
  const rows = await query<any>(`
    SELECT
      s.id, s.title, s.status,
      s.session_date::text AS session_date,
      s.start_time::text   AS start_time,
      s.meeting_link,
      t.name   AS topic_name,
      sub.name AS subject_name,
      c.name   AS course_name,
      u.first_name || ' ' || u.last_name AS teacher_name,
      u.email AS teacher_email
    FROM sessions s
    JOIN subjects sub ON sub.id = s.subject_id
    JOIN courses  c   ON c.id   = sub.course_id
    JOIN users    u   ON u.id   = s.teacher_id
    LEFT JOIN topics t ON t.id  = s.topic_id
    ORDER BY s.session_date DESC, s.start_time DESC
    LIMIT 200
  `);

  return rows.map((r) => ({
    id:           r.id,
    title:        r.title,
    status:       r.status,
    scheduled_at: `${r.session_date}T${r.start_time.replace(/[+-]\d{2}:\d{2}$/, '')}`,
    zoom_link:    r.meeting_link,
    topic_name:   r.topic_name ?? null,
    subject_name: r.subject_name,
    course_name:  r.course_name,
    teacher_name: r.teacher_name,
    teacher_email: r.teacher_email,
  }));
}
