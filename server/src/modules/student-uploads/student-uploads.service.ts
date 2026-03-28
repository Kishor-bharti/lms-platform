import { query } from '../../config/db';

export interface StudentUpload {
  id: string;
  subject_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
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
  let sql: string;
  let params: any[];

  if (role === 'admin') {
    sql = `
      SELECT
        su.id, su.subject_id, su.student_id,
        us.first_name || ' ' || us.last_name AS student_name,
        us.email AS student_email,
        su.teacher_id,
        ut.first_name || ' ' || ut.last_name AS teacher_name,
        su.title, su.description, su.file_url, su.file_name, su.created_at
      FROM student_uploads su
      JOIN users us ON us.id = su.student_id
      LEFT JOIN users ut ON ut.id = su.teacher_id
      WHERE su.subject_id = $1
      ORDER BY su.created_at DESC`;
    params = [subjectId];
  } else {
    // Teacher: only uploads from their assigned students
    sql = `
      SELECT
        su.id, su.subject_id, su.student_id,
        us.first_name || ' ' || us.last_name AS student_name,
        us.email AS student_email,
        su.teacher_id,
        ut.first_name || ' ' || ut.last_name AS teacher_name,
        su.title, su.description, su.file_url, su.file_name, su.created_at
      FROM student_uploads su
      JOIN users us ON us.id = su.student_id
      LEFT JOIN users ut ON ut.id = su.teacher_id
      WHERE su.subject_id = $1
        AND EXISTS (
          SELECT 1 FROM subject_teacher_students sts
          WHERE sts.subject_id = $1
            AND sts.teacher_id = $2
            AND sts.student_id = su.student_id
        )
      ORDER BY su.created_at DESC`;
    params = [subjectId, userId];
  }

  return query<any>(sql, params);
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
      su.title, su.description, su.file_url, su.file_name, su.created_at
    FROM student_uploads su
    LEFT JOIN users ut ON ut.id = su.teacher_id
    WHERE su.subject_id = $1 AND su.student_id = $2
    ORDER BY su.created_at DESC
  `, [subjectId, studentId]);

  return rows;
}

// ---- Student: create an upload ----

export async function createUpload(data: {
  subjectId: string;
  studentId: string;
  teacherId?: string;
  title: string;
  description?: string;
  file_url: string;
  file_name?: string;
}): Promise<StudentUpload> {
  const rows = await query<any>(`
    INSERT INTO student_uploads
      (subject_id, student_id, teacher_id, title, description, file_url, file_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, subject_id, student_id, teacher_id, title, description, file_url, file_name, created_at
  `, [
    data.subjectId, data.studentId, data.teacherId ?? null,
    data.title, data.description ?? null, data.file_url, data.file_name ?? null,
  ]);

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
