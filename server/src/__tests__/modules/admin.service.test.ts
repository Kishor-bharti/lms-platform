jest.mock('../../config/db');
jest.mock('../../utils/password');

import {
  getStats, createUser, toggleUserActive,
  assignRole, removeRole,
  createCourse, createSubject,
  enrollStudent, unenrollStudent, getEnrolledStudents,
  assignTeacher, removeTeacher, deleteSubject,
} from '../../modules/admin/admin.service';
import { query, withTransaction, queryWithClient } from '../../config/db';
import { hashPassword } from '../../utils/password';

const mockQuery           = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockQueryWithClient = queryWithClient as jest.MockedFunction<typeof queryWithClient>;
const mockHashPassword    = hashPassword as jest.MockedFunction<typeof hashPassword>;

describe('admin.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation(async (fn: any) => fn({} as any));
  });

  // ── getStats ────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns numeric stats from the DB row', async () => {
      mockQuery.mockResolvedValueOnce([{
        total_students: '10', total_teachers: '3',
        total_sessions: '20', live_sessions: '1',
        total_courses: '5',  total_subjects: '15',
      }]);

      const stats = await getStats();

      expect(stats.total_students).toBe(10);
      expect(stats.total_teachers).toBe(3);
      expect(stats.live_sessions).toBe(1);
    });
  });

  // ── createUser ──────────────────────────────────────────────────────

  describe('createUser', () => {
    const userData = {
      email: 'newteacher@test.com', password: 'Teacher@123',
      first_name: 'New', last_name: 'Teacher', role: 'teacher', adminId: 'admin-uuid',
    };

    it('creates a user and assigns the role in a transaction', async () => {
      mockHashPassword.mockResolvedValueOnce('$2b$10$hashed');
      mockQueryWithClient
        .mockResolvedValueOnce([{
          id: 'new-user-uuid', email: userData.email,
          first_name: 'New', last_name: 'Teacher',
          phone: null, is_active: true, created_at: new Date().toISOString(),
        }])                             // INSERT users
        .mockResolvedValueOnce([{ id: 2 }])  // SELECT role id
        .mockResolvedValueOnce([]);          // INSERT user_roles

      const result = await createUser(userData);

      expect(result.email).toBe(userData.email);
      expect(result.roles).toContain('teacher');
      expect(mockWithTransaction).toHaveBeenCalled();
    });

    it('hashes the password before storing', async () => {
      mockHashPassword.mockResolvedValueOnce('$2b$10$hashed');
      mockQueryWithClient
        .mockResolvedValueOnce([{
          id: 'uuid', email: 'e@t.com', first_name: 'A', last_name: 'B',
          phone: null, is_active: true, created_at: '',
        }])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);

      await createUser(userData);

      expect(mockHashPassword).toHaveBeenCalledWith(userData.password);
    });

    it('throws when the role name does not exist', async () => {
      mockHashPassword.mockResolvedValueOnce('$2b$10$hashed');
      mockQueryWithClient
        .mockResolvedValueOnce([{
          id: 'uuid', email: 'e@t.com', first_name: 'A', last_name: 'B',
          phone: null, is_active: true, created_at: '',
        }])
        .mockResolvedValueOnce([]); // no role found

      await expect(createUser({ ...userData, role: 'superadmin' }))
        .rejects.toThrow("Role 'superadmin' not found");
    });
  });

  // ── toggleUserActive ────────────────────────────────────────────────

  describe('toggleUserActive', () => {
    it('calls query with the correct is_active value', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await toggleUserActive('user-uuid', false);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active'),
        expect.arrayContaining([false, 'user-uuid'])
      );
    });
  });

  // ── assignRole ──────────────────────────────────────────────────────

  describe('assignRole', () => {
    it('inserts the user_role mapping', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 2 }])  // SELECT role id
        .mockResolvedValueOnce([]);           // INSERT user_roles

      await assignRole('user-uuid', 'teacher', 'admin-uuid');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('throws when the role does not exist', async () => {
      mockQuery.mockResolvedValueOnce([]); // role not found

      await expect(assignRole('user-uuid', 'ghost', 'admin-uuid'))
        .rejects.toThrow("Role 'ghost' not found");
    });
  });

  // ── removeRole ──────────────────────────────────────────────────────

  describe('removeRole', () => {
    it('deletes the user_role mapping', async () => {
      mockQuery
        .mockResolvedValueOnce([{ id: 3 }])  // SELECT role id
        .mockResolvedValueOnce([]);           // DELETE

      await removeRole('user-uuid', 'student');

      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the role name is not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // no role found

      await removeRole('user-uuid', 'nonexistent');

      // Only one query (the role lookup); no DELETE issued
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ── createCourse ────────────────────────────────────────────────────

  describe('createCourse', () => {
    it('inserts the course and uppercases the code', async () => {
      const row = {
        id: 'course-uuid', name: 'Math', code: 'MATH',
        description: null, is_active: true, created_at: '',
      };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await createCourse({ name: 'Math', code: 'math', adminId: 'admin-uuid' });

      expect(result.code).toBe('MATH');
      expect(result.subject_count).toBe(0);
    });
  });

  // ── createSubject ───────────────────────────────────────────────────

  describe('createSubject', () => {
    it('inserts the subject, uppercases the code, and fetches course name', async () => {
      const subjectRow = {
        id: 'sub-uuid', name: 'Algebra', code: 'ALG',
        description: null, is_active: true, course_id: 'course-uuid', created_at: '',
      };
      mockQuery
        .mockResolvedValueOnce([subjectRow])         // INSERT subject
        .mockResolvedValueOnce([{ name: 'Math' }]);  // SELECT course name

      const result = await createSubject({
        course_id: 'course-uuid', name: 'Algebra',
        code: 'alg', adminId: 'admin-uuid',
      });

      expect(result.code).toBe('ALG');
      expect(result.course_name).toBe('Math');
      expect(result.teacher_ids).toEqual([]);
    });
  });

  // ── enrollStudent / unenrollStudent ─────────────────────────────────

  describe('enrollStudent', () => {
    it('upserts an enrollment with active status', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await enrollStudent('subject-uuid', 'student-uuid', 'admin-uuid');
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).toContain('subject_enrollments');
    });
  });

  describe('unenrollStudent', () => {
    it('sets enrollment_status to suspended', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await unenrollStudent('subject-uuid', 'student-uuid');
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).toContain('suspended');
    });
  });

  // ── getEnrolledStudents ─────────────────────────────────────────────

  describe('getEnrolledStudents', () => {
    it('returns enrolled student rows', async () => {
      const studentRow = {
        id: 'stu-uuid', email: 's@test.com',
        first_name: 'John', last_name: 'Doe',
        status: 'active', enrolled_at: new Date().toISOString(),
      };
      mockQuery.mockResolvedValueOnce([studentRow]);

      const result = await getEnrolledStudents('subject-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe('s@test.com');
    });

    it('returns empty array when no students are enrolled', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getEnrolledStudents('subject-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── assignTeacher / removeTeacher ───────────────────────────────────

  describe('assignTeacher', () => {
    it('inserts into subject_teachers', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await assignTeacher('sub-uuid', 'teacher-uuid', 'admin-uuid');
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).toContain('subject_teachers');
    });
  });

  describe('removeTeacher', () => {
    it('deletes from subject_teachers', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await removeTeacher('sub-uuid', 'teacher-uuid');
      const sql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(sql).toContain('subject_teachers');
    });
  });

  // ── deleteSubject ───────────────────────────────────────────────────

  describe('deleteSubject', () => {
    it('clears attempt_answers then deletes the subject', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // DELETE attempt_answers
        .mockResolvedValueOnce([]); // DELETE subjects

      await deleteSubject('sub-uuid');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      const firstSql = (mockQuery.mock.calls[0] as any[])[0] as string;
      expect(firstSql).toContain('attempt_answers');
      const secondSql = (mockQuery.mock.calls[1] as any[])[0] as string;
      expect(secondSql).toContain('subjects');
    });
  });
});
