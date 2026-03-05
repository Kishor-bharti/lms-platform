jest.mock('../../config/db');

import {
  getAssignmentsBySubject, getStudentAssignments,
  createAssignment, setAssignmentPublished,
  deleteAssignment, getSubmissions,
  submitAssignment, gradeSubmission,
} from '../../modules/assignment/assignment.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('assignment.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getAssignmentsBySubject ─────────────────────────────────────────

  describe('getAssignmentsBySubject', () => {
    it('returns assignments for teacher with submission count', async () => {
      const row = {
        id: 'a-uuid', subject_id: 'sub-uuid', topic_id: null, topic_name: null,
        title: 'HW1', description: null, due_date: null, max_marks: '100',
        is_published: true, attachment_url: null, created_at: '', submission_count: '3',
      };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await getAssignmentsBySubject('sub-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.submission_count).toBe(3);
      expect(result[0]!.max_marks).toBe(100);
    });
  });

  // ── getStudentAssignments ───────────────────────────────────────────

  describe('getStudentAssignments', () => {
    it('returns published assignments with my_submission null when not submitted', async () => {
      const row = {
        id: 'a-uuid', subject_id: 'sub-uuid', topic_id: null, topic_name: null,
        title: 'HW1', description: null, due_date: null, max_marks: '100',
        is_published: true, attachment_url: null, created_at: '', sub_id: null,
      };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await getStudentAssignments('sub-uuid', 'student-uuid');

      expect(result[0]!.my_submission).toBeNull();
    });

    it('populates my_submission when student has submitted', async () => {
      const row = {
        id: 'a-uuid', subject_id: 'sub-uuid', topic_id: null, topic_name: null,
        title: 'HW1', description: null, due_date: null, max_marks: '100',
        is_published: true, attachment_url: null, created_at: '',
        sub_id: 'sub-uuid', submission_url: 'https://link.com', notes: null,
        submitted_at: new Date().toISOString(), is_late: false,
        marks_awarded: null, feedback: null, sub_status: 'submitted',
      };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await getStudentAssignments('sub-uuid', 'student-uuid');

      expect(result[0]!.my_submission).not.toBeNull();
      expect(result[0]!.my_submission!.status).toBe('submitted');
    });
  });

  // ── createAssignment ────────────────────────────────────────────────

  describe('createAssignment', () => {
    it('inserts an assignment and returns it with submission_count=0', async () => {
      const row = {
        id: 'a-uuid', subject_id: 'sub-uuid', topic_id: null,
        title: 'HW1', description: null, due_date: null, max_marks: '100',
        is_published: false, attachment_url: null, created_at: '',
      };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await createAssignment({
        subjectId: 'sub-uuid', createdBy: 'teacher-uuid', title: 'HW1',
      });

      expect(result.submission_count).toBe(0);
      expect(result.is_published).toBe(false);
    });

    it('defaults max_marks to 100 when not provided', async () => {
      const row = {
        id: 'a-uuid', subject_id: 'sub-uuid', topic_id: null, title: 'HW1',
        description: null, due_date: null, max_marks: '100',
        is_published: false, attachment_url: null, created_at: '',
      };
      mockQuery.mockResolvedValueOnce([row]);

      await createAssignment({ subjectId: 'sub-uuid', createdBy: 'teacher-uuid', title: 'HW1' });

      const params = (mockQuery.mock.calls[0] as any[])[1] as any[];
      expect(params[5]).toBe(100); // max_marks argument
    });
  });

  // ── setAssignmentPublished ──────────────────────────────────────────

  describe('setAssignmentPublished', () => {
    it('updates is_published to true', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await setAssignmentPublished('a-uuid', true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_published'),
        [true, 'a-uuid']
      );
    });
  });

  // ── deleteAssignment ────────────────────────────────────────────────

  describe('deleteAssignment', () => {
    it('deletes the assignment when requester is the creator', async () => {
      mockQuery.mockResolvedValueOnce([{ id: 'a-uuid' }]);
      await deleteAssignment('a-uuid', 'creator-uuid');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('throws FORBIDDEN when the query returns no rows', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(deleteAssignment('a-uuid', 'other-user-uuid'))
        .rejects.toThrow('FORBIDDEN');
    });
  });

  // ── submitAssignment ────────────────────────────────────────────────

  describe('submitAssignment', () => {
    it('submits the assignment and marks it as submitted', async () => {
      const futureDue = new Date(Date.now() + 86400000).toISOString(); // tomorrow
      const resultRow = {
        id: 'sub-uuid', assignment_id: 'a-uuid', student_id: 'student-uuid',
        submission_url: null, notes: null, submitted_at: new Date().toISOString(),
        is_late: false, marks_awarded: null, feedback: null, status: 'submitted',
      };
      mockQuery
        .mockResolvedValueOnce([{ due_date: futureDue }]) // SELECT assignment
        .mockResolvedValueOnce([resultRow]);               // UPSERT submission

      const result = await submitAssignment({ assignmentId: 'a-uuid', studentId: 'student-uuid' });

      expect(result.status).toBe('submitted');
      expect(result.is_late).toBe(false);
    });

    it('marks submission as late when past the due date', async () => {
      const pastDue = new Date(Date.now() - 86400000).toISOString(); // yesterday
      const resultRow = {
        id: 'sub-uuid', assignment_id: 'a-uuid', student_id: 'student-uuid',
        submission_url: null, notes: null, submitted_at: new Date().toISOString(),
        is_late: true, marks_awarded: null, feedback: null, status: 'submitted',
      };
      mockQuery
        .mockResolvedValueOnce([{ due_date: pastDue }])
        .mockResolvedValueOnce([resultRow]);

      const result = await submitAssignment({ assignmentId: 'a-uuid', studentId: 'student-uuid' });

      // is_late is determined by the service and passed to the query
      const insertParams = (mockQuery.mock.calls[1] as any[])[1] as any[];
      expect(insertParams[4]).toBe(true); // is_late parameter
    });

    it('throws when the assignment is not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // assignment not found

      await expect(submitAssignment({ assignmentId: 'bad-uuid', studentId: 'student-uuid' }))
        .rejects.toThrow('Assignment not found');
    });
  });

  // ── gradeSubmission ─────────────────────────────────────────────────

  describe('gradeSubmission', () => {
    it('updates the submission to graded with marks and feedback', async () => {
      const resultRow = {
        id: 'sub-uuid', assignment_id: 'a-uuid', student_id: 'student-uuid',
        submission_url: null, notes: null, submitted_at: new Date().toISOString(),
        is_late: false, marks_awarded: 85, feedback: 'Good work!', status: 'graded',
      };
      mockQuery.mockResolvedValueOnce([resultRow]);

      const result = await gradeSubmission({
        submissionId: 'sub-uuid', graderId: 'teacher-uuid',
        marks_awarded: 85, feedback: 'Good work!',
      });

      expect(result.status).toBe('graded');
      expect(result.marks_awarded).toBe(85);
    });

    it('throws when submission is not found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await expect(gradeSubmission({
        submissionId: 'bad-uuid', graderId: 'teacher-uuid', marks_awarded: 90,
      })).rejects.toThrow('Submission not found');
    });
  });

  // ── getSubmissions ──────────────────────────────────────────────────

  describe('getSubmissions', () => {
    it('returns all submissions for an assignment', async () => {
      const rows = [
        {
          id: 'sub-1', assignment_id: 'a-uuid', student_id: 'stu-1',
          student_name: 'Alice', student_email: 'alice@test.com',
          submission_url: null, notes: null, submitted_at: null,
          is_late: false, marks_awarded: null, feedback: null, status: 'pending',
        },
      ];
      mockQuery.mockResolvedValueOnce(rows);

      const result = await getSubmissions('a-uuid');

      expect(result).toHaveLength(1);
      expect(result[0]!.student_name).toBe('Alice');
    });
  });
});
