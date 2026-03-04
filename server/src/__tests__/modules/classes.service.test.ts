jest.mock('../../config/db');
jest.mock('../../services/zoom.service');

import {
  getMyClasses, getMySessionsV2,
  createSession, deleteSession,
  completeSessionById,
  getTeacherSubjects, getEnrolledSubjects, getAllSubjects,
} from '../../modules/classes/classes.service';
import { query, withTransaction, queryWithClient } from '../../config/db';
import { getZoomAccessToken, createZoomMeeting } from '../../services/zoom.service';

const mockQuery           = query as jest.MockedFunction<typeof query>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockQueryWithClient = queryWithClient as jest.MockedFunction<typeof queryWithClient>;

describe('classes.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation(async (fn: any) => fn({} as any));
  });

  // ── getMyClasses dispatcher ─────────────────────────────────────────

  describe('getMyClasses', () => {
    const subjectRow = {
      id: 'sub-uuid', name: 'Math', code: 'MATH', description: null,
      course_name: 'SAT', course_code: 'SAT', teacher_name: 'John Doe',
    };

    it('returns teacher subjects for role=teacher', async () => {
      mockQuery.mockResolvedValueOnce([subjectRow]);
      const result = await getMyClasses('teacher-uuid', 'teacher');
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe('Math');
    });

    it('returns enrolled subjects for role=student', async () => {
      mockQuery.mockResolvedValueOnce([subjectRow]);
      const result = await getMyClasses('student-uuid', 'student');
      expect(result).toHaveLength(1);
    });

    it('returns all subjects for role=admin', async () => {
      mockQuery.mockResolvedValueOnce([subjectRow]);
      const result = await getMyClasses('admin-uuid', 'admin');
      expect(result).toHaveLength(1);
    });

    it('returns empty array for unknown role', async () => {
      const result = await getMyClasses('uuid', 'unknown-role');
      expect(result).toEqual([]);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  // ── getMySessionsV2 dispatcher ──────────────────────────────────────

  describe('getMySessionsV2', () => {
    const sessionRow = {
      id: 'sess-uuid', subject_id: 'sub-uuid', topic_id: null, topic_name: null,
      teacher_id: 'teacher-uuid', class_title: 'Math', title: 'Lesson 1',
      meeting_link: null, zoom_start_url: null, zoom_meeting_id: null,
      session_date: '2099-12-31', start_time: '10:00:00+05:30', status: 'scheduled',
    };

    it('calls teacher sessions for role=teacher', async () => {
      mockQuery.mockResolvedValueOnce([sessionRow]);
      const result = await getMySessionsV2('teacher-uuid', 'teacher');
      expect(result[0]!.status).toBe('SCHEDULED');
    });

    it('resolves LIVE status from DB live status', async () => {
      mockQuery.mockResolvedValueOnce([{ ...sessionRow, status: 'live' }]);
      const result = await getMySessionsV2('teacher-uuid', 'teacher');
      expect(result[0]!.status).toBe('LIVE');
    });

    it('resolves COMPLETED for past dates with scheduled status', async () => {
      mockQuery.mockResolvedValueOnce([{ ...sessionRow, session_date: '2000-01-01', status: 'scheduled' }]);
      const result = await getMySessionsV2('teacher-uuid', 'teacher');
      expect(result[0]!.status).toBe('COMPLETED');
    });

    it('resolves COMPLETED for DB completed status', async () => {
      mockQuery.mockResolvedValueOnce([{ ...sessionRow, status: 'completed' }]);
      const result = await getMySessionsV2('teacher-uuid', 'teacher');
      expect(result[0]!.status).toBe('COMPLETED');
    });

    it('returns empty array for unknown role', async () => {
      const result = await getMySessionsV2('uuid', 'unknown');
      expect(result).toEqual([]);
    });
  });

  // ── createSession ───────────────────────────────────────────────────

  describe('createSession', () => {
    it('inserts the session and returns the created data', async () => {
      const insertedRow = {
        id: 'new-sess-uuid', subject_id: 'sub-uuid', title: 'Lesson 1',
        session_date: '2099-06-01', start_time: '10:00:00+05:30', status: 'scheduled',
      };
      mockQuery
        .mockResolvedValueOnce([insertedRow])       // INSERT session
        .mockResolvedValueOnce([{ name: 'Math' }]); // SELECT subject name

      const result = await createSession({
        subjectId: 'sub-uuid', teacherId: 'teacher-uuid',
        title: 'Lesson 1', sessionDate: '2099-06-01', startTime: '10:00:00+05:30',
      });

      expect(result.id).toBe('new-sess-uuid');
      expect(result.status).toBe('SCHEDULED');
      expect(result.class_title).toBe('Math');
    });

    it('computes end_time as start_time + 90 minutes', async () => {
      const insertedRow = {
        id: 'uuid', subject_id: 'sub-uuid', title: 'T',
        session_date: '2099-01-01', start_time: '10:00:00+05:30', status: 'scheduled',
      };
      mockQuery
        .mockResolvedValueOnce([insertedRow])
        .mockResolvedValueOnce([{ name: 'Math' }]);

      await createSession({
        subjectId: 'sub-uuid', teacherId: 't-uuid',
        title: 'T', sessionDate: '2099-01-01', startTime: '10:00:00+05:30',
      });

      // The end_time arg (index 5) should be '11:30:00+05:30' (10:00 + 90 min)
      const callArgs = (mockQuery.mock.calls[0] as any[])[1] as any[];
      expect(callArgs[5]).toBe('11:30:00+05:30');
    });
  });

  // ── deleteSession ───────────────────────────────────────────────────

  describe('deleteSession', () => {
    it('soft-deletes the session (status=cancelled) when requester is the owner', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'sess-uuid' }]);
      await deleteSession('sess-uuid', 'teacher-uuid');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("'cancelled'"),
        expect.any(Array)
      );
    });

    it('throws FORBIDDEN when the query returns no rows', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(deleteSession('sess-uuid', 'other-user-uuid'))
        .rejects.toThrow('FORBIDDEN');
    });
  });

  // ── completeSessionById ─────────────────────────────────────────────

  describe('completeSessionById', () => {
    const sessionRow = {
      id: 'sess-uuid', teacher_id: 'teacher-uuid', subject_id: 'sub-uuid',
      title: 'Lesson 1', status: 'live',
      session_date: '2099-01-01', start_time: '10:00:00+05:30', class_title: 'Math',
    };
    const updatedRow = {
      id: 'sess-uuid', subject_id: 'sub-uuid', title: 'Lesson 1', status: 'completed',
      session_date: '2099-01-01', start_time: '10:00:00+05:30', meeting_link: null,
    };

    it('updates the session status to completed', async () => {
      mockQueryWithClient
        .mockResolvedValueOnce([sessionRow])   // SELECT FOR UPDATE
        .mockResolvedValueOnce([updatedRow]);  // UPDATE … RETURNING

      const result = await completeSessionById('sess-uuid', 'teacher-uuid');

      expect(result.status).toBe('COMPLETED');
      expect(mockWithTransaction).toHaveBeenCalled();
    });

    it('throws FORBIDDEN when teacher_id does not match', async () => {
      mockQueryWithClient.mockResolvedValueOnce([{ ...sessionRow, teacher_id: 'other-teacher' }]);

      await expect(completeSessionById('sess-uuid', 'teacher-uuid'))
        .rejects.toThrow('FORBIDDEN');
    });

    it('throws when session is not found', async () => {
      mockQueryWithClient.mockResolvedValueOnce([]); // no session found

      await expect(completeSessionById('sess-uuid', 'teacher-uuid'))
        .rejects.toThrow('Session not found');
    });
  });
});
