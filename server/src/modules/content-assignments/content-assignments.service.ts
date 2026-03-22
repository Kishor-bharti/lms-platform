import { query } from '../../config/db';

export interface ContentAssignment {
  id: string;
  subject_id: string;
  content_type: 'quiz' | 'assignment' | 'material';
  content_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  assigned_by: string;
  assigner_name: string;
  assigned_at: string;
}

/**
 * Assign one or more students to a content item.
 * Silently skips duplicates (ON CONFLICT DO NOTHING).
 */
export async function assignContent(data: {
  subjectId: string;
  contentType: 'quiz' | 'assignment' | 'material';
  contentId: string;
  studentIds: string[];
  assignedBy: string;
}): Promise<void> {
  for (const studentId of data.studentIds) {
    await query(
      `INSERT INTO student_content_assignments
         (subject_id, content_type, content_id, student_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (content_type, content_id, student_id) DO NOTHING`,
      [data.subjectId, data.contentType, data.contentId, studentId, data.assignedBy]
    );
  }
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
            sca.assigned_at
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
            sca.assigned_at
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
