jest.mock('../../config/db');

import {
  getWeeklyActivity, getQuizHistory,
  getStudentProgress, getTeacherReport,
} from '../../modules/progress/progress.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('progress.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getWeeklyActivity ───────────────────────────────────────────────

  describe('getWeeklyActivity', () => {
    it('always returns exactly 7 days', async () => {
      mockQuery.mockResolvedValueOnce([]); // no activity
      const result = await getWeeklyActivity('student-uuid');
      expect(result).toHaveLength(7);
    });

    it('fills missing days with zeros', async () => {
      mockQuery.mockResolvedValueOnce([]); // no DB rows
      const result = await getWeeklyActivity('student-uuid');
      result.forEach((day) => {
        expect(day.quizzes).toBe(0);
        expect(day.correct).toBe(0);
        expect(day.incorrect).toBe(0);
        expect(day.time_mins).toBe(0);
      });
    });

    it('populates a day that has quiz data', async () => {
      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);

      mockQuery.mockResolvedValueOnce([{
        day: todayStr,
        quizzes: '2', correct: '8', incorrect: '2', time_mins: '15',
      }]);

      const result = await getWeeklyActivity('student-uuid');
      const todayEntry = result.find((d) => d.date === todayStr)!;

      expect(todayEntry.quizzes).toBe(2);
      expect(todayEntry.correct).toBe(8);
      expect(todayEntry.time_mins).toBe(15);
    });
  });

  // ── getQuizHistory ──────────────────────────────────────────────────

  describe('getQuizHistory', () => {
    it('returns quiz history items', async () => {
      const historyRow = {
        attempt_id: 'att-uuid', quiz_title: 'Quiz 1', subject_name: 'Math',
        score_pct: '85.0', correct: '8', incorrect: '2', total_questions: '10',
        time_taken_seconds: '300', submitted_at: new Date().toISOString(), is_passed: true,
      };
      mockQuery.mockResolvedValueOnce([historyRow]);

      const result = await getQuizHistory('student-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.score_pct).toBe(85);
      expect(result[0]!.correct).toBe(8);
    });

    it('returns empty array when no attempts exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getQuizHistory('student-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── getStudentProgress ──────────────────────────────────────────────

  describe('getStudentProgress', () => {
    it('returns progress per enrolled subject', async () => {
      const progressRow = {
        subject_id: 'sub-uuid', subject_name: 'Math', subject_code: 'MATH',
        course_name: 'SAT',
        quizzes_attempted: '5', quizzes_passed: '4',
        avg_score_pct: '80.0', best_score_pct: '95.0',
        total_time_spent_mins: '120',
        assignments_submitted: '3', assignments_graded: '2',
        avg_assignment_marks: '88.0', max_assignment_marks: '100.0',
        last_activity_at: null,
      };
      mockQuery.mockResolvedValueOnce([progressRow]);

      const result = await getStudentProgress('student-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.quizzes_attempted).toBe(5);
      expect(result[0]!.avg_score_pct).toBe(80);
      expect(result[0]!.avg_assignment_marks).toBe(88);
    });

    it('returns empty array when student has no enrollments', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getStudentProgress('student-uuid');
      expect(result).toEqual([]);
    });

    it('returns null for avg_score_pct when no quizzes attempted', async () => {
      const progressRow = {
        subject_id: 'sub-uuid', subject_name: 'Math', subject_code: 'MATH',
        course_name: 'SAT',
        quizzes_attempted: '0', quizzes_passed: '0',
        avg_score_pct: null, best_score_pct: null,
        total_time_spent_mins: '0',
        assignments_submitted: '0', assignments_graded: '0',
        avg_assignment_marks: null, max_assignment_marks: null,
        last_activity_at: null,
      };
      mockQuery.mockResolvedValueOnce([progressRow]);

      const result = await getStudentProgress('student-uuid');

      expect(result[0]!.avg_score_pct).toBeNull();
    });
  });

  // ── getTeacherReport ────────────────────────────────────────────────

  describe('getTeacherReport', () => {
    it('groups students under their subject', async () => {
      const rows = [
        {
          subject_id: 'sub-uuid', subject_name: 'Math', course_name: 'SAT',
          student_id: 'stu-1', student_name: 'Alice', student_email: 'alice@test.com',
          quizzes_attempted: '3', quizzes_passed: '2',
          avg_score_pct: '75.0', best_score_pct: '90.0',
          assignments_submitted: '2', assignments_graded: '1',
          avg_assignment_marks: '80.0', last_activity_at: null,
        },
        {
          subject_id: 'sub-uuid', subject_name: 'Math', course_name: 'SAT',
          student_id: 'stu-2', student_name: 'Bob', student_email: 'bob@test.com',
          quizzes_attempted: '1', quizzes_passed: '0',
          avg_score_pct: '40.0', best_score_pct: '40.0',
          assignments_submitted: '0', assignments_graded: '0',
          avg_assignment_marks: null, last_activity_at: null,
        },
      ];
      mockQuery.mockResolvedValueOnce(rows);

      const result = await getTeacherReport('teacher-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.students).toHaveLength(2);
      expect(result[0]!.students[0]!.student_name).toBe('Alice');
    });

    it('returns empty array when teacher has no assigned subjects', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getTeacherReport('teacher-uuid');
      expect(result).toEqual([]);
    });
  });
});
