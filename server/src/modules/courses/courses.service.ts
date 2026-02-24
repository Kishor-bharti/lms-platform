// courses.service.ts — GET /api/courses/my-courses
// Returns courses + their subjects, filtered by role:
//   teacher → courses they have subjects assigned in
//   student → courses they are enrolled in subjects of
//   admin   → all active courses

import { query } from '../../config/db';

export interface SubjectSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface CourseWithSubjects {
  id: string;
  name: string;
  code: string;
  description: string | null;
  subjects: SubjectSummary[];
}

export async function getMyCourses(
  userId: string,
  role: string
): Promise<CourseWithSubjects[]> {
  let rows: any[];

  if (role === 'teacher') {
    rows = await query(
      `SELECT
         c.id          AS course_id,
         c.name        AS course_name,
         c.code        AS course_code,
         c.description AS course_description,
         json_agg(
           json_build_object(
             'id',          sub.id,
             'name',        sub.name,
             'code',        sub.code,
             'description', sub.description
           ) ORDER BY sub.name
         ) AS subjects
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       JOIN   subject_teachers st ON st.subject_id = sub.id
       WHERE  st.teacher_id = $1
         AND  sub.is_active = true
         AND  c.is_active   = true
       GROUP  BY c.id, c.name, c.code, c.description
       ORDER  BY c.name`,
      [userId]
    );
  } else if (role === 'student') {
    rows = await query(
      `SELECT
         c.id          AS course_id,
         c.name        AS course_name,
         c.code        AS course_code,
         c.description AS course_description,
         json_agg(
           json_build_object(
             'id',          sub.id,
             'name',        sub.name,
             'code',        sub.code,
             'description', sub.description
           ) ORDER BY sub.name
         ) AS subjects
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       JOIN   subject_enrollments se ON se.subject_id = sub.id
       WHERE  se.student_id        = $1
         AND  se.enrollment_status = 'active'
         AND  sub.is_active        = true
         AND  c.is_active          = true
       GROUP  BY c.id, c.name, c.code, c.description
       ORDER  BY c.name`,
      [userId]
    );
  } else {
    // admin — all active courses + subjects
    rows = await query(
      `SELECT
         c.id          AS course_id,
         c.name        AS course_name,
         c.code        AS course_code,
         c.description AS course_description,
         json_agg(
           json_build_object(
             'id',          sub.id,
             'name',        sub.name,
             'code',        sub.code,
             'description', sub.description
           ) ORDER BY sub.name
         ) AS subjects
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       WHERE  c.is_active   = true
         AND  sub.is_active = true
       GROUP  BY c.id, c.name, c.code, c.description
       ORDER  BY c.name`
    );
  }

  // No Map grouping needed — PostgreSQL already aggregated subjects per course
  return rows.map((row) => ({
    id:          row.course_id,
    name:        row.course_name,
    code:        row.course_code,
    description: row.course_description,
    subjects:    row.subjects ?? [],
  }));
}
