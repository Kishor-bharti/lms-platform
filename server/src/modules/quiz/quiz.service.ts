import { query, withTransaction, queryWithClient } from '../../config/db';
import { deleteFilesByUrls, signFileFields } from '../../utils/storage';

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
  can_edit: boolean;            // true = this user can edit the quiz
  write_teacher_count?: number; // admin only: how many teachers have per-quiz write
}

export interface QuizWritePermission {
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  granted_by_name: string;
  granted_at: string;
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
  option_text: string | null;
  option_image_url?: string | null; // T10
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
  last_question_index: number;
}

// ---- Get quizzes for a subject (role-filtered) ----
// admin   : all quizzes, can_edit=true, write_teacher_count per quiz
// teacher : published quizzes + unpublished quizzes where teacher has subject-level or per-quiz write
//           can_edit = has subject-level write OR per-quiz write permission
// student : only quizzes explicitly assigned via student_content_assignments

export async function getQuizzesBySubject(
  subjectId: string,
  role: string = 'student',
  userId?: string
): Promise<QuizSummary[]> {

  // ── student ──────────────────────────────────────────────────────────
  if (role === 'student') {
    if (!userId) return [];
    const rows = await query<any>(`
      SELECT q.id, q.subject_id, q.topic_id, t.name AS topic_name,
             q.title, q.quiz_type, q.description,
             q.duration_minutes, q.passing_score, q.is_published, q.max_attempts,
             q.created_at, q.created_by,
             u.first_name || ' ' || u.last_name AS creator_name,
             COUNT(qs.id) AS question_count
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
      LEFT JOIN topics t ON t.id = q.topic_id
      LEFT JOIN users u ON u.id = q.created_by
      WHERE q.subject_id = $1 AND q.is_active = true
        AND q.id IN (
          SELECT content_id FROM student_content_assignments
          WHERE content_type = 'quiz' AND student_id = $2 AND subject_id = $1
        )
      GROUP BY q.id, t.name, u.first_name, u.last_name
      ORDER BY q.created_at DESC
    `, [subjectId, userId]);
    return rows.map(r => ({
      ...r,
      question_count: Number(r.question_count),
      passing_score: r.passing_score ? Number(r.passing_score) : null,
      can_edit: false,
    }));
  }

  // ── teacher ──────────────────────────────────────────────────────────
  // Visible: published OR has subject-level write OR has per-quiz write
  // can_edit: has subject-level write OR has per-quiz write
  if (role === 'teacher') {
    if (!userId) return [];
    const rows = await query<any>(`
      SELECT q.id, q.subject_id, q.topic_id, t.name AS topic_name,
             q.title, q.quiz_type, q.description,
             q.duration_minutes, q.passing_score, q.is_published, q.max_attempts,
             q.created_at, q.created_by,
             u.first_name || ' ' || u.last_name AS creator_name,
             COUNT(qs.id) AS question_count,
             (
               EXISTS (SELECT 1 FROM quiz_write_permissions qwp
                        WHERE qwp.quiz_id = q.id AND qwp.teacher_id = $2)
               OR EXISTS (SELECT 1 FROM subject_teachers st
                           WHERE st.subject_id = q.subject_id AND st.teacher_id = $2
                             AND st.permission_level = 'write')
             ) AS can_edit
      FROM quizzes q
      LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
      LEFT JOIN topics t ON t.id = q.topic_id
      LEFT JOIN users u ON u.id = q.created_by
      WHERE q.subject_id = $1 AND q.is_active = true
        AND (
          q.is_published = true
          OR EXISTS (SELECT 1 FROM quiz_write_permissions qwp
                      WHERE qwp.quiz_id = q.id AND qwp.teacher_id = $2)
          OR EXISTS (SELECT 1 FROM subject_teachers st
                      WHERE st.subject_id = q.subject_id AND st.teacher_id = $2
                        AND st.permission_level = 'write')
        )
      GROUP BY q.id, t.name, u.first_name, u.last_name
      ORDER BY q.created_at DESC
    `, [subjectId, userId]);
    return rows.map(r => ({
      ...r,
      question_count: Number(r.question_count),
      passing_score: r.passing_score ? Number(r.passing_score) : null,
      can_edit: Boolean(r.can_edit),
    }));
  }

  // ── admin ─────────────────────────────────────────────────────────────
  const rows = await query<any>(`
    SELECT q.id, q.subject_id, q.topic_id, t.name AS topic_name,
           q.title, q.quiz_type, q.description,
           q.duration_minutes, q.passing_score, q.is_published, q.max_attempts,
           q.created_at, q.created_by,
           u.first_name || ' ' || u.last_name AS creator_name,
           COUNT(qs.id) AS question_count,
           true AS can_edit,
           (SELECT COUNT(*)::int FROM quiz_write_permissions qwp
             WHERE qwp.quiz_id = q.id) AS write_teacher_count
    FROM quizzes q
    LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN users u ON u.id = q.created_by
    WHERE q.subject_id = $1 AND q.is_active = true
    GROUP BY q.id, t.name, u.first_name, u.last_name
    ORDER BY q.created_at DESC
  `, [subjectId]);
  return rows.map(r => ({
    ...r,
    question_count: Number(r.question_count),
    passing_score: r.passing_score ? Number(r.passing_score) : null,
    can_edit: true,
    write_teacher_count: Number(r.write_teacher_count),
  }));
}

// ---- Per-quiz write permissions (admin manages) ----

export async function getQuizWritePermissions(quizId: string): Promise<QuizWritePermission[]> {
  return query<any>(`
    SELECT qwp.teacher_id,
           t.first_name || ' ' || t.last_name AS teacher_name,
           t.email AS teacher_email,
           g.first_name || ' ' || g.last_name AS granted_by_name,
           qwp.granted_at
    FROM quiz_write_permissions qwp
    JOIN users t ON t.id = qwp.teacher_id
    JOIN users g ON g.id = qwp.granted_by
    WHERE qwp.quiz_id = $1
    ORDER BY qwp.granted_at DESC
  `, [quizId]);
}

export async function grantQuizWritePermission(
  quizId: string, teacherId: string, grantedBy: string
): Promise<void> {
  await query(`
    INSERT INTO quiz_write_permissions (quiz_id, teacher_id, granted_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (quiz_id, teacher_id) DO NOTHING
  `, [quizId, teacherId, grantedBy]);
}

export async function revokeQuizWritePermission(
  quizId: string, teacherId: string
): Promise<void> {
  await query(
    `DELETE FROM quiz_write_permissions WHERE quiz_id = $1 AND teacher_id = $2`,
    [quizId, teacherId]
  );
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
    SELECT q.id, q.question_text, q.image_url, q.explanation, q.explanation_image_url,
           q.difficulty, q.marks, q.order_index, q.topic_id, t.name AS topic_name
    FROM questions q
    LEFT JOIN topics t ON t.id = q.topic_id
    WHERE q.quiz_id = $1 AND q.is_active = true
    ORDER BY q.order_index, q.created_at
  `, [quizId]);

  const optionRows = await query<any>(`
    SELECT o.id, o.question_id, o.option_label, o.option_text, o.option_image_url
      ${role === 'teacher' || role === 'admin' ? ', o.is_correct' : ''}
    FROM options o
    JOIN questions q ON q.id = o.question_id
    WHERE q.quiz_id = $1 AND q.is_active = true
    ORDER BY o.option_label
  `, [quizId]);

  const optsByQuestion = new Map<string, Option[]>();
  for (const o of optionRows) {
    if (!optsByQuestion.has(o.question_id)) optsByQuestion.set(o.question_id, []);
    optsByQuestion.get(o.question_id)!.push(await signFileFields({
      id: o.id,
      option_label: o.option_label,
      option_text: o.option_text ?? null,
      option_image_url: o.option_image_url ?? null,
      ...(role === 'teacher' || role === 'admin' ? { is_correct: o.is_correct } : {}),
    }, ['option_image_url']));
  }

  return {
    ...quiz,
    question_count: Number(quiz.question_count),
    passing_score: quiz.passing_score ? Number(quiz.passing_score) : null,
    questions: await Promise.all(questionRows.map(async (q: any) => signFileFields({
      id: q.id,
      question_text: q.question_text,
      image_url: q.image_url,
      explanation: q.explanation,
      explanation_image_url: q.explanation_image_url ?? null,
      difficulty: q.difficulty,
      marks: Number(q.marks),
      order_index: q.order_index,
      topic_id: q.topic_id ?? null,
      topic_name: q.topic_name ?? null,
      options: optsByQuestion.get(q.id) ?? [],
    }, ['image_url', 'explanation_image_url']))),
  };
}

// ---- Teacher: create quiz with questions ----

export async function createQuiz(data: {
  subjectId?: string;
  courseId?: string;
  topicId?: string;
  createdBy: string;
  title: string;
  quiz_type: 'test' | 'practice';
  description?: string;
  duration_minutes: number;
  max_attempts?: number;
  questions: Array<{
    question_text: string;
    image_url?: string;
    explanation?: string;
    explanation_image_url?: string;
    difficulty: string;
    marks: number;
    order_index: number;
    topic_id?: string;
    options: Array<{ label: string; text: string; imageUrl?: string; is_correct: boolean }>;
  }>;
}): Promise<QuizSummary> {
  return withTransaction(async (client) => {
    const quizRows = await queryWithClient<any>(client, `
      INSERT INTO quizzes
        (subject_id, course_id, topic_id, created_by, title, quiz_type, description,
         duration_minutes, max_attempts, is_published)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false)
      RETURNING id, subject_id, course_id, topic_id, title, quiz_type, description,
                duration_minutes, passing_score, is_published, max_attempts, created_at
    `, [
      data.subjectId ?? null, data.courseId ?? null, data.topicId ?? null, data.createdBy,
      data.title, data.quiz_type, data.description ?? null, data.duration_minutes,
      data.max_attempts ?? null,
    ]);

    const quiz = quizRows[0];

    for (const q of data.questions) {
      const qRows = await queryWithClient<any>(client, `
        INSERT INTO questions
          (quiz_id, question_text, image_url, explanation, explanation_image_url, difficulty, marks, order_index, topic_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [quiz.id, q.question_text, q.image_url ?? null, q.explanation ?? null,
          q.explanation_image_url ?? null, q.difficulty, q.marks, q.order_index, q.topic_id ?? null, data.createdBy]);

      const questionId = qRows[0].id;

      for (const opt of q.options) {
        await queryWithClient(client, `
          INSERT INTO options (question_id, option_label, option_text, option_image_url, is_correct)
          VALUES ($1,$2,$3,$4,$5)
        `, [questionId, opt.label, opt.text || null, opt.imageUrl ?? null, opt.is_correct]);
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
  // Check that this quiz has been explicitly assigned to the student
  const assigned = await query<any>(
    `SELECT 1 FROM student_content_assignments
     WHERE content_type = 'quiz' AND content_id = $1 AND student_id = $2`,
    [quizId, studentId]
  );
  if (assigned.length === 0) {
    throw new Error('NOT_ASSIGNED');
  }

  // Published + max_attempts check
  const quizCheck = await query<any>(
    `SELECT max_attempts, is_published FROM quizzes WHERE id = $1`,
    [quizId]
  );
  if (!quizCheck[0]) throw new Error('QUIZ_NOT_FOUND');
  if (!quizCheck[0].is_published) throw new Error('QUIZ_NOT_PUBLISHED');

  const maxAttempts = quizCheck[0].max_attempts;

  // Block starting a new attempt while a saved (partial) practice session exists
  const partialCheck = await query<any>(`
    SELECT id FROM quiz_attempts
    WHERE quiz_id=$1 AND student_id=$2 AND status='partial'
  `, [quizId, studentId]);
  if (partialCheck.length > 0) throw new Error('HAS_PARTIAL_ATTEMPT');

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

// ---- Student: save progress mid-practice (scores answers at save time) ----

export async function partialSubmitPractice(data: {
  attemptId: string;
  studentId: string;
  answers: Array<{ question_id: string; selected_option_id: string | null }>;
  lastQuestionIndex: number;
}): Promise<{
  answeredCount: number;
  correctCount: number;
  marksObtained: number;
  partialTotalMarks: number;
  scorePct: number;
  reviewAnswers: Array<{
    question_id: string;
    question_text: string;
    image_url: string | null;
    explanation: string | null;
    selected_option_id: string | null;
    selected_label: string | null;
    selected_text: string | null;
    selected_image_url: string | null;
    correct_option_id: string;
    correct_label: string;
    correct_text: string;
    correct_image_url: string | null;
    is_correct: boolean;
    marks_awarded: number;
    total_marks: number;
  }>;
}> {
  return withTransaction(async (client) => {
    const attemptRows = await queryWithClient<any>(client, `
      SELECT qa.id, qa.status, q.quiz_type, q.id AS quiz_id
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE qa.id=$1 AND qa.student_id=$2
    `, [data.attemptId, data.studentId]);

    if (!attemptRows[0]) throw new Error('ATTEMPT_NOT_FOUND');
    if (attemptRows[0].quiz_type !== 'practice') throw new Error('NOT_PRACTICE');
    if (!['in_progress', 'partial'].includes(attemptRows[0].status)) throw new Error('ATTEMPT_NOT_RESUMABLE');

    const quizId = attemptRows[0].quiz_id;

    // Get correct answers + question metadata
    const correctRows = await queryWithClient<any>(client, `
      SELECT q.id AS question_id, q.question_text, q.image_url, q.explanation,
             q.explanation_image_url, q.difficulty, q.marks, t.name AS topic_name,
             o.id AS correct_option_id, o.option_label AS correct_label, o.option_text AS correct_text,
             o.option_image_url AS correct_image_url
      FROM questions q
      LEFT JOIN topics t ON t.id = q.topic_id
      JOIN options o ON o.question_id = q.id AND o.is_correct = true
      WHERE q.quiz_id = $1 AND q.is_active = true
    `, [quizId]);

    const correctMap = new Map(correctRows.map((r: any) => [r.question_id, r]));

    // Score and upsert answers
    let marksObtained = 0;
    let partialTotalMarks = 0;
    let correctCount = 0;

    for (const ans of data.answers) {
      const correct = correctMap.get(ans.question_id) as any;
      if (!correct) continue;
      partialTotalMarks += Number(correct.marks);
      const isCorrect = ans.selected_option_id === correct.correct_option_id;
      const awarded = isCorrect ? Number(correct.marks) : 0;
      if (isCorrect) correctCount++;
      marksObtained += awarded;

      await queryWithClient(client, `
        INSERT INTO attempt_answers
          (attempt_id, question_id, selected_option_id, is_correct, marks_awarded, answered_at)
        VALUES ($1,$2,$3,$4,$5,now())
        ON CONFLICT (attempt_id, question_id) DO UPDATE
          SET selected_option_id=$3, is_correct=$4, marks_awarded=$5, answered_at=now()
      `, [data.attemptId, ans.question_id, ans.selected_option_id, isCorrect, awarded]);
    }

    const scorePct = partialTotalMarks > 0 ? (marksObtained / partialTotalMarks) * 100 : 0;

    await queryWithClient(client, `
      UPDATE quiz_attempts SET status='partial', last_question_index=$1 WHERE id=$2
    `, [data.lastQuestionIndex, data.attemptId]);

    // Fetch selected option labels for review display
    const selectedIds = data.answers.map(a => a.selected_option_id).filter(Boolean) as string[];
    const selMap = new Map<string, { option_label: string; option_text: string; option_image_url: string | null }>();
    if (selectedIds.length > 0) {
      const selRows = await queryWithClient<any>(client, `
        SELECT id, option_label, option_text, option_image_url FROM options WHERE id = ANY($1)
      `, [selectedIds]);
      for (const s of selRows) selMap.set(s.id, s);
    }

    const reviewAnswers = await Promise.all(data.answers.map(async (ans) => {
      const correct = correctMap.get(ans.question_id) as any;
      if (!correct) return null;
      const sel = ans.selected_option_id ? selMap.get(ans.selected_option_id) : null;
      const isCorrect = ans.selected_option_id === correct.correct_option_id;
      return signFileFields({
        question_id: ans.question_id,
        question_text: correct.question_text,
        image_url: correct.image_url,
        explanation: correct.explanation,
        explanation_image_url: correct.explanation_image_url ?? null,
        difficulty: correct.difficulty,
        topic_name: correct.topic_name ?? null,
        selected_option_id: ans.selected_option_id,
        selected_label: sel?.option_label ?? null,
        selected_text: sel?.option_text ?? null,
        selected_image_url: sel?.option_image_url ?? null,
        correct_option_id: correct.correct_option_id,
        correct_label: correct.correct_label,
        correct_text: correct.correct_text,
        correct_image_url: correct.correct_image_url ?? null,
        is_correct: isCorrect,
        marks_awarded: isCorrect ? Number(correct.marks) : 0,
        total_marks: Number(correct.marks),
      }, ['image_url', 'explanation_image_url', 'selected_image_url', 'correct_image_url']);
    }));
    const filteredReviewAnswers = reviewAnswers.filter((x): x is NonNullable<typeof x> => x !== null);

    return { answeredCount: data.answers.length, correctCount, marksObtained, partialTotalMarks, scorePct, reviewAnswers: filteredReviewAnswers };
  });
}

// ---- Student: resume a saved practice attempt ----

export async function resumePractice(attemptId: string, studentId: string): Promise<{
  attemptId: string;
  lastQuestionIndex: number;
  savedAnswers: Record<string, string | null>;
}> {
  const attemptRows = await query<any>(`
    SELECT qa.id, qa.status, qa.last_question_index, q.quiz_type
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE qa.id=$1 AND qa.student_id=$2
  `, [attemptId, studentId]);

  if (!attemptRows[0]) throw new Error('ATTEMPT_NOT_FOUND');
  if (attemptRows[0].quiz_type !== 'practice') throw new Error('NOT_PRACTICE');
  if (attemptRows[0].status !== 'partial') throw new Error('ATTEMPT_NOT_PARTIAL');

  const answerRows = await query<any>(`
    SELECT question_id, selected_option_id FROM attempt_answers WHERE attempt_id=$1
  `, [attemptId]);

  const savedAnswers: Record<string, string | null> = {};
  for (const row of answerRows) {
    savedAnswers[row.question_id] = row.selected_option_id;
  }

  // Reactivate the attempt so the submit endpoint accepts it
  await query(`UPDATE quiz_attempts SET status='in_progress' WHERE id=$1`, [attemptId]);

  return {
    attemptId: attemptRows[0].id,
    lastQuestionIndex: attemptRows[0].last_question_index,
    savedAnswers,
  };
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

    // Total marks = ALL quiz questions so score% is denominated correctly
    let totalMarks = 0;
    for (const q of correctMap.values()) { totalMarks += Number((q as any).marks); }

    let marksObtained = 0;

    for (const ans of data.answers) {
      const correct = correctMap.get(ans.question_id) as any;
      if (!correct) continue;
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
      q.question_text, q.image_url, q.explanation, q.explanation_image_url,
      q.difficulty, q.marks AS total_marks, t.name AS topic_name,
      sel.option_label AS selected_label, sel.option_text AS selected_text, sel.option_image_url AS selected_image_url,
      cor.id AS correct_option_id, cor.option_label AS correct_label, cor.option_text AS correct_text, cor.option_image_url AS correct_image_url
    FROM attempt_answers aa
    JOIN questions q ON q.id = aa.question_id
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN options sel ON sel.id = aa.selected_option_id
    LEFT JOIN options cor ON cor.question_id = q.id AND cor.is_correct = true
    WHERE aa.attempt_id = $1
    ORDER BY q.order_index
  `, [attemptId]);

  const signedAnswers = await Promise.all(answerRows.map((a: any) =>
    signFileFields(a, ['image_url', 'explanation_image_url', 'selected_image_url', 'correct_image_url'])
  ));

  return {
    attempt,
    answers: signedAnswers,
  };
}

// ---- Teacher: update quiz (replace questions) ----

export async function updateQuiz(data: {
  quizId: string;
  updatedBy: string;
  topicId?: string;
  title: string;
  quiz_type: 'test' | 'practice';
  description?: string;
  duration_minutes: number;
  max_attempts?: number;
  questions: Array<{
    question_text: string;
    image_url?: string;
    explanation?: string;
    explanation_image_url?: string;
    difficulty: string;
    marks: number;
    order_index: number;
    topic_id?: string;
    options: Array<{ label: string; text: string; imageUrl?: string; is_correct: boolean }>;
  }>;
}): Promise<QuizSummary> {
  return withTransaction(async (client) => {
    const quizRows = await queryWithClient<any>(client, `
      UPDATE quizzes
      SET title=$1, quiz_type=$2, description=$3, duration_minutes=$4, max_attempts=$5,
          topic_id=$6, updated_at=now()
      WHERE id=$7
      RETURNING id, subject_id, topic_id, title, quiz_type, description,
                duration_minutes, passing_score, is_published, max_attempts, created_at
    `, [data.title, data.quiz_type, data.description ?? null,
        data.duration_minutes, data.max_attempts ?? 1,
        data.topicId ?? null, data.quizId]);

    if (!quizRows[0]) throw new Error('Quiz not found');
    const quiz = quizRows[0];

    // Soft-delete existing questions
    await queryWithClient(client, `
      UPDATE questions SET is_active=false WHERE quiz_id=$1
    `, [data.quizId]);

    // Insert new questions and options
    for (const q of data.questions) {
      const qRows = await queryWithClient<any>(client, `
        INSERT INTO questions
          (quiz_id, question_text, image_url, explanation, explanation_image_url, difficulty, marks, order_index, topic_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [data.quizId, q.question_text, q.image_url ?? null, q.explanation ?? null,
          q.explanation_image_url ?? null, q.difficulty, q.marks, q.order_index, q.topic_id ?? null, data.updatedBy]);

      const questionId = qRows[0].id;

      for (const opt of q.options) {
        await queryWithClient(client, `
          INSERT INTO options (question_id, option_label, option_text, option_image_url, is_correct)
          VALUES ($1,$2,$3,$4,$5)
        `, [questionId, opt.label, opt.text || null, opt.imageUrl ?? null, opt.is_correct]);
      }
    }

    return { ...quiz, question_count: data.questions.length };
  });
}

// ---- Teacher: append questions to a quiz (never deletes existing) ----
// Safe for concurrent use — each teacher only inserts their own questions.
// Auto-unpublishes the quiz so admin must review before re-publishing.

export async function appendQuestionsToQuiz(
  quizId: string,
  addedBy: string,
  questions: Array<{
    question_text: string;
    image_url?: string;
    explanation?: string;
    explanation_image_url?: string;
    difficulty: string;
    marks: number;
    topic_id?: string;
    options: Array<{ label: string; text: string; imageUrl?: string; is_correct: boolean }>;
  }>
): Promise<void> {
  // Compute next order_index to append after existing questions
  const maxRows = await query<any>(
    `SELECT COALESCE(MAX(order_index), -1) AS max_idx
     FROM questions WHERE quiz_id = $1 AND is_active = true`,
    [quizId]
  );
  let nextIndex = Number(maxRows[0].max_idx) + 1;

  await withTransaction(async (client) => {
    for (const q of questions) {
      const qRows = await queryWithClient<any>(client, `
        INSERT INTO questions
          (quiz_id, question_text, image_url, explanation, explanation_image_url,
           difficulty, marks, order_index, topic_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `, [quizId, q.question_text, q.image_url ?? null, q.explanation ?? null,
          q.explanation_image_url ?? null, q.difficulty, q.marks, nextIndex++,
          q.topic_id ?? null, addedBy]);

      const questionId = qRows[0].id;
      for (const opt of q.options) {
        await queryWithClient(client, `
          INSERT INTO options (question_id, option_label, option_text, option_image_url, is_correct)
          VALUES ($1,$2,$3,$4,$5)
        `, [questionId, opt.label, opt.text || null, opt.imageUrl ?? null, opt.is_correct]);
      }
    }
    // Keep quiz unpublished — admin reviews before publishing
    await queryWithClient(client,
      `UPDATE quizzes SET is_published = false, updated_at = now() WHERE id = $1`,
      [quizId]
    );
  });
}

// ---- Admin: delete quiz (soft delete by marking inactive) ----

export async function deleteQuiz(quizId: string): Promise<void> {
  const fileRows = await query<any>(`
    SELECT q.image_url, q.explanation_image_url, o.option_image_url
    FROM questions q
    LEFT JOIN options o ON o.question_id = q.id
    WHERE q.quiz_id = $1
  `, [quizId]);

  const filesToDelete = new Set<string>();
  for (const row of fileRows) {
    if (row.image_url) filesToDelete.add(row.image_url);
    if (row.explanation_image_url) filesToDelete.add(row.explanation_image_url);
    if (row.option_image_url) filesToDelete.add(row.option_image_url);
  }

  // First mark questions as inactive
  await query(`UPDATE questions SET is_active = false WHERE quiz_id = $1`, [quizId]);
  // Then mark quiz as inactive and unpublished
  await query(`UPDATE quizzes SET is_published = false, is_active = false WHERE id = $1`, [quizId]);

  if (filesToDelete.size > 0) {
    await deleteFilesByUrls(Array.from(filesToDelete));
  }
}

// ---- Student: get attempt status for all quizzes in a subject ----

export async function getStudentQuizStatuses(
  subjectId: string,
  studentId: string
): Promise<Record<string, { has_submitted: boolean; has_partial: boolean; attempts_used: number }>> {
  const rows = await query<any>(`
    SELECT
      q.id AS quiz_id,
      COUNT(qa.id)::int AS attempts_used,
      BOOL_OR(qa.status = 'submitted') AS has_submitted,
      BOOL_OR(qa.status = 'partial')   AS has_partial
    FROM quizzes q
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = $2
    WHERE q.subject_id = $1 AND q.is_published = true
    GROUP BY q.id
  `, [subjectId, studentId]);

  const result: Record<string, { has_submitted: boolean; has_partial: boolean; attempts_used: number }> = {};
  for (const r of rows) {
    result[r.quiz_id] = {
      has_submitted: Boolean(r.has_submitted),
      has_partial:   Boolean(r.has_partial),
      attempts_used: r.attempts_used ?? 0,
    };
  }
  return result;
}

// ---- Student: get my attempts for a quiz ----

export async function getMyAttempts(quizId: string, studentId: string): Promise<AttemptResult[]> {
  const rows = await query<any>(`
    SELECT qa.id, qa.quiz_id, qa.attempt_number, qa.status, qa.score_pct,
           qa.marks_obtained, qa.total_marks, qa.is_passed, qa.time_taken_seconds,
           qa.submitted_at, qa.last_question_index,
           COUNT(aa.id)::int AS answered_count
    FROM quiz_attempts qa
    LEFT JOIN attempt_answers aa ON aa.attempt_id = qa.id
    WHERE qa.quiz_id=$1 AND qa.student_id=$2
    GROUP BY qa.id
    ORDER BY qa.attempt_number
  `, [quizId, studentId]);

  return rows;
}

// ---- Get quizzes by course (for course-level test sets) ----

export async function getQuizzesByCourse(courseId: string, userId: string, role: string) {
  const rows = await query<any>(`
    SELECT
      q.id, q.course_id, q.title, q.quiz_type, q.description,
      q.duration_minutes, q.is_published, q.max_attempts,
      q.created_at, q.created_by,
      u.first_name || ' ' || u.last_name AS creator_name,
      t.name AS topic_name,
      COUNT(DISTINCT qs.id) AS question_count,
      qa.id        AS attempt_id,
      qa.status    AS attempt_status,
      qa.score_pct AS attempt_score,
      ${role === 'admin'
        ? `true AS can_edit,
           (SELECT COUNT(*) FROM quiz_write_permissions qwp WHERE qwp.quiz_id = q.id)::int AS write_teacher_count`
        : `EXISTS (
             SELECT 1 FROM quiz_write_permissions qwp
             WHERE qwp.quiz_id = q.id AND qwp.teacher_id = $2
           ) AS can_edit,
           0 AS write_teacher_count`
      }
    FROM quizzes q
    LEFT JOIN questions qs ON qs.quiz_id = q.id AND qs.is_active = true
    LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.student_id = $2 AND qa.status = 'submitted'
    LEFT JOIN topics t ON t.id = q.topic_id
    LEFT JOIN users u ON u.id = q.created_by
    WHERE q.course_id = $1 AND q.is_active = true
      ${role === 'student' ? 'AND q.is_published = true' : ''}
    GROUP BY q.id, qa.id, qa.status, qa.score_pct, t.name, u.first_name, u.last_name
    ORDER BY q.created_at DESC
  `, [courseId, userId]);

  return rows.map((r: any) => ({
    ...r,
    question_count: Number(r.question_count),
    can_edit: Boolean(r.can_edit),
    write_teacher_count: Number(r.write_teacher_count),
    my_attempt: r.attempt_id ? {
      id: r.attempt_id, status: r.attempt_status, score_pct: r.attempt_score
    } : null,
  }));
}
