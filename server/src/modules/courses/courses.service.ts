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
    // Courses where this teacher has at least one assigned subject
    rows = await query(
      `SELECT DISTINCT
         c.id   AS course_id,
         c.name AS course_name,
         c.code AS course_code,
         c.description AS course_description,
         sub.id   AS subject_id,
         sub.name AS subject_name,
         sub.code AS subject_code,
         sub.description AS subject_description
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       JOIN   subject_teachers st ON st.subject_id = sub.id
       WHERE  st.teacher_id = $1
         AND  sub.is_active = true
         AND  c.is_active   = true
       ORDER  BY c.name, sub.name`,
      [userId]
    );
  } else if (role === 'student') {
    // Courses where this student is enrolled in at least one subject
    rows = await query(
      `SELECT DISTINCT
         c.id   AS course_id,
         c.name AS course_name,
         c.code AS course_code,
         c.description AS course_description,
         sub.id   AS subject_id,
         sub.name AS subject_name,
         sub.code AS subject_code,
         sub.description AS subject_description
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       JOIN   subject_enrollments se ON se.subject_id = sub.id
       WHERE  se.student_id        = $1
         AND  se.enrollment_status = 'active'
         AND  sub.is_active        = true
         AND  c.is_active          = true
       ORDER  BY c.name, sub.name`,
      [userId]
    );
  } else {
    // admin — all active courses + subjects
    rows = await query(
      `SELECT
         c.id   AS course_id,
         c.name AS course_name,
         c.code AS course_code,
         c.description AS course_description,
         sub.id   AS subject_id,
         sub.name AS subject_name,
         sub.code AS subject_code,
         sub.description AS subject_description
       FROM   courses c
       JOIN   subjects sub ON sub.course_id = c.id
       WHERE  c.is_active   = true
         AND  sub.is_active = true
       ORDER  BY c.name, sub.name`
    );
  }

  // Group subjects under their courses
  const courseMap = new Map<string, CourseWithSubjects>();

  for (const row of rows) {
    if (!courseMap.has(row.course_id)) {
      courseMap.set(row.course_id, {
        id:          row.course_id,
        name:        row.course_name,
        code:        row.course_code,
        description: row.course_description,
        subjects:    [],
      });
    }
    courseMap.get(row.course_id)!.subjects.push({
      id:          row.subject_id,
      name:        row.subject_name,
      code:        row.subject_code,
      description: row.subject_description,
    });
  }

  return Array.from(courseMap.values());
}
