import { query } from '../../config/db';
import { deleteFilesByUrls, signFileFields } from '../../utils/storage';

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

  const FILE_FIELDS: (keyof StudentUpload)[] = ['file_url', 'feedback_file_url'];

  if (role === 'admin') {
    const rows = await query<any>(`SELECT ${cols} ${joins} WHERE su.subject_id = $1 ORDER BY su.created_at DESC`, [subjectId]);
    return Promise.all(rows.map((r: any) => signFileFields(r, FILE_FIELDS)));
  }

  // Teacher: uploads from their assigned students where
  // either the student sent it to this teacher specifically, or to no specific teacher (shared)
  const rows = await query<any>(`
    SELECT ${cols} ${joins}
    WHERE su.subject_id = $1
      AND (su.teacher_id = $2 OR su.teacher_id IS NULL)
      AND EXISTS (
        SELECT 1 FROM subject_teacher_students sts
        WHERE sts.subject_id = $1 AND sts.teacher_id = $2 AND sts.student_id = su.student_id
      )
    ORDER BY su.created_at DESC
  `, [subjectId, userId]);
  return Promise.all(rows.map((r: any) => signFileFields(r, FILE_FIELDS)));
}

// ---- Student: get own uploads for a subject ----

export async function getMyUploads(
  subjectId: string,
  studentId: string
): Promise<StudentUpload[]> {
  const rows = await query<any>(`
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
  return Promise.all(rows.map((r: any) => signFileFields(r, ['file_url', 'feedback_file_url'])));
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

  return signFileFields(rows[0], ['file_url']);
}

// ---- Teacher/Admin: add feedback to an upload ----

export async function addFeedback(
  uploadId: string,
  teacherId: string,
  role: string,
  feedbackText?: string,
  feedbackFileUrl?: string
): Promise<StudentUpload> {
  if (role === 'admin') {
    const rows = await query<any>(`
      UPDATE student_uploads
      SET feedback_text = $1, feedback_file_url = $2
      WHERE id = $3
      RETURNING id, subject_id, student_id, teacher_id, topic_id,
                title, description, file_url, file_name,
                feedback_text, feedback_file_url, created_at
    `, [feedbackText ?? null, feedbackFileUrl ?? null, uploadId]);
    if (!rows[0]) throw new Error('FORBIDDEN');
    return signFileFields(rows[0], ['file_url', 'feedback_file_url']);
  }

  // Teacher can only give feedback on their students' uploads
  const rows = await query<any>(`
    UPDATE student_uploads
    SET feedback_text = $1, feedback_file_url = $2
    WHERE id = $4
      AND EXISTS (
        SELECT 1 FROM subject_teacher_students sts
        WHERE sts.subject_id = student_uploads.subject_id AND sts.teacher_id = $3 AND sts.student_id = student_uploads.student_id
      )
    RETURNING id, subject_id, student_id, teacher_id, topic_id,
              title, description, file_url, file_name,
              feedback_text, feedback_file_url, created_at
  `, [feedbackText ?? null, feedbackFileUrl ?? null, teacherId, uploadId]);

  if (!rows[0]) throw new Error('FORBIDDEN');
  return signFileFields(rows[0], ['file_url', 'feedback_file_url']);
}

// ---- Student: delete own upload ----

export async function deleteUpload(uploadId: string, studentId: string): Promise<void> {
  const fileRows = await query<any>(`
    SELECT file_url, feedback_file_url FROM student_uploads WHERE id = $1 AND student_id = $2
  `, [uploadId, studentId]);

  const result = await query<any>(
    `DELETE FROM student_uploads WHERE id = $1 AND student_id = $2 RETURNING id`,
    [uploadId, studentId]
  );
  if (!result[0]) throw new Error('FORBIDDEN');

  const filesToDelete = new Set<string>();
  if (fileRows[0]?.file_url) filesToDelete.add(fileRows[0].file_url);
  if (fileRows[0]?.feedback_file_url) filesToDelete.add(fileRows[0].feedback_file_url);
  if (filesToDelete.size > 0) {
    await deleteFilesByUrls(Array.from(filesToDelete));
  }
}

export async function deleteUploadAsAdmin(uploadId: string): Promise<void> {
  const fileRows = await query<any>(`
    SELECT file_url, feedback_file_url FROM student_uploads WHERE id = $1
  `, [uploadId]);

  const result = await query<any>(
    `DELETE FROM student_uploads WHERE id = $1 RETURNING id`,
    [uploadId]
  );
  if (!result[0]) throw new Error('NOT_FOUND');

  const filesToDelete = new Set<string>();
  if (fileRows[0]?.file_url) filesToDelete.add(fileRows[0].file_url);
  if (fileRows[0]?.feedback_file_url) filesToDelete.add(fileRows[0].feedback_file_url);
  if (filesToDelete.size > 0) {
    await deleteFilesByUrls(Array.from(filesToDelete));
  }
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
