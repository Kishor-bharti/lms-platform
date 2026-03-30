import { query } from '../../config/db';

export interface AssignmentSummary {
  id: string;
  subject_id: string;
  topic_id: string | null;
  topic_name?: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  duration_days: number | null;
  max_marks: number;
  is_published: boolean;
  attachment_url: string | null;
  created_at: string;
  created_by?: string;
  creator_name?: string;
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
  feedback_file_url: string | null;
  status: string;
}

// ---- Teacher: get assignments for a subject ----

export async function getAssignmentsBySubject(
  subjectId: string,
  requesterId?: string
): Promise<AssignmentSummary[]> {
  // Check if requester is admin
  let isAdmin = false;
  if (requesterId) {
    const adminCheck = await query<any>(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.name = 'admin'`,
      [requesterId]
    );
    isAdmin = adminCheck.length > 0;
  }

  let sql: string;
  let params: any[];

  if (requesterId && !isAdmin) {
    // Teacher: only count submissions from students they assigned
    sql = `
      SELECT
        a.id, a.subject_id, a.topic_id, t.name AS topic_name,
        a.title, a.description, a.created_by,
        u.first_name || ' ' || u.last_name AS creator_name,
        a.due_date, a.duration_days, a.max_marks, a.is_published, a.attachment_url, a.created_at,
        COUNT(sub.id) FILTER (WHERE sub.status != 'pending' AND EXISTS (
          SELECT 1 FROM student_content_assignments sca
          WHERE sca.content_type = 'assignment'
            AND sca.content_id = a.id
            AND sca.student_id = sub.student_id
            AND sca.assigned_by = $2
        )) AS submission_count
      FROM assignments a
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
      LEFT JOIN topics t ON t.id = a.topic_id
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.subject_id = $1
      GROUP BY a.id, t.name, u.first_name, u.last_name
      ORDER BY a.created_at DESC`;
    params = [subjectId, requesterId];
  } else {
    // Admin: count all submissions
    sql = `
      SELECT
        a.id, a.subject_id, a.topic_id, t.name AS topic_name,
        a.title, a.description, a.created_by,
        u.first_name || ' ' || u.last_name AS creator_name,
        a.due_date, a.duration_days, a.max_marks, a.is_published, a.attachment_url, a.created_at,
        COUNT(sub.id) FILTER (WHERE sub.status != 'pending') AS submission_count
      FROM assignments a
      LEFT JOIN assignment_submissions sub ON sub.assignment_id = a.id
      LEFT JOIN topics t ON t.id = a.topic_id
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.subject_id = $1
      GROUP BY a.id, t.name, u.first_name, u.last_name
      ORDER BY a.created_at DESC`;
    params = [subjectId];
  }

  const rows = await query<any>(sql, params);

  return rows.map((r: any) => ({
    ...r,
    max_marks: Number(r.max_marks),
    submission_count: Number(r.submission_count),
    duration_days: r.duration_days ? Number(r.duration_days) : null,
  }));
}

// ---- Student: get assignments with my submission status ----
// Visibility: student sees an assignment if:
//   (a) a teacher has explicitly assigned it via student_content_assignments, OR
//   (b) legacy: assignment.assigned_to IS NULL (all enrolled students), OR
//   (c) legacy: assignment.assigned_to = this student

export async function getStudentAssignments(
  subjectId: string,
  studentId: string
): Promise<AssignmentSummary[]> {
  const rows = await query<any>(`
    SELECT
      a.id, a.subject_id, a.topic_id, t.name AS topic_name,
      a.title, a.description,
      a.due_date, a.duration_days, a.max_marks, a.is_published, a.attachment_url, a.created_at,
      a.created_by,
      cu.first_name || ' ' || cu.last_name AS creator_name,
      sub.id           AS sub_id,
      sub.submission_url, sub.notes, sub.submitted_at,
      sub.is_late, sub.marks_awarded, sub.feedback, sub.feedback_file_url, sub.status AS sub_status,
      sca.assigned_at AS student_assigned_at,
      sca.due_date AS student_due_date,
      au.first_name || ' ' || au.last_name AS assigned_by_name
    FROM assignments a
    LEFT JOIN assignment_submissions sub
      ON sub.assignment_id = a.id AND sub.student_id = $2
    LEFT JOIN topics t ON t.id = a.topic_id
    LEFT JOIN users cu ON cu.id = a.created_by
    LEFT JOIN student_content_assignments sca
      ON sca.content_type = 'assignment' AND sca.content_id = a.id AND sca.student_id = $2
    LEFT JOIN users au ON au.id = sca.assigned_by
    WHERE a.subject_id = $1
      AND (
        sca.id IS NOT NULL
        OR (
          a.is_published = true
          AND (a.assigned_to IS NULL OR a.assigned_to = $2)
        )
      )
    ORDER BY a.due_date ASC NULLS LAST
  `, [subjectId, studentId]);

  return rows.map((r: any) => ({
    id: r.id,
    subject_id: r.subject_id,
    topic_id: r.topic_id ?? null,
    topic_name: r.topic_name ?? null,
    title: r.title,
    description: r.description,
    due_date: r.student_due_date ?? r.due_date,
    duration_days: r.duration_days ? Number(r.duration_days) : null,
    max_marks: Number(r.max_marks),
    is_published: r.is_published,
    attachment_url: r.attachment_url,
    created_at: r.created_at,
    created_by: r.created_by,
    creator_name: r.creator_name,
    student_assigned_at: r.student_assigned_at,
    assigned_by_name: r.assigned_by_name,
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
      feedback_file_url: r.feedback_file_url ?? null,
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
  duration_days?: number;
  max_marks?: number;
  attachment_url?: string;
  topicId?: string;
  assignedTo?: string;
}): Promise<AssignmentSummary> {
  const rows = await query<any>(`
    INSERT INTO assignments
      (subject_id, created_by, title, description, duration_days, max_marks, attachment_url, topic_id, assigned_to, is_published)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)
    RETURNING id, subject_id, topic_id, title, description, duration_days, max_marks,
              is_published, attachment_url, created_at, assigned_to
  `, [
    data.subjectId, data.createdBy, data.title,
    data.description ?? null, data.duration_days ?? null,
    data.max_marks ?? 100, data.attachment_url ?? null,
    data.topicId ?? null, data.assignedTo ?? null,
  ]);

  return { ...rows[0], max_marks: Number(rows[0].max_marks), submission_count: 0, due_date: null };
}

// ---- Teacher/Admin: update assignment ----

export async function updateAssignment(
  assignmentId: string,
  requesterId: string,
  data: {
    title?: string;
    description?: string;
    duration_days?: number | null;
    max_marks?: number;
    attachment_url?: string;
    topicId?: string;
    assignedTo?: string | null;
  }
): Promise<AssignmentSummary> {
  // Build dynamic SET clause
  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.title !== undefined) { sets.push(`title = $${idx++}`); params.push(data.title); }
  if (data.description !== undefined) { sets.push(`description = $${idx++}`); params.push(data.description); }
  if (data.duration_days !== undefined) { sets.push(`duration_days = $${idx++}`); params.push(data.duration_days); }
  if (data.max_marks !== undefined) { sets.push(`max_marks = $${idx++}`); params.push(data.max_marks); }
  if (data.attachment_url !== undefined) { sets.push(`attachment_url = $${idx++}`); params.push(data.attachment_url); }
  if (data.topicId !== undefined) { sets.push(`topic_id = $${idx++}`); params.push(data.topicId || null); }
  if (data.assignedTo !== undefined) { sets.push(`assigned_to = $${idx++}`); params.push(data.assignedTo || null); }

  if (sets.length === 0) throw new Error('No fields to update');

  sets.push(`updated_at = now()`);
  params.push(assignmentId);
  params.push(requesterId);

  const rows = await query<any>(`
    UPDATE assignments SET ${sets.join(', ')}
    WHERE id = $${idx++}
      AND (
        created_by = $${idx}
        OR EXISTS (
          SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $${idx} AND r.name = 'admin'
        )
      )
    RETURNING id, subject_id, topic_id, title, description, duration_days, due_date, max_marks,
              is_published, attachment_url, created_at, assigned_to, created_by
  `, params);

  if (!rows[0]) throw new Error('FORBIDDEN');
  return { ...rows[0], max_marks: Number(rows[0].max_marks) };
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
      AND (
        (created_by = $2 AND is_published = false)
        OR EXISTS (
          SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $2 AND r.name = 'admin'
        )
      )
    RETURNING id
  `, [assignmentId, requesterId]);

  if (!result[0]) throw new Error('FORBIDDEN');
}

// ---- Teacher: get all submissions for an assignment ----

export async function getSubmissions(assignmentId: string, teacherId?: string): Promise<SubmissionSummary[]> {
  let sql: string;
  let params: any[];

  if (teacherId) {
    // Teacher: only see submissions from students they assigned this content to
    sql = `
      SELECT
        sub.id, sub.assignment_id, sub.student_id,
        u.first_name || ' ' || u.last_name AS student_name,
        u.email AS student_email,
        sub.submission_url, sub.notes, sub.submitted_at,
        sub.is_late, sub.marks_awarded, sub.feedback, sub.feedback_file_url, sub.status
      FROM assignment_submissions sub
      JOIN users u ON u.id = sub.student_id
      WHERE sub.assignment_id = $1
        AND EXISTS (
          SELECT 1 FROM student_content_assignments sca
          WHERE sca.content_type = 'assignment'
            AND sca.content_id = $1
            AND sca.student_id = sub.student_id
            AND sca.assigned_by = $2
        )
      ORDER BY sub.submitted_at ASC NULLS LAST`;
    params = [assignmentId, teacherId];
  } else {
    // Admin: see all submissions
    sql = `
      SELECT
        sub.id, sub.assignment_id, sub.student_id,
        u.first_name || ' ' || u.last_name AS student_name,
        u.email AS student_email,
        sub.submission_url, sub.notes, sub.submitted_at,
        sub.is_late, sub.marks_awarded, sub.feedback, sub.feedback_file_url, sub.status
      FROM assignment_submissions sub
      JOIN users u ON u.id = sub.student_id
      WHERE sub.assignment_id = $1
      ORDER BY sub.submitted_at ASC NULLS LAST`;
    params = [assignmentId];
  }

  const rows = await query<any>(sql, params);

  return rows.map((r: any) => ({
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
  // Check due_date from student_content_assignments first, then fall back to assignments.due_date
  const dueDateRows = await query<any>(`
    SELECT
      COALESCE(sca.due_date, a.due_date) AS effective_due_date
    FROM assignments a
    LEFT JOIN student_content_assignments sca
      ON sca.content_type = 'assignment' AND sca.content_id = a.id AND sca.student_id = $2
    WHERE a.id = $1
  `, [data.assignmentId, data.studentId]);

  if (!dueDateRows[0]) throw new Error('Assignment not found');

  // Block resubmission if already graded
  const existingSub = await query<any>(
    `SELECT status FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2`,
    [data.assignmentId, data.studentId]
  );
  if (existingSub[0]?.status === 'graded') {
    throw new Error('ALREADY_GRADED');
  }

  const isLate = dueDateRows[0].effective_due_date
    ? new Date() > new Date(dueDateRows[0].effective_due_date)
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
  feedback_file_url?: string;
}): Promise<SubmissionSummary> {
  const rows = await query<any>(`
    UPDATE assignment_submissions SET
      marks_awarded     = $1,
      feedback          = $2,
      feedback_file_url = $3,
      graded_by         = $4,
      graded_at         = now(),
      status            = 'graded'
    WHERE id = $5
    RETURNING id, assignment_id, student_id, submission_url, notes,
              submitted_at, is_late, marks_awarded, feedback, feedback_file_url, status
  `, [data.marks_awarded, data.feedback ?? null, data.feedback_file_url ?? null, data.graderId, data.submissionId]);

  if (!rows[0]) throw new Error('Submission not found');
  return rows[0];
}
