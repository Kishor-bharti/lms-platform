import { query, withTransaction, queryWithClient } from '../../config/db';

// ---- Types ----

export interface QuizSummary {
  id: string;
  subject_id: string;
  title: string;
  quiz_type: 'test' | 'practice';
  description: string | null;
  duration_minutes: number;
  passing_score: number | null;
  is_published: boolean;
  max_attempts: number | null;
  question_count: number;
  created_at: string;
}

export interface QuizWithQuestions extends QuizSummary {
  questions: Question[];
}

export interface Question {
  id: string;
  question_text: string;
  image_url: string | null;
  explanation: string | null;
  difficulty: string;
  marks: number;
  order_index: number;
  options: Option[];
}

export interface Option {
  id: string;
  option_label: string;
  option_text: string;
  is_correct?: boolean;
}

export interface AttemptResult {
  id: string;
  quiz_id: string;
  status: string;
  score_pct: number | null;
  marks_obtained: number | null;
  total_marks: number | null;
  is_passed: boolean | null;
  time_taken_seconds: number | null;
  submitted_at: string | null;
}

// ---- Teacher: get quizzes for a subject ----

export async function getQuizzesBySubject(subjectId: string, role: string = 'student'): Promise<QuizSummary[]> {
  const rows = await query<any>(`
    SELECT
      q.id, q.subject_id, q.title, q.quiz_type, q.description,
      q.duration_minutes, q.passing_score, q.is_published, q.max_attempts,
      q.created_at,
      COUNT(qs.id) AS question_count
    FROM quizzes q
    LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
    WHERE q.subject_id = $1
    ${role === 'student' ? 'AND q.is_published = true' : ''}
    GROUP BY q.id
    ORDER BY q.created_at DESC
  `, [subjectId]);

  return rows.map((r) => ({
    ...r,
    question_count: Number(r.question_count),
    passing_score: r.passing_score ? Number(r.passing_score) : null,
  }));
}

// ---- Get quiz with questions (teacher sees correct answers, student does not) ----

export async function getQuizWithQuestions(quizId: string, role: string): Promise<QuizWithQuestions> {
  const quizRows = await query<any>(`
    SELECT q.*, COUNT(qs.id) AS question_count
    FROM quizzes q
    LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
    WHERE q.id = $1
    GROUP BY q.id
  `, [quizId]);

  if (!quizRows[0]) throw new Error('Quiz not found');
  const quiz = quizRows[0];

  const questionRows = await query<any>(`
    SELECT id, question_text, image_url, explanation, difficulty, marks, order_index
    FROM questions
    WHERE quiz_id = $1 AND is_active = true
    ORDER BY order_index, created_at
  `, [quizId]);

  const optionRows = await query<any>(`
    SELECT o.id, o.question_id, o.option_label, o.option_text
      ${role === 'teacher' || role === 'admin' ? ', o.is_correct' : ''}
    FROM options o
    JOIN questions q ON q.id = o.question_id
    WHERE q.quiz_id = $1 AND q.is_active = true
    ORDER BY o.option_label
  `, [quizId]);

  const optsByQuestion = new Map<string, Option[]>();
  for (const o of optionRows) {
    if (!optsByQuestion.has(o.question_id)) optsByQuestion.set(o.question_id, []);
    optsByQuestion.get(o.question_id)!.push({
      id: o.id,
      option_label: o.option_label,
      option_text: o.option_text,
      ...(role === 'teacher' || role === 'admin' ? { is_correct: o.is_correct } : {}),
    });
  }

  return {
    ...quiz,
    question_count: Number(quiz.question_count),
    passing_score: quiz.passing_score ? Number(quiz.passing_score) : null,
    questions: questionRows.map((q: any) => ({
      id: q.id,
      question_text: q.question_text,
      image_url: q.image_url,
      explanation: q.explanation,
      difficulty: q.difficulty,
      marks: Number(q.marks),
      order_index: q.order_index,
      options: optsByQuestion.get(q.id) ?? [],
    })),
  };
}

// ---- Teacher: create quiz with questions ----

export async function createQuiz(data: {
  subjectId: string;
  createdBy: string;
  title: string;
  quiz_type: 'test' | 'practice';
  description?: string;
  duration_minutes: number;
  passing_score?: number;
  max_attempts?: number;
  questions: Array<{
    question_text: string;
    image_url?: string;
    explanation?: string;
    difficulty: string;
    marks: number;
    order_index: number;
    topic_id?: string;
    options: Array<{ label: string; text: string; is_correct: boolean }>;
  }>;
}): Promise<QuizSummary> {
  return withTransaction(async (client) => {
    const quizRows = await queryWithClient<any>(client, `
      INSERT INTO quizzes
        (subject_id, created_by, title, quiz_type, description,
         duration_minutes, passing_score, max_attempts, is_published)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
      RETURNING id, subject_id, title, quiz_type, description,
                duration_minutes, passing_score, is_published, max_attempts, created_at
    `, [
      data.subjectId, data.createdBy, data.title, data.quiz_type,
      data.description ?? null, data.duration_minutes,
      data.passing_score ?? null, data.max_attempts ?? null,
    ]);

    const quiz = quizRows[0];

    for (const q of data.questions) {
      const qRows = await queryWithClient<any>(client, `
        INSERT INTO questions
          (quiz_id, question_text, image_url, explanation, difficulty, marks, order_index, topic_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING id
      `, [quiz.id, q.question_text, q.image_url ?? null, q.explanation ?? null,
          q.difficulty, q.marks, q.order_index, q.topic_id ?? null, data.createdBy]);

      const questionId = qRows[0].id;

      for (const opt of q.options) {
        await queryWithClient(client, `
          INSERT INTO options (question_id, option_label, option_text, is_correct)
          VALUES ($1,$2,$3,$4)
        `, [questionId, opt.label, opt.text, opt.is_correct]);
      }
    }

    return { ...quiz, question_count: data.questions.length };
  });
}

// ---- Teacher: publish/unpublish ----

export async function setQuizPublished(quizId: string, published: boolean): Promise<void> {
  await query(`UPDATE quizzes SET is_published=$1, updated_at=now() WHERE id=$2`, [published, quizId]);
}

// ---- Student: start attempt ----

export async function startAttempt(quizId: string, studentId: string): Promise<{ attemptId: string; attempt_number: number }> {
  // Enrollment check — student must be enrolled in the subject
  const enrolled = await query<any>(`
    SELECT 1
    FROM subject_enrollments se
    JOIN quizzes q ON q.subject_id = se.subject_id
    WHERE q.id = $1
      AND se.student_id = $2
      AND se.enrollment_status = 'active'
  `, [quizId, studentId]);

  if (enrolled.length === 0) {
    throw new Error('NOT_ENROLLED');
  }

  // Published + max_attempts check
  const quizCheck = await query<any>(
    `SELECT max_attempts, is_published FROM quizzes WHERE id = $1`,
    [quizId]
  );
  if (!quizCheck[0]) throw new Error('QUIZ_NOT_FOUND');
  if (!quizCheck[0].is_published) throw new Error('QUIZ_NOT_PUBLISHED');

  const maxAttempts = quizCheck[0].max_attempts;

  const existing = await query<any>(`
    SELECT attempt_number FROM quiz_attempts
    WHERE quiz_id=$1 AND student_id=$2
    ORDER BY attempt_number DESC LIMIT 1
  `, [quizId, studentId]);

  const nextAttempt = existing.length > 0 ? existing[0].attempt_number + 1 : 1;

  if (maxAttempts && nextAttempt > maxAttempts) {
    throw new Error('MAX_ATTEMPTS_REACHED');
  }

  const rows = await query<any>(`
    INSERT INTO quiz_attempts (quiz_id, student_id, attempt_number, status)
    VALUES ($1,$2,$3,'in_progress')
    RETURNING id, attempt_number
  `, [quizId, studentId, nextAttempt]);

  return { attemptId: rows[0].id, attempt_number: rows[0].attempt_number };
}

// ---- Student: submit attempt ----

export async function submitAttempt(data: {
  attemptId: string;
  studentId: string;
  answers: Array<{ question_id: string; selected_option_id: string | null }>;
  timeTakenSeconds: number;
}): Promise<AttemptResult> {
  return withTransaction(async (client) => {
    const attemptRows = await queryWithClient<any>(client, `
      SELECT qa.id, qa.quiz_id, qa.status, q.passing_score
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id=$1 AND qa.student_id=$2
    `, [data.attemptId, data.studentId]);

    if (!attemptRows[0]) throw new Error('Attempt not found');
    if (attemptRows[0].status !== 'in_progress') throw new Error('Attempt already submitted');

    const quizId = attemptRows[0].quiz_id;
    const passingScore = Number(attemptRows[0].passing_score ?? 0);

    // Get correct answers and marks
    const correctRows = await queryWithClient<any>(client, `
      SELECT q.id AS question_id, q.marks,
             o.id AS correct_option_id
      FROM questions q
      JOIN options o ON o.question_id = q.id AND o.is_correct = true
      WHERE q.quiz_id = $1 AND q.is_active = true
    `, [quizId]);

    const correctMap = new Map(correctRows.map((r: any) => [r.question_id, r]));

    let marksObtained = 0;
    let totalMarks = 0;

    for (const ans of data.answers) {
      const correct = correctMap.get(ans.question_id) as any;
      if (!correct) continue;
      totalMarks += Number(correct.marks);
      const isCorrect = ans.selected_option_id === correct.correct_option_id;
      const awarded = isCorrect ? Number(correct.marks) : 0;
      marksObtained += awarded;

      await queryWithClient(client, `
        INSERT INTO attempt_answers
          (attempt_id, question_id, selected_option_id, is_correct, marks_awarded, answered_at)
        VALUES ($1,$2,$3,$4,$5,now())
        ON CONFLICT (attempt_id, question_id) DO UPDATE
          SET selected_option_id=$3, is_correct=$4, marks_awarded=$5, answered_at=now()
      `, [data.attemptId, ans.question_id, ans.selected_option_id, isCorrect, awarded]);
    }

    const scorePct = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
    const isPassed = passingScore > 0 ? scorePct >= passingScore : null;

    const resultRows = await queryWithClient<any>(client, `
      UPDATE quiz_attempts SET
        status='submitted',
        submitted_at=now(),
        time_taken_seconds=$1,
        marks_obtained=$2,
        total_marks=$3,
        score_pct=$4,
        is_passed=$5
      WHERE id=$6
      RETURNING id, quiz_id, status, score_pct, marks_obtained, total_marks, is_passed, time_taken_seconds, submitted_at
    `, [data.timeTakenSeconds, marksObtained, totalMarks, scorePct, isPassed, data.attemptId]);

    return resultRows[0];
  });
}

// ---- Student: get attempt results with correct answers ----

export async function getAttemptResult(attemptId: string, studentId: string) {
  const attemptRows = await query<any>(`
    SELECT qa.*, q.title AS quiz_title, q.passing_score
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id=$1 AND qa.student_id=$2
  `, [attemptId, studentId]);

  if (!attemptRows[0]) throw new Error('Attempt not found');
  const attempt = attemptRows[0];

  const answerRows = await query<any>(`
    SELECT
      aa.question_id, aa.selected_option_id, aa.is_correct, aa.marks_awarded,
      q.question_text, q.image_url, q.explanation, q.marks AS total_marks,
      sel.option_label AS selected_label, sel.option_text AS selected_text,
      cor.id AS correct_option_id, cor.option_label AS correct_label, cor.option_text AS correct_text
    FROM attempt_answers aa
    JOIN questions q ON q.id = aa.question_id
    LEFT JOIN options sel ON sel.id = aa.selected_option_id
    LEFT JOIN options cor ON cor.question_id = q.id AND cor.is_correct = true
    WHERE aa.attempt_id = $1
    ORDER BY q.order_index
  `, [attemptId]);

  return {
    attempt,
    answers: answerRows,
  };
}

// ---- Student: get my attempts for a quiz ----

export async function getMyAttempts(quizId: string, studentId: string): Promise<AttemptResult[]> {
  const rows = await query<any>(`
    SELECT id, quiz_id, attempt_number, status, score_pct,
           marks_obtained, total_marks, is_passed, time_taken_seconds, submitted_at
    FROM quiz_attempts
    WHERE quiz_id=$1 AND student_id=$2
    ORDER BY attempt_number
  `, [quizId, studentId]);

  return rows;
}
