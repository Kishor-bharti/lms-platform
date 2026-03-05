import { query } from '../../config/db';

// ---- Student: activity for a date range ----

export interface DayActivity {
  date: string;       // YYYY-MM-DD
  quizzes: number;
  practices: number;
  correct: number;
  incorrect: number;
  time_mins: number;
}

export async function getActivityForRange(
  studentId: string,
  startDate: string,  // YYYY-MM-DD
  endDate: string,    // YYYY-MM-DD
): Promise<DayActivity[]> {
  const rows = await query<any>(`
    SELECT
      DATE(qa.submitted_at AT TIME ZONE 'UTC') AS day,
      COUNT(DISTINCT qa.id) FILTER (WHERE qz.quiz_type = 'test')     AS quizzes,
      COUNT(DISTINCT qa.id) FILTER (WHERE qz.quiz_type = 'practice') AS practices,
      COALESCE(SUM(aa.is_correct::int), 0)                           AS correct,
      COALESCE(SUM((NOT aa.is_correct)::int), 0)                     AS incorrect,
      COALESCE(SUM(qa.time_taken_seconds) / 60, 0)                   AS time_mins
    FROM quiz_attempts qa
    JOIN quizzes qz ON qz.id = qa.quiz_id
    LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id
    WHERE qa.student_id = $1
      AND qa.status = 'submitted'
      AND DATE(qa.submitted_at AT TIME ZONE 'UTC') >= $2::date
      AND DATE(qa.submitted_at AT TIME ZONE 'UTC') <= $3::date
    GROUP BY day
    ORDER BY day
  `, [studentId, startDate, endDate]);

  // Build full array with zeros for missing days
  const result: DayActivity[] = [];
  const start = new Date(startDate + 'T12:00:00Z');
  const end = new Date(endDate + 'T12:00:00Z');
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10);
    const found = rows.find((r: any) => {
      const rDate = r.day?.toISOString?.()?.slice(0, 10) ?? r.day;
      return rDate === dateStr;
    });
    result.push({
      date:       dateStr,
      quizzes:    found ? Number(found.quizzes)   : 0,
      practices:  found ? Number(found.practices)  : 0,
      correct:    found ? Number(found.correct)    : 0,
      incorrect:  found ? Number(found.incorrect)  : 0,
      time_mins:  found ? Number(found.time_mins)  : 0,
    });
  }
  return result;
}

// Backwards-compatible: last 7 days
export async function getWeeklyActivity(studentId: string): Promise<DayActivity[]> {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 6);
  return getActivityForRange(
    studentId,
    start.toISOString().slice(0, 10),
    end.toISOString().slice(0, 10),
  );
}

// ---- Student: quiz/practice score history (last 20 attempts) ----

export interface QuizHistoryItem {
  attempt_id: string;
  quiz_title: string;
  subject_name: string;
  quiz_type: string;
  score_pct: number | null;
  correct: number;
  incorrect: number;
  total_questions: number;
  time_taken_seconds: number | null;
  submitted_at: string;
  is_passed: boolean | null;
}

export async function getQuizHistory(studentId: string, quizType?: string): Promise<QuizHistoryItem[]> {
  const typeFilter = quizType ? `AND qz.quiz_type = $2` : '';
  const params: any[] = [studentId];
  if (quizType) params.push(quizType);

  const rows = await query<any>(`
    SELECT
      qa.id             AS attempt_id,
      qz.title          AS quiz_title,
      sub.name          AS subject_name,
      qz.quiz_type,
      qa.score_pct,
      qa.time_taken_seconds,
      qa.submitted_at,
      qa.is_passed,
      COUNT(aa.id)                              AS total_questions,
      COALESCE(SUM(aa.is_correct::int), 0)      AS correct,
      COALESCE(SUM((NOT aa.is_correct)::int), 0) AS incorrect
    FROM quiz_attempts qa
    JOIN quizzes  qz  ON qz.id  = qa.quiz_id
    LEFT JOIN subjects sub ON sub.id = qz.subject_id
    LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id
    WHERE qa.student_id = $1
      AND qa.status = 'submitted'
      ${typeFilter}
    GROUP BY qa.id, qz.title, sub.name, qz.quiz_type
    ORDER BY qa.submitted_at DESC
    LIMIT 20
  `, params);

  return rows.map((r: any) => ({
    attempt_id:         r.attempt_id,
    quiz_title:         r.quiz_title,
    subject_name:       r.subject_name,
    quiz_type:          r.quiz_type,
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
  practices_attempted: number;
  avg_score_pct: number | null;
  best_score_pct: number | null;
  avg_practice_score_pct: number | null;
  best_practice_score_pct: number | null;
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
    practices_attempted: number;
    avg_score_pct: number | null;
    best_score_pct: number | null;
    avg_practice_score_pct: number | null;
    best_practice_score_pct: number | null;
    assignments_submitted: number;
    assignments_graded: number;
    avg_assignment_marks: number | null;
    last_activity_at: string | null;
  }>;
}

// ---- Student: get live progress across all enrolled subjects ----

export async function getStudentProgress(studentId: string): Promise<SubjectProgress[]> {
  const rows = await query<any>(`
    SELECT
      sub.id            AS subject_id,
      sub.name          AS subject_name,
      sub.code          AS subject_code,
      c.name            AS course_name,

      -- Quiz (test) stats
      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')   AS quizzes_attempted,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')   AS avg_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')   AS best_score_pct,

      -- Practice stats
      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice') AS practices_attempted,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice') AS avg_practice_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice') AS best_practice_score_pct,

      -- Time for all
      COALESCE(SUM(qa.time_taken_seconds)
        FILTER (WHERE qa.status = 'submitted') / 60, 0) AS total_time_spent_mins,

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

  return rows.map((r: any) => ({
    subject_id:            r.subject_id,
    subject_name:          r.subject_name,
    subject_code:          r.subject_code,
    course_name:           r.course_name,
    quizzes_attempted:     Number(r.quizzes_attempted),
    practices_attempted:   Number(r.practices_attempted),
    avg_score_pct:         r.avg_score_pct != null ? Number(Number(r.avg_score_pct).toFixed(1)) : null,
    best_score_pct:        r.best_score_pct != null ? Number(Number(r.best_score_pct).toFixed(1)) : null,
    avg_practice_score_pct: r.avg_practice_score_pct != null ? Number(Number(r.avg_practice_score_pct).toFixed(1)) : null,
    best_practice_score_pct: r.best_practice_score_pct != null ? Number(Number(r.best_practice_score_pct).toFixed(1)) : null,
    total_time_spent_mins: Number(r.total_time_spent_mins),
    assignments_submitted: Number(r.assignments_submitted),
    assignments_graded:    Number(r.assignments_graded),
    avg_assignment_marks:  r.avg_assignment_marks != null ? Number(Number(r.avg_assignment_marks).toFixed(1)) : null,
    max_assignment_marks:  r.max_assignment_marks != null ? Number(Number(r.max_assignment_marks).toFixed(1)) : null,
    last_activity_at:      r.last_activity_at ?? null,
  }));
}

// ---- Topic-wise analysis for a student across a subject ----

export interface TopicAnalysis {
  topic_id: string;
  topic_name: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy_pct: number | null;
  status: string;  // 'Strong' | 'Good' | 'Needs Work' | 'At Risk' | 'N/A'
}

export async function getTopicAnalysis(studentId: string, subjectId: string): Promise<TopicAnalysis[]> {
  const rows = await query<any>(`
    SELECT
      t.id   AS topic_id,
      t.name AS topic_name,
      COUNT(aa.id)                               AS total_questions,
      COALESCE(SUM(aa.is_correct::int), 0)       AS correct_answers,
      COALESCE(SUM((NOT aa.is_correct)::int), 0) AS incorrect_answers
    FROM topics t
    JOIN questions q ON q.topic_id = t.id AND q.is_active = true
    JOIN quizzes qz ON qz.id = q.quiz_id AND qz.subject_id = $2 AND qz.is_active = true
    LEFT JOIN attempt_answers aa ON aa.question_id = q.id
      AND aa.attempt_id IN (
        SELECT qa.id FROM quiz_attempts qa
        WHERE qa.student_id = $1 AND qa.status = 'submitted'
      )
    WHERE t.subject_id = $2 AND t.is_active = true
    GROUP BY t.id, t.name, t.order_index
    ORDER BY t.order_index, t.name
  `, [studentId, subjectId]);

  return rows.map((r: any) => {
    const total = Number(r.total_questions);
    const correct = Number(r.correct_answers);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : null;
    let status = 'N/A';
    if (accuracy !== null) {
      if (accuracy >= 80) status = 'Strong';
      else if (accuracy >= 60) status = 'Good';
      else if (accuracy >= 40) status = 'Needs Work';
      else status = 'At Risk';
    }
    return {
      topic_id: r.topic_id,
      topic_name: r.topic_name,
      total_questions: total,
      correct_answers: correct,
      incorrect_answers: Number(r.incorrect_answers),
      accuracy_pct: accuracy,
      status,
    };
  });
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
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')
                                              AS quizzes_attempted,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')
                                              AS avg_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'test')
                                              AS best_score_pct,

      COUNT(DISTINCT qa.id)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice')
                                              AS practices_attempted,
      AVG(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice')
                                              AS avg_practice_score_pct,
      MAX(qa.score_pct)
        FILTER (WHERE qa.status = 'submitted' AND qz.quiz_type = 'practice')
                                              AS best_practice_score_pct,

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
      practices_attempted:   Number(r.practices_attempted),
      avg_score_pct:         r.avg_score_pct != null ? Number(Number(r.avg_score_pct).toFixed(1)) : null,
      best_score_pct:        r.best_score_pct != null ? Number(Number(r.best_score_pct).toFixed(1)) : null,
      avg_practice_score_pct: r.avg_practice_score_pct != null ? Number(Number(r.avg_practice_score_pct).toFixed(1)) : null,
      best_practice_score_pct: r.best_practice_score_pct != null ? Number(Number(r.best_practice_score_pct).toFixed(1)) : null,
      assignments_submitted: Number(r.assignments_submitted),
      assignments_graded:    Number(r.assignments_graded),
      avg_assignment_marks:  r.avg_assignment_marks != null ? Number(Number(r.avg_assignment_marks).toFixed(1)) : null,
      last_activity_at:      r.last_activity_at ?? null,
    });
  }

  return Array.from(subjectMap.values());
}

// ---- Teacher: check if student belongs to one of teacher's subjects ----

export async function isStudentOfTeacher(teacherId: string, studentId: string): Promise<boolean> {
  const rows = await query<any>(`
    SELECT 1
    FROM subject_teachers st
    JOIN subject_enrollments se ON se.subject_id = st.subject_id
      AND se.enrollment_status = 'active'
    WHERE st.teacher_id = $1 AND se.student_id = $2
    LIMIT 1
  `, [teacherId, studentId]);
  return rows.length > 0;
}
