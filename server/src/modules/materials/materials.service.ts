import { query } from '../../config/db';

export interface Material {
  id: string;
  subject_id: string;
  uploaded_by: string;
  uploader_name: string;
  title: string;
  description: string | null;
  material_type: string;
  file_url: string;
  file_size_kb: number | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export async function getMaterials(subjectId: string): Promise<Material[]> {
  const rows = await query<any>(`
    SELECT
      sm.id, sm.subject_id, sm.uploaded_by,
      u.first_name || ' ' || u.last_name AS uploader_name,
      sm.title, sm.description, sm.material_type,
      sm.file_url, sm.file_size_kb, sm.order_index, sm.is_active, sm.created_at
    FROM subject_materials sm
    JOIN users u ON u.id = sm.uploaded_by
    WHERE sm.subject_id = $1 AND sm.is_active = true
    ORDER BY sm.order_index, sm.created_at
  `, [subjectId]);

  return rows;
}

export async function addMaterial(data: {
  subjectId: string;
  uploadedBy: string;
  title: string;
  description?: string;
  material_type: string;
  file_url: string;
  file_size_kb?: number;
}): Promise<Material> {
  const countRows = await query<any>(
    `SELECT COUNT(*) AS cnt FROM subject_materials WHERE subject_id = $1 AND is_active = true`,
    [data.subjectId]
  );
  const nextIndex = Number(countRows[0]?.cnt ?? 0);

  const rows = await query<any>(`
    INSERT INTO subject_materials
      (subject_id, uploaded_by, title, description, material_type, file_url, file_size_kb, order_index)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, subject_id, uploaded_by, title, description, material_type,
              file_url, file_size_kb, order_index, is_active, created_at
  `, [
    data.subjectId, data.uploadedBy, data.title,
    data.description ?? null, data.material_type, data.file_url,
    data.file_size_kb ?? null, nextIndex,
  ]);

  const uploaderRows = await query<any>(
    `SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1`, [data.uploadedBy]
  );

  return { ...rows[0], uploader_name: uploaderRows[0]?.name ?? 'Teacher' };
}

export async function deleteMaterial(materialId: string, requesterId: string): Promise<void> {
  const result = await query<any>(`
    UPDATE subject_materials SET is_active = false, updated_at = now()
    WHERE  id        = $1
      AND  is_active = true
      AND (uploaded_by = $2 OR EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $2 AND r.name = 'admin'
      ))
    RETURNING id
  `, [materialId, requesterId]);

  if (result.length === 0) {
    // Distinguish "not found / already deleted" from "wrong owner"
    const exists = await query<any>(
      `SELECT id FROM subject_materials WHERE id = $1 AND is_active = true`,
      [materialId]
    );
    if (exists.length === 0) throw new Error('MATERIAL_NOT_FOUND');
    throw new Error('FORBIDDEN');
  }
}

export async function reorderMaterials(subjectId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;

  const indexes = orderedIds.map((_, i) => i);

  await query(
    `UPDATE subject_materials AS sm
     SET    order_index = v.ord
     FROM   unnest($1::uuid[], $2::int[]) AS v(id, ord)
     WHERE  sm.id = v.id
       AND  sm.subject_id = $3`,
    [orderedIds, indexes, subjectId]
  );
}
