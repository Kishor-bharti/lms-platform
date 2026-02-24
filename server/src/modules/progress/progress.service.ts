import { query } from '../../config/db';

export interface SubjectProgress {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  course_name: string;
  quizzes_attempted: number;
  quizzes_passed: number;
  avg_score_pct: number | null;
  best_score_pct: number | null;
  total_time_spent_mins: number;
  assignments_submitted: number;
  assignments_graded: number;
  avg_assignment_marks: number | null;
  max_assignment_marks: number | null;
  last_activity_at: string | null;
}

export interface TeacherSubjectReport {
  subject_id: string;
  subject_name: string;
  course_name: string;
  students: Array<{
    student_id: string;
    student_name: string;
    student_email: string;
    quizzes_attempted: number;
    quizzes_passed: number;
    avg_score_pct: number | null;
    best_score_pct: number | null;
    assignments_submitted: number;
    assignments_graded: number;
    avg_assignment_marks: number | null;
    last_activity_at: string | null;
  }>;
}

// ---- Student: get live progress across all enrolled subjects ----

export async function getStudentProgress(studentId: string): Promise<SubjectProgress[]> {
  // Compute live from raw tables (no reliance on student_progress cache)
  const rows = await query<any>(`
    SELECT
      sub.id            AS subject_id,
      sub.name          AS subject_name,
      sub.code          AS subject_code,
      c.name            AS course_name,

      -- Quiz stats
      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted')                          AS quizzes_attempted,
      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted' AND qa.is_passed = true)  AS quizzes_passed,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted')                          AS avg_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted')                          AS best_score_pct,
      COALESCE(SUM(qa.time_taken_seconds)
        FILTER (WHERE qa.status = 'submitted') / 60, 0)                AS total_time_spent_mins,

      -- Assignment stats
      COUNT(DISTINCT asub.id)
        FILTER (WHERE asub.status IN ('submitted','graded'))            AS assignments_submitted,
      COUNT(DISTINCT asub.id)
        FILTER (WHERE asub.status = 'graded')                          AS assignments_graded,
      AVG(asub.marks_awarded)
        FILTER (WHERE asub.status = 'graded')                          AS avg_assignment_marks,
      AVG(a.max_marks)
        FILTER (WHERE asub.status = 'graded')                          AS max_assignment_marks,

      -- Last activity
      GREATEST(
        MAX(qa.submitted_at) FILTER (WHERE qa.status = 'submitted'),
        MAX(asub.submitted_at) FILTER (WHERE asub.status IN ('submitted','graded'))
      )                                                                  AS last_activity_at

    FROM subject_enrollments se
    JOIN subjects sub ON sub.id = se.subject_id
    JOIN courses  c   ON c.id   = sub.course_id
    LEFT JOIN quizzes   qz    ON qz.subject_id  = sub.id
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.student_id = $1
    LEFT JOIN assignments a    ON a.subject_id  = sub.id
    LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = $1

    WHERE se.student_id = $1 AND se.enrollment_status = 'active'

    GROUP BY sub.id, sub.name, sub.code, c.name
    ORDER BY c.name, sub.name
  `, [studentId]);

  return rows.map((r) => ({
    subject_id:            r.subject_id,
    subject_name:          r.subject_name,
    subject_code:          r.subject_code,
    course_name:           r.course_name,
    quizzes_attempted:     Number(r.quizzes_attempted),
    quizzes_passed:        Number(r.quizzes_passed),
    avg_score_pct:         r.avg_score_pct != null ? Number(Number(r.avg_score_pct).toFixed(1)) : null,
    best_score_pct:        r.best_score_pct != null ? Number(Number(r.best_score_pct).toFixed(1)) : null,
    total_time_spent_mins: Number(r.total_time_spent_mins),
    assignments_submitted: Number(r.assignments_submitted),
    assignments_graded:    Number(r.assignments_graded),
    avg_assignment_marks:  r.avg_assignment_marks != null ? Number(Number(r.avg_assignment_marks).toFixed(1)) : null,
    max_assignment_marks:  r.max_assignment_marks != null ? Number(Number(r.max_assignment_marks).toFixed(1)) : null,
    last_activity_at:      r.last_activity_at ?? null,
  }));
}

// ---- Teacher: get progress for all students in teacher's subjects ----

export async function getTeacherReport(teacherId: string): Promise<TeacherSubjectReport[]> {
  const subjectRows = await query<any>(`
    SELECT sub.id AS subject_id, sub.name AS subject_name, c.name AS course_name
    FROM subject_teachers st
    JOIN subjects sub ON sub.id = st.subject_id
    JOIN courses  c   ON c.id   = sub.course_id
    WHERE st.teacher_id = $1
    ORDER BY c.name, sub.name
  `, [teacherId]);

  const reports: TeacherSubjectReport[] = [];

  for (const subj of subjectRows) {
    const studentRows = await query<any>(`
      SELECT
        u.id            AS student_id,
        u.first_name || ' ' || u.last_name AS student_name,
        u.email         AS student_email,

        COUNT(DISTINCT qa.id)
          FILTER (WHERE qa.status = 'submitted')                          AS quizzes_attempted,
        COUNT(DISTINCT qa.id)
          FILTER (WHERE qa.status = 'submitted' AND qa.is_passed = true)  AS quizzes_passed,
        AVG(qa.score_pct)
          FILTER (WHERE qa.status = 'submitted')                          AS avg_score_pct,
        MAX(qa.score_pct)
          FILTER (WHERE qa.status = 'submitted')                          AS best_score_pct,
        COUNT(DISTINCT asub.id)
          FILTER (WHERE asub.status IN ('submitted','graded'))            AS assignments_submitted,
        COUNT(DISTINCT asub.id)
          FILTER (WHERE asub.status = 'graded')                          AS assignments_graded,
        AVG(asub.marks_awarded)
          FILTER (WHERE asub.status = 'graded')                          AS avg_assignment_marks,
        GREATEST(
          MAX(qa.submitted_at) FILTER (WHERE qa.status = 'submitted'),
          MAX(asub.submitted_at) FILTER (WHERE asub.status IN ('submitted','graded'))
        )                                                                  AS last_activity_at

      FROM subject_enrollments se
      JOIN users u ON u.id = se.student_id
      LEFT JOIN quizzes   qz    ON qz.subject_id  = $1
      LEFT JOIN quiz_attempts qa ON qa.quiz_id = qz.id AND qa.student_id = u.id
      LEFT JOIN assignments    a    ON a.subject_id  = $1
      LEFT JOIN assignment_submissions asub ON asub.assignment_id = a.id AND asub.student_id = u.id

      WHERE se.subject_id = $1 AND se.enrollment_status = 'active'
      GROUP BY u.id, u.first_name, u.last_name, u.email
      ORDER BY student_name
    `, [subj.subject_id]);

    reports.push({
      subject_id:   subj.subject_id,
      subject_name: subj.subject_name,
      course_name:  subj.course_name,
      students: studentRows.map((r: any) => ({
        student_id:            r.student_id,
        student_name:          r.student_name,
        student_email:         r.student_email,
        quizzes_attempted:     Number(r.quizzes_attempted),
        quizzes_passed:        Number(r.quizzes_passed),
        avg_score_pct:         r.avg_score_pct != null ? Number(Number(r.avg_score_pct).toFixed(1)) : null,
        best_score_pct:        r.best_score_pct != null ? Number(Number(r.best_score_pct).toFixed(1)) : null,
        assignments_submitted: Number(r.assignments_submitted),
        assignments_graded:    Number(r.assignments_graded),
        avg_assignment_marks:  r.avg_assignment_marks != null ? Number(Number(r.avg_assignment_marks).toFixed(1)) : null,
        last_activity_at:      r.last_activity_at ?? null,
      })),
    });
  }

  return reports;
}
