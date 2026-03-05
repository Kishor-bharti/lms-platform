jest.mock('../../config/db');

import { getMyCourses } from '../../modules/courses/courses.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

const courseSubjectRows = [
  {
    course_id: 'c1', course_name: 'SAT', course_code: 'SAT', course_description: null,
    subject_id: 's1', subject_name: 'Math', subject_code: 'MATH', subject_description: null,
  },
  {
    course_id: 'c1', course_name: 'SAT', course_code: 'SAT', course_description: null,
    subject_id: 's2', subject_name: 'English', subject_code: 'ENG', subject_description: null,
  },
  {
    course_id: 'c2', course_name: 'ACT', course_code: 'ACT', course_description: null,
    subject_id: 's3', subject_name: 'Science', subject_code: 'SCI', subject_description: null,
  },
];

describe('courses.service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getMyCourses', () => {
    it('groups subjects under their parent course', async () => {
      mockQuery.mockResolvedValueOnce(courseSubjectRows);

      const result = await getMyCourses('teacher-uuid', 'teacher');

      expect(result).toHaveLength(2);
      const sat = result.find((c) => c.code === 'SAT')!;
      expect(sat.subjects).toHaveLength(2);
      expect(sat.subjects.map((s) => s.code)).toContain('MATH');
    });

    it('returns teacher-specific courses for role=teacher', async () => {
      mockQuery.mockResolvedValueOnce([courseSubjectRows[0]!]);
      const result = await getMyCourses('teacher-uuid', 'teacher');
      expect(result).toHaveLength(1);
    });

    it('returns enrolled courses for role=student', async () => {
      mockQuery.mockResolvedValueOnce([courseSubjectRows[0]!]);
      const result = await getMyCourses('student-uuid', 'student');
      expect(result).toHaveLength(1);
      // Query should filter by enrollment
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).toContain('subject_enrollments');
    });

    it('returns all active courses for role=admin', async () => {
      mockQuery.mockResolvedValueOnce(courseSubjectRows);
      const result = await getMyCourses('admin-uuid', 'admin');
      expect(result).toHaveLength(2);
      // Admin query has no user-specific filter
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).not.toContain('subject_enrollments');
      expect(sql).not.toContain('subject_teachers');
    });

    it('returns empty array when there are no courses', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getMyCourses('user-uuid', 'student');
      expect(result).toEqual([]);
    });
  });
});
