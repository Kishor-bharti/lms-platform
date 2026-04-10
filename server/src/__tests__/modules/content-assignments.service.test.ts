jest.mock('../../config/db');

import {
  assignContent,
  getCourseStudents,
  getAssignmentsForContent,
  getAssignmentsForCourse,
  getAssignmentsForSubject,
  revokeAssignment,
  isContentAssigned,
} from '../../modules/content-assignments/content-assignments.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

const ASSIGNMENT_ROW = {
  id: 'sca-uuid',
  subject_id: 'sub-uuid',
  course_id: null,
  content_type: 'quiz',
  content_id: 'quiz-uuid',
  student_id: 'student-uuid',
  student_name: 'Alice Student',
  student_email: 'alice@test.com',
  assigned_by: 'teacher-uuid',
  assigner_name: 'Bob Teacher',
  assigned_at: '2026-04-01T10:00:00Z',
  due_date: null,
};

const STUDENT_ROW = {
  id: 'student-uuid',
  first_name: 'Alice',
  last_name: 'Student',
  email: 'alice@test.com',
};

describe('content-assignments.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── assignContent ──────────────────────────────────────────
  describe('assignContent', () => {
    it('inserts a quiz assignment without a due_date (quiz has no duration)', async () => {
      mockQuery.mockResolvedValueOnce([]); // INSERT
      await assignContent({
        subjectId: 'sub-uuid',
        contentType: 'quiz',
        contentId: 'quiz-uuid',
        studentIds: ['student-uuid'],
        assignedBy: 'teacher-uuid',
      });
      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('INSERT INTO student_content_assignments');
      expect(params).toContain('quiz-uuid');
      expect(params).toContain('student-uuid');
    });

    it('auto-calculates due_date for assignment with duration_days', async () => {
      mockQuery
        .mockResolvedValueOnce([{ duration_days: 7 }]) // SELECT duration_days
        .mockResolvedValueOnce([]);                     // INSERT

      await assignContent({
        subjectId: 'sub-uuid',
        contentType: 'assignment',
        contentId: 'assign-uuid',
        studentIds: ['student-uuid'],
        assignedBy: 'teacher-uuid',
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const [, insertParams] = mockQuery.mock.calls[1] as [string, any[]];
      const dueDateParam = insertParams[6]; // 7th param is due_date
      expect(dueDateParam).not.toBeNull();
      // Should be ~7 days from now
      const due = new Date(dueDateParam);
      const diff = due.getTime() - Date.now();
      expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
      expect(diff).toBeLessThan(8 * 24 * 60 * 60 * 1000);
    });

    it('leaves due_date null for assignment without duration_days', async () => {
      mockQuery
        .mockResolvedValueOnce([{ duration_days: null }]) // SELECT duration_days
        .mockResolvedValueOnce([]);                        // INSERT

      await assignContent({
        contentType: 'assignment',
        contentId: 'assign-uuid',
        studentIds: ['s1'],
        assignedBy: 'teacher-uuid',
      });

      const [, insertParams] = mockQuery.mock.calls[1] as [string, any[]];
      expect(insertParams[6]).toBeNull(); // due_date
    });

    it('inserts once per student when multiple students provided', async () => {
      mockQuery.mockResolvedValue([]); // all INSERT calls

      await assignContent({
        subjectId: 'sub-uuid',
        contentType: 'quiz',
        contentId: 'quiz-uuid',
        studentIds: ['s1', 's2', 's3'],
        assignedBy: 'teacher-uuid',
      });

      expect(mockQuery).toHaveBeenCalledTimes(3);
    });

    it('uses ON CONFLICT DO NOTHING to silently skip duplicates', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await assignContent({
        contentType: 'material',
        contentId: 'mat-uuid',
        studentIds: ['student-uuid'],
        assignedBy: 'admin-uuid',
      });

      const [sql] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO NOTHING');
    });

    it('passes courseId (not subjectId) for course-level content', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await assignContent({
        courseId: 'course-uuid',
        contentType: 'quiz',
        contentId: 'quiz-uuid',
        studentIds: ['student-uuid'],
        assignedBy: 'teacher-uuid',
      });

      const [, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(params[0]).toBeNull();       // subject_id = null
      expect(params[1]).toBe('course-uuid'); // course_id
    });
  });

  // ── getCourseStudents ──────────────────────────────────────
  describe('getCourseStudents', () => {
    it('returns all active enrolled students for admin (no teacherId)', async () => {
      mockQuery.mockResolvedValueOnce([STUDENT_ROW]);

      const result = await getCourseStudents('course-uuid');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_enrollments');
      expect(sql).toContain("enrollment_status = 'active'");
      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe('alice@test.com');
    });

    it('returns only teacher-allocated students when teacherId provided', async () => {
      mockQuery.mockResolvedValueOnce([STUDENT_ROW]);

      const result = await getCourseStudents('course-uuid', 'teacher-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_teacher_students');
      expect(params).toContain('teacher-uuid');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no students found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getCourseStudents('course-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── getAssignmentsForContent ───────────────────────────────
  describe('getAssignmentsForContent', () => {
    it('returns assignments for the given content type and id', async () => {
      mockQuery.mockResolvedValueOnce([ASSIGNMENT_ROW]);

      const result = await getAssignmentsForContent('quiz', 'quiz-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.content_type).toBe('quiz');
      expect(result[0]!.student_name).toBe('Alice Student');
    });

    it('passes correct parameters to query', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await getAssignmentsForContent('assignment', 'assign-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('content_type = $1');
      expect(sql).toContain('content_id = $2');
      expect(params).toEqual(['assignment', 'assign-uuid']);
    });

    it('returns empty array when nothing assigned', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getAssignmentsForContent('material', 'mat-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── getAssignmentsForCourse ────────────────────────────────
  describe('getAssignmentsForCourse', () => {
    it('returns all course-level assignments ordered by assigned_at desc', async () => {
      mockQuery.mockResolvedValueOnce([ASSIGNMENT_ROW]);

      const result = await getAssignmentsForCourse('course-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('course_id = $1');
      expect(params).toContain('course-uuid');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no course assignments exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      expect(await getAssignmentsForCourse('course-uuid')).toEqual([]);
    });
  });

  // ── getAssignmentsForSubject ───────────────────────────────
  describe('getAssignmentsForSubject', () => {
    it('returns all subject assignments when called by admin (no teacherId)', async () => {
      mockQuery.mockResolvedValueOnce([ASSIGNMENT_ROW]);

      const result = await getAssignmentsForSubject('sub-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_id = $1');
      expect(params).not.toContain('teacher-uuid'); // admin sees all
      expect(result).toHaveLength(1);
    });

    it('filters by assigned_by when called by teacher', async () => {
      mockQuery.mockResolvedValueOnce([ASSIGNMENT_ROW]);

      const result = await getAssignmentsForSubject('sub-uuid', 'teacher-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('assigned_by = $2');
      expect(params).toContain('teacher-uuid');
      expect(result).toHaveLength(1);
    });

    it('returns empty array when teacher has no assignments', async () => {
      mockQuery.mockResolvedValueOnce([]);
      expect(await getAssignmentsForSubject('sub-uuid', 'teacher-uuid')).toEqual([]);
    });
  });

  // ── revokeAssignment ──────────────────────────────────────
  describe('revokeAssignment', () => {
    it('deletes the assignment by id', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'sca-uuid' }]);

      await revokeAssignment('sca-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('DELETE FROM student_content_assignments');
      expect(params).toContain('sca-uuid');
    });

    it('calls query once (no additional side effects)', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await revokeAssignment('sca-uuid');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ── isContentAssigned ─────────────────────────────────────
  describe('isContentAssigned', () => {
    it('returns true when assignment exists', async () => {
      mockQuery.mockResolvedValueOnce([{ 1: 1 }]);

      const result = await isContentAssigned('quiz', 'quiz-uuid', 'student-uuid');

      expect(result).toBe(true);
    });

    it('returns false when assignment does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await isContentAssigned('quiz', 'quiz-uuid', 'student-uuid');

      expect(result).toBe(false);
    });

    it('passes all three parameters correctly', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await isContentAssigned('assignment', 'assign-uuid', 'other-student');

      const [, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(params).toEqual(['assignment', 'assign-uuid', 'other-student']);
    });
  });
});
