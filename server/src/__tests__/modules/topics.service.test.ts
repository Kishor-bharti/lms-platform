jest.mock('../../config/db');

import {
  getTopicsBySubject, createTopic, updateTopic,
  softDeleteTopic, getTopicsByCourse,
} from '../../modules/topics/topics.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('topics.service', () => {
  beforeEach(() => jest.clearAllMocks());

  const topicRow = {
    id: 't-uuid', subject_id: 'sub-uuid', name: 'Algebra',
    description: 'Basic algebra', order_index: 0, is_active: true, created_at: '',
  };

  describe('getTopicsBySubject', () => {
    it('returns active topics for the subject', async () => {
      mockQuery.mockResolvedValueOnce([topicRow]);
      const result = await getTopicsBySubject('sub-uuid');
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('Algebra');
    });

    it('returns empty array when no topics exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getTopicsBySubject('sub-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('createTopic', () => {
    it('inserts a topic and returns the created row', async () => {
      mockQuery.mockResolvedValueOnce([topicRow]);

      const result = await createTopic({
        subject_id: 'sub-uuid', name: 'Algebra',
        description: 'Basic algebra', created_by: 'admin-uuid',
      });

      expect(result!.name).toBe('Algebra');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO topics'),
        expect.any(Array)
      );
    });

    it('defaults order_index to 0 when not provided', async () => {
      mockQuery.mockResolvedValueOnce([topicRow]);

      await createTopic({ subject_id: 'sub-uuid', name: 'T', created_by: 'admin-uuid' });

      const params = (mockQuery.mock.calls[0] as any[])[1] as any[];
      expect(params[3]).toBe(0); // order_index defaults to 0
    });
  });

  describe('updateTopic', () => {
    it('updates the topic and returns the updated row', async () => {
      const updatedRow = { ...topicRow, name: 'Advanced Algebra' };
      mockQuery.mockResolvedValueOnce([updatedRow]);

      const result = await updateTopic('t-uuid', { name: 'Advanced Algebra' });

      expect(result!.name).toBe('Advanced Algebra');
    });

    it('passes null for omitted fields (uses COALESCE in SQL)', async () => {
      mockQuery.mockResolvedValueOnce([topicRow]);

      await updateTopic('t-uuid', { name: 'New Name' });

      const params = (mockQuery.mock.calls[0] as any[])[1] as any[];
      // description not provided → null
      expect(params[2]).toBeNull();
      // order_index not provided → null
      expect(params[3]).toBeNull();
    });
  });

  describe('softDeleteTopic', () => {
    it('sets is_active=false on the topic', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await softDeleteTopic('t-uuid');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        ['t-uuid']
      );
    });
  });

  describe('getTopicsByCourse', () => {
    it('returns topics with subject name for the course', async () => {
      const row = { ...topicRow, subject_name: 'Math' };
      mockQuery.mockResolvedValueOnce([row]);

      const result = await getTopicsByCourse('course-uuid');

      expect(result[0]!.subject_name).toBe('Math');
    });
  });
});
