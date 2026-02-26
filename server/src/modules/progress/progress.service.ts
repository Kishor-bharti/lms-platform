import { query } from '../../config/db';

// ---- Student: weekly activity (last 7 days) ----

export interface DayActivity {
  date: string;       // YYYY-MM-DD
  quizzes: number;
  correct: number;
  incorrect: number;
  time_mins: number;
}

export async function getWeeklyActivity(studentId: string): Promise<DayActivity[]> {
  const rows = await query<any>(`
    SELECT
      DATE(qa.submitted_at AT TIME ZONE 'UTC') AS day,
      COUNT(DISTINCT qa.id)                    AS quizzes,
      COALESCE(SUM(aa.is_correct::int), 0)     AS correct,
      COALESCE(SUM((NOT aa.is_correct)::int), 0) AS incorrect,
      COALESCE(SUM(qa.time_taken_seconds) / 60, 0) AS time_mins
    FROM quiz_attempts qa
    LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id
    WHERE qa.student_id = $1
      AND qa.status = 'submitted'
      AND qa.submitted_at >= NOW() - INTERVAL '7 days'
    GROUP BY day
    ORDER BY day
  `, [studentId]);

  // Build full 7-day array with zeros for missing days
  const result: DayActivity[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = rows.find((r: any) => r.day?.toISOString?.()?.slice(0,10) === dateStr || r.day === dateStr);
    result.push({
      date:       dateStr,
      quizzes:    found ? Number(found.quizzes)   : 0,
      correct:    found ? Number(found.correct)    : 0,
      incorrect:  found ? Number(found.incorrect)  : 0,
      time_mins:  found ? Number(found.time_mins)  : 0,
    });
  }
  return result;
}

// ---- Student: quiz score history (last 20 attempts) ----

export interface QuizHistoryItem {
  attempt_id: string;
  quiz_title: string;
  subject_name: string;
  score_pct: number | null;
  correct: number;
  incorrect: number;
  total_questions: number;
  time_taken_seconds: number | null;
  submitted_at: string;
  is_passed: boolean | null;
}

export async function getQuizHistory(studentId: string): Promise<QuizHistoryItem[]> {
  const rows = await query<any>(`
    SELECT
      qa.id             AS attempt_id,
      qz.title          AS quiz_title,
      sub.name          AS subject_name,
      qa.score_pct,
      qa.time_taken_seconds,
      qa.submitted_at,
      qa.is_passed,
      COUNT(aa.id)                              AS total_questions,
      COALESCE(SUM(aa.is_correct::int), 0)      AS correct,
      COALESCE(SUM((NOT aa.is_correct)::int), 0) AS incorrect
    FROM quiz_attempts qa
    JOIN quizzes  qz  ON qz.id  = qa.quiz_id
    JOIN subjects sub ON sub.id = qz.subject_id
    LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id
    WHERE qa.student_id = $1
      AND qa.status = 'submitted'
    GROUP BY qa.id, qz.title, sub.name
    ORDER BY qa.submitted_at DESC
    LIMIT 20
  `, [studentId]);

  return rows.map((r: any) => ({
    attempt_id:         r.attempt_id,
    quiz_title:         r.quiz_title,
    subject_name:       r.subject_name,
    score_pct:          r.score_pct != null ? Number(Number(r.score_pct).toFixed(1)) : null,
    correct:            Number(r.correct),
    incorrect:          Number(r.incorrect),
    total_questions:    Number(r.total_questions),
    time_taken_seconds: r.time_taken_seconds != null ? Number(r.time_taken_seconds) : null,
    submitted_at:       r.submitted_at,
    is_passed:          r.is_passed,
  }));
}

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
  const rows = await query<any>(`
    SELECT
      sub.id            AS subject_id,
      sub.name          AS subject_name,
      c.name            AS course_name,
      u.id              AS student_id,
      u.first_name || ' ' || u.last_name AS student_name,
      u.email           AS student_email,

      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted')
                                              AS quizzes_attempted,
      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted' AND qa.is_passed = true)
                                              AS quizzes_passed,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted')
                                              AS avg_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted')
                                              AS best_score_pct,
      COUNT(DISTINCT asub.id)
        FILTER (WHERE asub.status IN ('submitted','graded'))
                                              AS assignments_submitted,
      COUNT(DISTINCT asub.id)
        FILTER (WHERE asub.status = 'graded')
                                              AS assignments_graded,
      AVG(asub.marks_awarded)
        FILTER (WHERE asub.status = 'graded')
                                              AS avg_assignment_marks,
      GREATEST(
        MAX(qa.submitted_at)   FILTER (WHERE qa.status = 'submitted'),
        MAX(asub.submitted_at) FILTER (WHERE asub.status IN ('submitted','graded'))
      )                                       AS last_activity_at

    FROM subject_teachers st
    JOIN subjects sub ON sub.id = st.subject_id
    JOIN courses  c   ON c.id   = sub.course_id
    JOIN subject_enrollments se ON se.subject_id = sub.id
                                AND se.enrollment_status = 'active'
    JOIN users u ON u.id = se.student_id

    LEFT JOIN quizzes qz
      ON qz.subject_id = sub.id
    LEFT JOIN quiz_attempts qa
      ON qa.quiz_id = qz.id AND qa.student_id = u.id
    LEFT JOIN assignments a
      ON a.subject_id = sub.id
    LEFT JOIN assignment_submissions asub
      ON asub.assignment_id = a.id AND asub.student_id = u.id

    WHERE st.teacher_id = $1

    GROUP BY sub.id, sub.name, c.name,
             u.id, u.first_name, u.last_name, u.email
    ORDER BY sub.name, student_name
  `, [teacherId]);

  const subjectMap = new Map<string, TeacherSubjectReport>();

  for (const r of rows) {
    if (!subjectMap.has(r.subject_id)) {
      subjectMap.set(r.subject_id, {
        subject_id:   r.subject_id,
        subject_name: r.subject_name,
        course_name:  r.course_name,
        students:     [],
      });
    }
    subjectMap.get(r.subject_id)!.students.push({
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
    });
  }

  return Array.from(subjectMap.values());
}
