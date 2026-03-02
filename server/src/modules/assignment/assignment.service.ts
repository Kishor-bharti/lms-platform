import { query } from '../../config/db';

export interface AssignmentSummary {
  id: string;
  subject_id: string;
  topic_id: string | null;
  topic_name?: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  max_marks: number;
  is_published: boolean;
  attachment_url: string | null;
  created_at: string;
  submission_count?: number;
  my_submission?: SubmissionSummary | null;
}

export interface SubmissionSummary {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  student_email?: string;
  submission_url: string | null;
  notes: string | null;
  submitted_at: string | null;
  is_late: boolean;
  marks_awarded: number | null;
  feedback: string | null;
  status: string;
}

// ---- Teacher: get assignments for a subject ----

export async function getAssignmentsBySubject(
  subjectId: string,
  teacherId?: string
): Promise<AssignmentSummary[]> {
  const rows = await query<any>(`
    SELECT
      a.id, a.subject_id, a.topic_id, t.name AS topic_name,
      a.title, a.description, a.created_by,
      u.first_name || ' ' || u.last_name AS creator_name,
      a.due_date, a.max_marks, a.is_published, a.attachment_url, a.created_at,
      COUNT(sub.id) FILTER (WHERE sub.status != 'pending') AS submission_count
    FROM assignments a
    LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
    LEFT JOIN topics t ON t.id = a.topic_id
    LEFT JOIN users u ON u.id = a.created_by
    WHERE a.subject_id = $1
    GROUP BY a.id, t.name, u.first_name, u.last_name
    ORDER BY a.created_at DESC
  `, [subjectId]);

  return rows.map((r) => ({
    ...r,
    max_marks: Number(r.max_marks),
    submission_count: Number(r.submission_count),
  }));
}

// ---- Student: get assignments with my submission status ----

export async function getStudentAssignments(
  subjectId: string,
  studentId: string
): Promise<AssignmentSummary[]> {
  const rows = await query<any>(`
    SELECT
      a.id, a.subject_id, a.topic_id, t.name AS topic_name,
      a.title, a.description,
      a.due_date, a.max_marks, a.is_published, a.attachment_url, a.created_at,
      sub.id           AS sub_id,
      sub.submission_url, sub.notes, sub.submitted_at,
      sub.is_late, sub.marks_awarded, sub.feedback, sub.status AS sub_status
    FROM assignments a
    LEFT JOIN assignment_submissions sub
      ON sub.assignment_id = a.id AND sub.student_id = $2
    LEFT JOIN topics t ON t.id = a.topic_id
    WHERE a.subject_id = $1 AND a.is_published = true
    ORDER BY a.due_date ASC NULLS LAST
  `, [subjectId, studentId]);

  return rows.map((r) => ({
    id: r.id,
    subject_id: r.subject_id,
    topic_id: r.topic_id ?? null,
    topic_name: r.topic_name ?? null,
    title: r.title,
    description: r.description,
    due_date: r.due_date,
    max_marks: Number(r.max_marks),
    is_published: r.is_published,
    attachment_url: r.attachment_url,
    created_at: r.created_at,
    my_submission: r.sub_id ? {
      id: r.sub_id,
      assignment_id: r.id,
      student_id: studentId,
      submission_url: r.submission_url,
      notes: r.notes,
      submitted_at: r.submitted_at,
      is_late: r.is_late,
      marks_awarded: r.marks_awarded ? Number(r.marks_awarded) : null,
      feedback: r.feedback,
      status: r.sub_status,
    } : null,
  }));
}

// ---- Teacher: create assignment ----

export async function createAssignment(data: {
  subjectId: string;
  createdBy: string;
  title: string;
  description?: string;
  due_date?: string;
  max_marks?: number;
  attachment_url?: string;
  topicId?: string;
}): Promise<AssignmentSummary> {
  const rows = await query<any>(`
    INSERT INTO assignments
      (subject_id, created_by, title, description, due_date, max_marks, attachment_url, topic_id, is_published)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
    RETURNING id, subject_id, topic_id, title, description, due_date, max_marks,
              is_published, attachment_url, created_at
  `, [
    data.subjectId, data.createdBy, data.title,
    data.description ?? null, data.due_date ?? null,
    data.max_marks ?? 100, data.attachment_url ?? null,
    data.topicId ?? null,
  ]);

  return { ...rows[0], max_marks: Number(rows[0].max_marks), submission_count: 0 };
}

// ---- Teacher: publish/unpublish ----

export async function setAssignmentPublished(assignmentId: string, published: boolean): Promise<void> {
  await query(`UPDATE assignments SET is_published=$1, updated_at=now() WHERE id=$2`, [published, assignmentId]);
}

// ---- Teacher/Admin: delete assignment (creator or admin only) ----

export async function deleteAssignment(assignmentId: string, requesterId: string): Promise<void> {
  const result = await query<any>(`
    DELETE FROM assignments
    WHERE id = $1
      AND (created_by = $2 OR EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $2 AND r.name = 'admin'
      ))
    RETURNING id
  `, [assignmentId, requesterId]);

  if (!result[0]) throw new Error('FORBIDDEN');
}

// ---- Teacher: get all submissions for an assignment ----

export async function getSubmissions(assignmentId: string): Promise<SubmissionSummary[]> {
  const rows = await query<any>(`
    SELECT
      sub.id, sub.assignment_id, sub.student_id,
      u.first_name || ' ' || u.last_name AS student_name,
      u.email AS student_email,
      sub.submission_url, sub.notes, sub.submitted_at,
      sub.is_late, sub.marks_awarded, sub.feedback, sub.status
    FROM assignment_submissions sub
    JOIN users u ON u.id = sub.student_id
    WHERE sub.assignment_id = $1
    ORDER BY sub.submitted_at ASC NULLS LAST
  `, [assignmentId]);

  return rows.map((r) => ({
    ...r,
    marks_awarded: r.marks_awarded ? Number(r.marks_awarded) : null,
  }));
}

// ---- Student: submit assignment ----

export async function submitAssignment(data: {
  assignmentId: string;
  studentId: string;
  submission_url?: string;
  notes?: string;
}): Promise<SubmissionSummary> {
  const assignmentRows = await query<any>(`SELECT due_date FROM assignments WHERE id=$1`, [data.assignmentId]);
  if (!assignmentRows[0]) throw new Error('Assignment not found');

  const isLate = assignmentRows[0].due_date
    ? new Date() > new Date(assignmentRows[0].due_date)
    : false;

  const rows = await query<any>(`
    INSERT INTO assignment_submissions
      (assignment_id, student_id, submission_url, notes, submitted_at, is_late, status)
    VALUES ($1,$2,$3,$4,now(),$5,'submitted')
    ON CONFLICT (assignment_id, student_id) DO UPDATE SET
      submission_url = EXCLUDED.submission_url,
      notes          = EXCLUDED.notes,
      submitted_at   = now(),
      is_late        = EXCLUDED.is_late,
      status         = 'submitted'
    RETURNING id, assignment_id, student_id, submission_url, notes,
              submitted_at, is_late, marks_awarded, feedback, status
  `, [data.assignmentId, data.studentId, data.submission_url ?? null,
      data.notes ?? null, isLate]);

  return rows[0];
}

// ---- Teacher: grade a submission ----

export async function gradeSubmission(data: {
  submissionId: string;
  graderId: string;
  marks_awarded: number;
  feedback?: string;
}): Promise<SubmissionSummary> {
  const rows = await query<any>(`
    UPDATE assignment_submissions SET
      marks_awarded = $1,
      feedback      = $2,
      graded_by     = $3,
      graded_at     = now(),
      status        = 'graded'
    WHERE id = $4
    RETURNING id, assignment_id, student_id, submission_url, notes,
              submitted_at, is_late, marks_awarded, feedback, status
  `, [data.marks_awarded, data.feedback ?? null, data.graderId, data.submissionId]);

  if (!rows[0]) throw new Error('Submission not found');
  return rows[0];
}
