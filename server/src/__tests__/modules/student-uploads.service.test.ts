jest.mock('../../config/db');
jest.mock('../../utils/storage');

import {
  getUploads,
  getMyUploads,
  createUpload,
  addFeedback,
  deleteUpload,
  deleteUploadAsAdmin,
  getStudentTeachers,
} from '../../modules/student-uploads/student-uploads.service';
import { query } from '../../config/db';
import { signFileFields, deleteFilesByUrls } from '../../utils/storage';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockSignFileFields = signFileFields as jest.MockedFunction<typeof signFileFields>;
const mockDeleteFilesByUrls = deleteFilesByUrls as jest.MockedFunction<typeof deleteFilesByUrls>;

const UPLOAD_ROW = {
  id: 'upload-uuid',
  subject_id: 'sub-uuid',
  student_id: 'student-uuid',
  student_name: 'Alice Student',
  student_email: 'alice@test.com',
  teacher_id: 'teacher-uuid',
  teacher_name: 'Bob Teacher',
  topic_id: 'topic-uuid',
  topic_name: 'Topic 1',
  title: 'My Homework',
  description: 'Chapter 1 work',
  file_url: 'temp-uploads/file.pdf',
  file_name: 'homework.pdf',
  feedback_text: null,
  feedback_file_url: null,
  created_at: '2026-04-01T10:00:00Z',
};

describe('student-uploads.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: signFileFields returns the object as-is
    mockSignFileFields.mockImplementation(async (obj: any) => obj);
  });

  // ── getUploads ─────────────────────────────────────────────
  describe('getUploads', () => {
    it('returns all uploads for admin role without teacher roster filter', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW]);

      const result = await getUploads('sub-uuid', 'admin', 'admin-uuid');

      const [sql] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_id = $1');
      // Admin query should NOT filter through subject_teacher_students
      expect(sql).not.toContain('subject_teacher_students');
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe('My Homework');
    });

    it('applies teacher filter for teacher role', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW]);

      const result = await getUploads('sub-uuid', 'teacher', 'teacher-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_teacher_students');
      expect(params).toContain('teacher-uuid');
      expect(result).toHaveLength(1);
    });

    it('calls signFileFields on each upload row', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW, UPLOAD_ROW]);

      await getUploads('sub-uuid', 'admin', 'admin-uuid');

      expect(mockSignFileFields).toHaveBeenCalledTimes(2);
    });

    it('returns empty array when no uploads exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getUploads('sub-uuid', 'admin', 'admin-uuid');
      expect(result).toEqual([]);
    });
  });

  // ── getMyUploads ───────────────────────────────────────────
  describe('getMyUploads', () => {
    it('returns uploads filtered to student and subject', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW]);

      const result = await getMyUploads('sub-uuid', 'student-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('student_id = $2');
      expect(params).toEqual(['sub-uuid', 'student-uuid']);
      expect(result).toHaveLength(1);
    });

    it('returns empty array when student has no uploads', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getMyUploads('sub-uuid', 'student-uuid');
      expect(result).toEqual([]);
    });

    it('signs file_url and feedback_file_url fields', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW]);

      await getMyUploads('sub-uuid', 'student-uuid');

      expect(mockSignFileFields).toHaveBeenCalledWith(UPLOAD_ROW, ['file_url', 'feedback_file_url']);
    });
  });

  // ── createUpload ───────────────────────────────────────────
  describe('createUpload', () => {
    it('inserts an upload and returns the result with signed URL', async () => {
      const insertedRow = { ...UPLOAD_ROW };
      mockQuery.mockResolvedValueOnce([insertedRow]);
      mockSignFileFields.mockResolvedValueOnce({ ...insertedRow, file_url: 'https://presigned.url/file.pdf' } as any);

      const result = await createUpload({
        subjectId: 'sub-uuid',
        studentId: 'student-uuid',
        teacherId: 'teacher-uuid',
        topicId: 'topic-uuid',
        title: 'My Homework',
        description: 'Chapter 1 work',
        file_url: 'temp-uploads/file.pdf',
        file_name: 'homework.pdf',
      });

      expect(result.title).toBe('My Homework');
      const [sql] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('INSERT INTO student_uploads');
      expect(result.file_url).toBe('https://presigned.url/file.pdf');
    });

    it('uses null for optional fields when not provided', async () => {
      mockQuery.mockResolvedValueOnce([UPLOAD_ROW]);

      await createUpload({
        subjectId: 'sub-uuid',
        studentId: 'student-uuid',
        title: 'Upload Without Extras',
        file_url: 'temp-uploads/file.pdf',
      });

      const [, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(params[2]).toBeNull(); // teacherId
      expect(params[3]).toBeNull(); // topicId
      expect(params[5]).toBeNull(); // description
      expect(params[7]).toBeNull(); // file_name
    });
  });

  // ── addFeedback ────────────────────────────────────────────
  describe('addFeedback', () => {
    it('admin can add feedback to any upload without teacher restriction', async () => {
      const updatedRow = { ...UPLOAD_ROW, feedback_text: 'Great work!' };
      mockQuery.mockResolvedValueOnce([updatedRow]);

      const result = await addFeedback('upload-uuid', 'admin-uuid', 'admin', 'Great work!', undefined);

      const [sql] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).not.toContain('subject_teacher_students'); // admin bypasses teacher check
      expect(result.feedback_text).toBe('Great work!');
    });

    it('teacher can only add feedback to their allocated students', async () => {
      const updatedRow = { ...UPLOAD_ROW, feedback_text: 'Well done' };
      mockQuery.mockResolvedValueOnce([updatedRow]);

      const result = await addFeedback('upload-uuid', 'teacher-uuid', 'teacher', 'Well done', undefined);

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_teacher_students');
      expect(params).toContain('teacher-uuid');
      expect(result.feedback_text).toBe('Well done');
    });

    it('throws FORBIDDEN when teacher tries to feedback on unauthorized upload', async () => {
      mockQuery.mockResolvedValueOnce([]); // UPDATE returns nothing — not authorized

      await expect(
        addFeedback('upload-uuid', 'other-teacher', 'teacher', 'Feedback')
      ).rejects.toThrow('FORBIDDEN');
    });

    it('throws FORBIDDEN when admin upload not found', async () => {
      mockQuery.mockResolvedValueOnce([]); // UPDATE returns nothing

      await expect(
        addFeedback('nonexistent-uuid', 'admin-uuid', 'admin', 'Feedback')
      ).rejects.toThrow('FORBIDDEN');
    });

    it('saves feedback_file_url when provided', async () => {
      const updatedRow = { ...UPLOAD_ROW, feedback_file_url: 'portal-assets/feedback.pdf' };
      mockQuery.mockResolvedValueOnce([updatedRow]);

      const result = await addFeedback(
        'upload-uuid', 'admin-uuid', 'admin', 'See attached', 'portal-assets/feedback.pdf'
      );

      const [, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(params).toContain('portal-assets/feedback.pdf');
      expect(result.feedback_file_url).toBe('portal-assets/feedback.pdf');
    });
  });

  // ── deleteUpload ───────────────────────────────────────────
  describe('deleteUpload (student)', () => {
    it('deletes upload and cleans up S3 files', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_url: 'temp-uploads/file.pdf', feedback_file_url: 'portal-assets/feedback.pdf' }])
        .mockResolvedValueOnce([{ id: 'upload-uuid' }]); // DELETE RETURNING

      mockDeleteFilesByUrls.mockResolvedValueOnce(undefined);

      await deleteUpload('upload-uuid', 'student-uuid');

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(mockDeleteFilesByUrls).toHaveBeenCalledWith(
        expect.arrayContaining(['temp-uploads/file.pdf', 'portal-assets/feedback.pdf'])
      );
    });

    it('throws FORBIDDEN when student does not own the upload', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_url: 'temp-uploads/file.pdf', feedback_file_url: null }])
        .mockResolvedValueOnce([]); // DELETE returns nothing

      await expect(deleteUpload('upload-uuid', 'other-student')).rejects.toThrow('FORBIDDEN');
    });

    it('skips deleteFilesByUrls when file_url is null', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_url: null, feedback_file_url: null }])
        .mockResolvedValueOnce([{ id: 'upload-uuid' }]);

      await deleteUpload('upload-uuid', 'student-uuid');

      expect(mockDeleteFilesByUrls).not.toHaveBeenCalled();
    });
  });

  // ── deleteUploadAsAdmin ────────────────────────────────────
  describe('deleteUploadAsAdmin', () => {
    it('admin can delete any upload regardless of student', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_url: 'temp-uploads/f.pdf', feedback_file_url: null }])
        .mockResolvedValueOnce([{ id: 'upload-uuid' }]);

      mockDeleteFilesByUrls.mockResolvedValueOnce(undefined);

      await deleteUploadAsAdmin('upload-uuid');

      const [sql] = mockQuery.mock.calls[1] as [string, any[]];
      expect(sql).toContain('DELETE FROM student_uploads WHERE id = $1');
      expect(mockDeleteFilesByUrls).toHaveBeenCalledWith(['temp-uploads/f.pdf']);
    });

    it('throws NOT_FOUND when upload does not exist', async () => {
      mockQuery
        .mockResolvedValueOnce([]) // SELECT file_url
        .mockResolvedValueOnce([]); // DELETE returns nothing

      await expect(deleteUploadAsAdmin('nonexistent-uuid')).rejects.toThrow('NOT_FOUND');
    });

    it('deletes both file_url and feedback_file_url when both exist', async () => {
      mockQuery
        .mockResolvedValueOnce([{ file_url: 'temp-uploads/f.pdf', feedback_file_url: 'portal-assets/fb.pdf' }])
        .mockResolvedValueOnce([{ id: 'upload-uuid' }]);

      mockDeleteFilesByUrls.mockResolvedValueOnce(undefined);

      await deleteUploadAsAdmin('upload-uuid');

      expect(mockDeleteFilesByUrls).toHaveBeenCalledWith(
        expect.arrayContaining(['temp-uploads/f.pdf', 'portal-assets/fb.pdf'])
      );
    });
  });

  // ── getStudentTeachers ────────────────────────────────────
  describe('getStudentTeachers', () => {
    it('returns teachers allocated to the student in the subject', async () => {
      const teachers = [
        { id: 'teacher-uuid', first_name: 'Bob', last_name: 'Teacher' },
      ];
      mockQuery.mockResolvedValueOnce(teachers);

      const result = await getStudentTeachers('sub-uuid', 'student-uuid');

      const [sql, params] = mockQuery.mock.calls[0] as [string, any[]];
      expect(sql).toContain('subject_teacher_students');
      expect(params).toEqual(['sub-uuid', 'student-uuid']);
      expect(result).toHaveLength(1);
      expect(result[0]!.first_name).toBe('Bob');
    });

    it('returns empty array when no teachers assigned to student', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getStudentTeachers('sub-uuid', 'student-uuid');
      expect(result).toEqual([]);
    });
  });
});
