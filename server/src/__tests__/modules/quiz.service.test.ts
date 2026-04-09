jest.mock('../../config/db');

import {
  getQuizzesBySubject, getQuizWithQuestions, createQuiz,
  setQuizPublished, deleteQuiz,
  startAttempt, submitAttempt, resumePractice,
  getMyAttempts, getStudentQuizStatuses,
} from '../../modules/quiz/quiz.service';
import { query, withTransaction, queryWithClient } from '../../config/db';

const mockQuery           = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockQueryWithClient = queryWithClient as jest.MockedFunction<typeof queryWithClient>;

describe('quiz.service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockWithTransaction.mockImplementation(async (fn: any) => fn({} as any));
  });

  // ── getQuizzesBySubject ─────────────────────────────────────────────

  describe('getQuizzesBySubject', () => {
    const quizRow = {
      id: 'q-uuid', subject_id: 'sub-uuid', title: 'Quiz 1',
      quiz_type: 'test', description: null, duration_minutes: 60,
      passing_score: '70', is_published: true, max_attempts: null,
      created_at: '', question_count: '5',
    };

    it('returns all quizzes (including unpublished) for teacher role', async () => {
      mockQuery.mockResolvedValueOnce([quizRow]);
      const result = await getQuizzesBySubject('sub-uuid', 'teacher', 'teacher-uuid');
      expect(result).toHaveLength(1);
      expect(result[0]!.question_count).toBe(5);
    });

    it('returns only assigned quizzes for student role', async () => {
      mockQuery.mockResolvedValueOnce([quizRow]);
      const result = await getQuizzesBySubject('sub-uuid', 'student', 'student-uuid');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('student_content_assignments'),
        expect.any(Array)
      );
      expect(result).toHaveLength(1);
    });

    it('converts passing_score to a number', async () => {
      mockQuery.mockResolvedValueOnce([{ ...quizRow, passing_score: '75.50' }]);
      const result = await getQuizzesBySubject('sub-uuid', 'teacher', 'teacher-uuid');
      expect(result[0]!.passing_score).toBe(75.5);
    });
  });

  // ── getQuizWithQuestions ────────────────────────────────────────────

  describe('getQuizWithQuestions', () => {
    it('throws when the quiz is not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // quiz not found
      await expect(getQuizWithQuestions('bad-uuid', 'teacher')).rejects.toThrow('Quiz not found');
    });

    it('includes is_correct in options for teacher role', async () => {
      const quizRow = {
        id: 'q-uuid', question_count: '1', passing_score: null, title: 'Q',
        quiz_type: 'test', description: null, duration_minutes: 30,
        is_published: true, max_attempts: null, created_at: '',
      };
      mockQuery
        .mockResolvedValueOnce([quizRow])     // quiz fetch
        .mockResolvedValueOnce([{             // questions
          id: 'ques-uuid', question_text: 'Q?', image_url: null,
          explanation: null, explanation_image_url: null,
          difficulty: 'medium', marks: '1', order_index: 0,
          topic_id: null, topic_name: null,
        }])
        .mockResolvedValueOnce([{             // options (with is_correct for teacher)
          id: 'opt-uuid', question_id: 'ques-uuid',
          option_label: 'A', option_text: 'Answer A', is_correct: true,
        }]);

      const result = await getQuizWithQuestions('q-uuid', 'teacher');
      expect(result.questions[0]!.options[0]).toHaveProperty('is_correct');
    });

    it('does NOT include is_correct in options for student role', async () => {
      const quizRow = {
        id: 'q-uuid', question_count: '1', passing_score: null, title: 'Q',
        quiz_type: 'practice', description: null, duration_minutes: 30,
        is_published: true, max_attempts: null, created_at: '',
      };
      mockQuery
        .mockResolvedValueOnce([quizRow])
        .mockResolvedValueOnce([{
          id: 'ques-uuid', question_text: 'Q?', image_url: null,
          explanation: null, explanation_image_url: null,
          difficulty: 'easy', marks: '1', order_index: 0, topic_id: null, topic_name: null,
        }])
        .mockResolvedValueOnce([{
          id: 'opt-uuid', question_id: 'ques-uuid',
          option_label: 'A', option_text: 'Answer A',
        }]);

      const result = await getQuizWithQuestions('q-uuid', 'student');
      expect(result.questions[0]!.options[0]).not.toHaveProperty('is_correct');
    });
  });

  // ── createQuiz ──────────────────────────────────────────────────────

  describe('createQuiz', () => {
    it('creates the quiz with questions and options in a transaction', async () => {
      const quizRow = {
        id: 'q-uuid', subject_id: 'sub-uuid', title: 'New Quiz',
        quiz_type: 'test', description: null, duration_minutes: 30,
        passing_score: null, is_published: false, max_attempts: null, created_at: '',
      };
      mockQueryWithClient
        .mockResolvedValueOnce([quizRow])           // INSERT quiz
        .mockResolvedValueOnce([{ id: 'q1-uuid' }]) // INSERT question 1
        .mockResolvedValueOnce([])                  // INSERT option A
        .mockResolvedValueOnce([]);                 // INSERT option B

      const result = await createQuiz({
        subjectId: 'sub-uuid', createdBy: 'teacher-uuid',
        title: 'New Quiz', quiz_type: 'test', duration_minutes: 30,
        questions: [{
          question_text: 'Q1?', difficulty: 'easy', marks: 1, order_index: 0,
          options: [
            { label: 'A', text: 'Option A', is_correct: true },
            { label: 'B', text: 'Option B', is_correct: false },
          ],
        }],
      });

      expect(result.title).toBe('New Quiz');
      expect(result.question_count).toBe(1);
      expect(mockWithTransaction).toHaveBeenCalled();
    });
  });

  // ── setQuizPublished ────────────────────────────────────────────────

  describe('setQuizPublished', () => {
    it('updates is_published flag', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await setQuizPublished('q-uuid', true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_published'),
        [true, 'q-uuid']
      );
    });
  });

  // ── deleteQuiz ──────────────────────────────────────────────────────

  describe('deleteQuiz', () => {
    it('soft-deletes questions and the quiz', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // SELECT image/option files (file-collection before delete)
        .mockResolvedValueOnce([]) // UPDATE questions SET is_active=false
        .mockResolvedValueOnce([]); // UPDATE quizzes SET is_active=false

      await deleteQuiz('q-uuid');

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });
  });

  // ── startAttempt ────────────────────────────────────────────────────

  describe('startAttempt', () => {
    it('creates a new attempt for an enrolled student', async () => {
      mockQuery
        .mockResolvedValueOnce([{ '?column?': 1 }])     // enrollment check → enrolled
        .mockResolvedValueOnce([{ max_attempts: null, is_published: true }]) // quiz check
        .mockResolvedValueOnce([])                      // no partial attempts
        .mockResolvedValueOnce([])                      // no previous attempts
        .mockResolvedValueOnce([{ id: 'attempt-uuid', attempt_number: 1 }]); // INSERT

      const result = await startAttempt('q-uuid', 'student-uuid');

      expect(result.attemptId).toBe('attempt-uuid');
      expect(result.attempt_number).toBe(1);
    });

    it('throws NOT_ASSIGNED when assignment check returns empty', async () => {
      mockQuery.mockResolvedValueOnce([]); // not assigned

      await expect(startAttempt('q-uuid', 'student-uuid'))
        .rejects.toThrow('NOT_ASSIGNED');
    });

    it('throws QUIZ_NOT_PUBLISHED when quiz is not published', async () => {
      mockQuery
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ max_attempts: null, is_published: false }]);

      await expect(startAttempt('q-uuid', 'student-uuid'))
        .rejects.toThrow('QUIZ_NOT_PUBLISHED');
    });

    it('throws HAS_PARTIAL_ATTEMPT when a saved practice session exists', async () => {
      mockQuery
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ max_attempts: null, is_published: true }])
        .mockResolvedValueOnce([{ id: 'partial-uuid' }]); // has partial

      await expect(startAttempt('q-uuid', 'student-uuid'))
        .rejects.toThrow('HAS_PARTIAL_ATTEMPT');
    });

    it('throws MAX_ATTEMPTS_REACHED when limit is exceeded', async () => {
      mockQuery
        .mockResolvedValueOnce([{ '?column?': 1 }])
        .mockResolvedValueOnce([{ max_attempts: 1, is_published: true }])
        .mockResolvedValueOnce([])                       // no partial
        .mockResolvedValueOnce([{ attempt_number: 1 }]); // already has 1 attempt

      await expect(startAttempt('q-uuid', 'student-uuid'))
        .rejects.toThrow('MAX_ATTEMPTS_REACHED');
    });
  });

  // ── submitAttempt ───────────────────────────────────────────────────

  describe('submitAttempt', () => {
    it('scores answers and returns the result row', async () => {
      const attemptRow   = { id: 'att-uuid', quiz_id: 'q-uuid', status: 'in_progress', passing_score: '70' };
      const correctRows  = [
        { question_id: 'q1', marks: '1', correct_option_id: 'opt-correct' },
      ];
      const resultRow = {
        id: 'att-uuid', quiz_id: 'q-uuid', status: 'submitted',
        score_pct: 100, marks_obtained: 1, total_marks: 1, is_passed: true,
        time_taken_seconds: 60, submitted_at: new Date().toISOString(),
      };

      mockQueryWithClient
        .mockResolvedValueOnce([attemptRow])  // SELECT attempt
        .mockResolvedValueOnce(correctRows)   // SELECT questions + correct options
        .mockResolvedValueOnce([])            // INSERT/UPSERT answer
        .mockResolvedValueOnce([resultRow]);  // UPDATE attempt RETURNING

      const result = await submitAttempt({
        attemptId: 'att-uuid', studentId: 'student-uuid',
        answers: [{ question_id: 'q1', selected_option_id: 'opt-correct' }],
        timeTakenSeconds: 60,
      });

      expect(result.status).toBe('submitted');
      expect(mockWithTransaction).toHaveBeenCalled();
    });

    it('throws when the attempt is not found', async () => {
      mockQueryWithClient.mockResolvedValueOnce([]); // no attempt

      await expect(submitAttempt({
        attemptId: 'bad-uuid', studentId: 'student-uuid',
        answers: [], timeTakenSeconds: 10,
      })).rejects.toThrow('Attempt not found');
    });

    it('throws when the attempt has already been submitted', async () => {
      mockQueryWithClient.mockResolvedValueOnce([{
        id: 'att-uuid', quiz_id: 'q-uuid', status: 'submitted', passing_score: null,
      }]);

      await expect(submitAttempt({
        attemptId: 'att-uuid', studentId: 'student-uuid',
        answers: [], timeTakenSeconds: 10,
      })).rejects.toThrow('Attempt already submitted');
    });
  });

  // ── resumePractice ──────────────────────────────────────────────────

  describe('resumePractice', () => {
    it('returns saved answers and reactivates the attempt', async () => {
      mockQuery
        .mockResolvedValueOnce([{
          id: 'att-uuid', status: 'partial', last_question_index: 3, quiz_type: 'practice',
        }])
        .mockResolvedValueOnce([{ question_id: 'q1', selected_option_id: 'opt-a' }]) // saved answers
        .mockResolvedValueOnce([]); // UPDATE to in_progress

      const result = await resumePractice('att-uuid', 'student-uuid');

      expect(result.attemptId).toBe('att-uuid');
      expect(result.lastQuestionIndex).toBe(3);
      expect(result.savedAnswers['q1']).toBe('opt-a');
    });

    it('throws ATTEMPT_NOT_FOUND when attempt does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(resumePractice('bad-uuid', 'student-uuid'))
        .rejects.toThrow('ATTEMPT_NOT_FOUND');
    });

    it('throws NOT_PRACTICE for a non-practice quiz', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'att-uuid', status: 'partial', last_question_index: 0, quiz_type: 'test',
      }]);
      await expect(resumePractice('att-uuid', 'student-uuid'))
        .rejects.toThrow('NOT_PRACTICE');
    });

    it('throws ATTEMPT_NOT_PARTIAL when attempt is not in partial state', async () => {
      mockQuery.mockResolvedValueOnce([{
        id: 'att-uuid', status: 'in_progress', last_question_index: 0, quiz_type: 'practice',
      }]);
      await expect(resumePractice('att-uuid', 'student-uuid'))
        .rejects.toThrow('ATTEMPT_NOT_PARTIAL');
    });
  });

  // ── getMyAttempts ───────────────────────────────────────────────────

  describe('getMyAttempts', () => {
    it('returns all attempts for a quiz', async () => {
      const attemptRows = [
        { id: 'a1', quiz_id: 'q-uuid', attempt_number: 1, status: 'submitted', score_pct: 80 },
        { id: 'a2', quiz_id: 'q-uuid', attempt_number: 2, status: 'submitted', score_pct: 90 },
      ];
      mockQuery.mockResolvedValueOnce(attemptRows);

      const result = await getMyAttempts('q-uuid', 'student-uuid');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when no attempts exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getMyAttempts('q-uuid', 'student-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── getStudentQuizStatuses ──────────────────────────────────────────

  describe('getStudentQuizStatuses', () => {
    it('returns a map of quiz statuses', async () => {
      mockQuery.mockResolvedValueOnce([{
        quiz_id: 'q-uuid', attempts_used: 1, has_submitted: true, has_partial: false,
      }]);

      const result = await getStudentQuizStatuses('sub-uuid', 'student-uuid');

      expect(result['q-uuid']).toEqual({
        has_submitted: true, has_partial: false, attempts_used: 1,
      });
    });

    it('returns empty object when no quizzes exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getStudentQuizStatuses('sub-uuid', 'student-uuid');
      expect(result).toEqual({});
    });
  });
});
