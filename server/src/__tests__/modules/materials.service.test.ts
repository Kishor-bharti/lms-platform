jest.mock('../../config/db');

import {
  getMaterials, addMaterial, deleteMaterial, reorderMaterials,
} from '../../modules/materials/materials.service';
import { query } from '../../config/db';

const mockQuery = query as jest.MockedFunction<typeof query>;

describe('materials.service', () => {
  beforeEach(() => jest.clearAllMocks());

  const materialRow = {
    id: 'm-uuid', subject_id: 'sub-uuid', topic_id: null, topic_name: null,
    uploaded_by: 'teacher-uuid', uploader_name: 'John Doe',
    title: 'Chapter 1', description: null, material_type: 'pdf',
    file_url: 'https://storage/file.pdf', file_size_kb: 512,
    order_index: 0, is_active: true, created_at: '',
  };

  describe('getMaterials', () => {
    it('returns active materials ordered by order_index', async () => {
      mockQuery.mockResolvedValueOnce([materialRow]);
      const result = await getMaterials('sub-uuid');
      expect(result).toHaveLength(1);
      expect(result[0]!.material_type).toBe('pdf');
    });

    it('returns empty array when no materials exist', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await getMaterials('sub-uuid');
      expect(result).toEqual([]);
    });
  });

  describe('addMaterial', () => {
    it('auto-calculates order_index from existing count', async () => {
      const insertedRow = { ...materialRow, uploader_name: undefined };
      mockQuery
        .mockResolvedValueOnce([{ cnt: '3' }])        // COUNT query
        .mockResolvedValueOnce([insertedRow])           // INSERT
        .mockResolvedValueOnce([{ name: 'John Doe' }]); // uploader name fetch

      const result = await addMaterial({
        subjectId: 'sub-uuid', uploadedBy: 'teacher-uuid',
        title: 'Chapter 1', material_type: 'pdf',
        file_url: 'https://storage/file.pdf',
      });

      expect(result.uploader_name).toBe('John Doe');

      const insertParams = (mockQuery.mock.calls[1] as any[])[1] as any[];
      expect(insertParams[7]).toBe(3); // order_index = existing count
    });

    it('sets order_index to 0 when no materials exist yet', async () => {
      const insertedRow = { ...materialRow };
      mockQuery
        .mockResolvedValueOnce([{ cnt: '0' }])
        .mockResolvedValueOnce([insertedRow])
        .mockResolvedValueOnce([{ name: 'Teacher' }]);

      await addMaterial({
        subjectId: 'sub-uuid', uploadedBy: 'teacher-uuid',
        title: 'First Material', material_type: 'pdf',
        file_url: 'https://storage/first.pdf',
      });

      const insertParams = (mockQuery.mock.calls[1] as any[])[1] as any[];
      expect(insertParams[7]).toBe(0);
    });
  });

  describe('deleteMaterial', () => {
    it('soft-deletes the material (sets is_active=false)', async () => {
      mockQuery.mockResolvedValueOnce([]);
      await deleteMaterial('m-uuid', 'teacher-uuid');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('is_active = false'),
        expect.any(Array)
      );
    });
  });

  describe('reorderMaterials', () => {
    it('updates order_index for each material ID', async () => {
      mockQuery.mockResolvedValue([]);

      await reorderMaterials('sub-uuid', ['m1', 'm2', 'm3']);

      expect(mockQuery).toHaveBeenCalledTimes(3);
      // First call: order_index=0 for m1
      expect((mockQuery.mock.calls[0] as any[])[1]).toEqual([0, 'm1', 'sub-uuid']);
      // Second call: order_index=1 for m2
      expect((mockQuery.mock.calls[1] as any[])[1]).toEqual([1, 'm2', 'sub-uuid']);
    });

    it('does nothing for an empty array', async () => {
      await reorderMaterials('sub-uuid', []);
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });
});
