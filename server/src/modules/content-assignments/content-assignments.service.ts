import { query } from '../../config/db';

export interface ContentAssignment {
  id: string;
  subject_id: string | null;
  course_id: string | null;
  content_type: 'quiz' | 'assignment' | 'material';
  content_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  assigned_by: string;
  assigner_name: string;
  assigned_at: string;
  due_date: string | null;
}

/**
 * Assign one or more students to a content item.
 * Silently skips duplicates (ON CONFLICT DO NOTHING).
 * Pass subjectId for subject-level content, courseId for course-level content.
 */
export async function assignContent(data: {
  subjectId?: string;
  courseId?: string;
  contentType: 'quiz' | 'assignment' | 'material';
  contentId: string;
  studentIds: string[];
  assignedBy: string;
}): Promise<void> {
  // For assignments with duration_days, auto-calculate due_date per student
  let dueDate: string | null = null;
  if (data.contentType === 'assignment') {
    const rows = await query<any>(
      `SELECT duration_days FROM assignments WHERE id = $1`,
      [data.contentId]
    );
    if (rows[0]?.duration_days) {
      const due = new Date();
      due.setDate(due.getDate() + rows[0].duration_days);
      dueDate = due.toISOString();
    }
  }

  for (const studentId of data.studentIds) {
    await query(
      `INSERT INTO student_content_assignments
         (subject_id, course_id, content_type, content_id, student_id, assigned_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (content_type, content_id, student_id) DO NOTHING`,
      [data.subjectId ?? null, data.courseId ?? null, data.contentType, data.contentId, studentId, data.assignedBy, dueDate]
    );
  }
}

/**
 * Get all students enrolled in any subject of a course.
 * Teachers get only their own allocated students; admins get all enrolled.
 */
export async function getCourseStudents(
  courseId: string,
  teacherId?: string
): Promise<Array<{ id: string; first_name: string; last_name: string; email: string }>> {
  if (teacherId) {
    return query<any>(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
       FROM subject_teacher_students sts
       JOIN subjects sub ON sub.id = sts.subject_id AND sub.course_id = $1
       JOIN users u ON u.id = sts.student_id
       WHERE sts.teacher_id = $2
       ORDER BY u.first_name, u.last_name`,
      [courseId, teacherId]
    );
  }
  return query<any>(
    `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
     FROM subject_enrollments se
     JOIN subjects sub ON sub.id = se.subject_id AND sub.course_id = $1
     JOIN users u ON u.id = se.student_id
     WHERE se.enrollment_status = 'active'
     ORDER BY u.first_name, u.last_name`,
    [courseId]
  );
}

/**
 * Get all assignments scoped to a course (for the CourseQuiz admin view).
 */
export async function getAssignmentsForCourse(
  courseId: string
): Promise<ContentAssignment[]> {
  const rows = await query<any>(
    `SELECT sca.id, sca.subject_id, sca.course_id, sca.content_type, sca.content_id,
            sca.student_id,
            u.first_name || ' ' || u.last_name AS student_name,
            u.email AS student_email,
            sca.assigned_by,
            ab.first_name || ' ' || ab.last_name AS assigner_name,
            sca.assigned_at,
            sca.due_date
     FROM student_content_assignments sca
     JOIN users u  ON u.id  = sca.student_id
     JOIN users ab ON ab.id = sca.assigned_by
     WHERE sca.course_id = $1
     ORDER BY sca.assigned_at DESC`,
    [courseId]
  );
  return rows;
}

/**
 * Revoke a single content assignment by its UUID.
 */
export async function revokeAssignment(assignmentId: string): Promise<void> {
  await query(
    `DELETE FROM student_content_assignments WHERE id = $1`,
    [assignmentId]
  );
}

/**
 * Get all assignments for a specific content item.
 */
export async function getAssignmentsForContent(
  contentType: string,
  contentId: string
): Promise<ContentAssignment[]> {
  const rows = await query<any>(
    `SELECT sca.id, sca.subject_id, sca.content_type, sca.content_id,
            sca.student_id,
            u.first_name || ' ' || u.last_name AS student_name,
            u.email AS student_email,
            sca.assigned_by,
            ab.first_name || ' ' || ab.last_name AS assigner_name,
            sca.assigned_at,
            sca.due_date
     FROM student_content_assignments sca
     JOIN users u  ON u.id  = sca.student_id
     JOIN users ab ON ab.id = sca.assigned_by
     WHERE sca.content_type = $1 AND sca.content_id = $2
     ORDER BY sca.assigned_at DESC`,
    [contentType, contentId]
  );
  return rows;
}

/**
 * Get all assignments for a subject (admin / teacher overview).
 */
export async function getAssignmentsForSubject(
  subjectId: string
): Promise<ContentAssignment[]> {
  const rows = await query<any>(
    `SELECT sca.id, sca.subject_id, sca.content_type, sca.content_id,
            sca.student_id,
            u.first_name || ' ' || u.last_name AS student_name,
            u.email AS student_email,
            sca.assigned_by,
            ab.first_name || ' ' || ab.last_name AS assigner_name,
            sca.assigned_at,
            sca.due_date
     FROM student_content_assignments sca
     JOIN users u  ON u.id  = sca.student_id
     JOIN users ab ON ab.id = sca.assigned_by
     WHERE sca.subject_id = $1
     ORDER BY sca.assigned_at DESC`,
    [subjectId]
  );
  return rows;
}

/**
 * Check whether a specific student has been assigned a content item.
 */
export async function isContentAssigned(
  contentType: string,
  contentId: string,
  studentId: string
): Promise<boolean> {
  const rows = await query<any>(
    `SELECT 1 FROM student_content_assignments
     WHERE content_type = $1 AND content_id = $2 AND student_id = $3`,
    [contentType, contentId, studentId]
  );
  return rows.length > 0;
}
