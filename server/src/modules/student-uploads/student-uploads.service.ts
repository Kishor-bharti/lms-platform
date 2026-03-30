import { query } from '../../config/db';

export interface StudentUpload {
  id: string;
  subject_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  topic_id: string | null;
  topic_name?: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  feedback_text: string | null;
  feedback_file_url: string | null;
  created_at: string;
}

// ---- Get uploads for a subject (role-scoped) ----
// Admin: sees all uploads with student + teacher info
// Teacher: sees only uploads from their assigned students

export async function getUploads(
  subjectId: string,
  role: string,
  userId: string
): Promise<StudentUpload[]> {
  const cols = `
    su.id, su.subject_id, su.student_id,
    us.first_name || ' ' || us.last_name AS student_name,
    us.email AS student_email,
    su.teacher_id,
    ut.first_name || ' ' || ut.last_name AS teacher_name,
    su.topic_id, t.name AS topic_name,
    su.title, su.description, su.file_url, su.file_name,
    su.feedback_text, su.feedback_file_url, su.created_at`;

  const joins = `
    FROM student_uploads su
    JOIN users us ON us.id = su.student_id
    LEFT JOIN users ut ON ut.id = su.teacher_id
    LEFT JOIN topics t ON t.id = su.topic_id`;

  if (role === 'admin') {
    return query<any>(`SELECT ${cols} ${joins} WHERE su.subject_id = $1 ORDER BY su.created_at DESC`, [subjectId]);
  }

  // Teacher: only uploads from their assigned students
  return query<any>(`
    SELECT ${cols} ${joins}
    WHERE su.subject_id = $1
      AND EXISTS (
        SELECT 1 FROM subject_teacher_students sts
        WHERE sts.subject_id = $1 AND sts.teacher_id = $2 AND sts.student_id = su.student_id
      )
    ORDER BY su.created_at DESC
  `, [subjectId, userId]);
}

// ---- Student: get own uploads for a subject ----

export async function getMyUploads(
  subjectId: string,
  studentId: string
): Promise<StudentUpload[]> {
  return query<any>(`
    SELECT
      su.id, su.subject_id, su.student_id, su.teacher_id,
      ut.first_name || ' ' || ut.last_name AS teacher_name,
      su.topic_id, t.name AS topic_name,
      su.title, su.description, su.file_url, su.file_name,
      su.feedback_text, su.feedback_file_url, su.created_at
    FROM student_uploads su
    LEFT JOIN users ut ON ut.id = su.teacher_id
    LEFT JOIN topics t ON t.id = su.topic_id
    WHERE su.subject_id = $1 AND su.student_id = $2
    ORDER BY su.created_at DESC
  `, [subjectId, studentId]);
}

// ---- Student: create an upload ----

export async function createUpload(data: {
  subjectId: string;
  studentId: string;
  teacherId?: string;
  topicId?: string;
  title: string;
  description?: string;
  file_url: string;
  file_name?: string;
}): Promise<StudentUpload> {
  const rows = await query<any>(`
    INSERT INTO student_uploads
      (subject_id, student_id, teacher_id, topic_id, title, description, file_url, file_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, subject_id, student_id, teacher_id, topic_id, title, description, file_url, file_name, created_at
  `, [
    data.subjectId, data.studentId, data.teacherId ?? null, data.topicId ?? null,
    data.title, data.description ?? null, data.file_url, data.file_name ?? null,
  ]);

  return rows[0];
}

// ---- Teacher/Admin: add feedback to an upload ----

export async function addFeedback(
  uploadId: string,
  teacherId: string,
  role: string,
  feedbackText?: string,
  feedbackFileUrl?: string
): Promise<StudentUpload> {
  // Teacher can only give feedback on their students' uploads
  const roleFilter = role === 'admin'
    ? ''
    : `AND EXISTS (
        SELECT 1 FROM subject_teacher_students sts
        WHERE sts.subject_id = su.subject_id AND sts.teacher_id = $3 AND sts.student_id = su.student_id
      )`;

  const rows = await query<any>(`
    UPDATE student_uploads su
    SET feedback_text = $1, feedback_file_url = $2
    WHERE su.id = $4 ${roleFilter}
    RETURNING su.id, su.subject_id, su.student_id, su.teacher_id, su.topic_id,
              su.title, su.description, su.file_url, su.file_name,
              su.feedback_text, su.feedback_file_url, su.created_at
  `, [feedbackText ?? null, feedbackFileUrl ?? null, teacherId, uploadId]);

  if (!rows[0]) throw new Error('FORBIDDEN');
  return rows[0];
}

// ---- Student: delete own upload ----

export async function deleteUpload(uploadId: string, studentId: string): Promise<void> {
  const result = await query<any>(
    `DELETE FROM student_uploads WHERE id = $1 AND student_id = $2 RETURNING id`,
    [uploadId, studentId]
  );
  if (!result[0]) throw new Error('FORBIDDEN');
}

// ---- Get teachers assigned to a specific student in a subject ----

export async function getStudentTeachers(
  subjectId: string,
  studentId: string
): Promise<{ id: string; first_name: string; last_name: string }[]> {
  return query<any>(`
    SELECT DISTINCT u.id, u.first_name, u.last_name
    FROM subject_teacher_students sts
    JOIN users u ON u.id = sts.teacher_id
    WHERE sts.subject_id = $1 AND sts.student_id = $2
    ORDER BY u.first_name, u.last_name
  `, [subjectId, studentId]);
}
