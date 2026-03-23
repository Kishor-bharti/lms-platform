import { query } from '../../config/db';

export interface Material {
  id: string;
  subject_id: string;
  topic_id: string | null;
  topic_name?: string | null;
  uploaded_by: string;
  uploader_name: string;
  title: string;
  description: string | null;
  material_type: string;
  file_url: string;
  file_size_kb: number | null;
  order_index: number;
  is_active: boolean;
  is_published: boolean;
  created_at: string;
}

// ---- Get materials (role-filtered) ----
// admin: all active materials (published + draft)
// teacher: published only
// student: only materials assigned via student_content_assignments

export async function getMaterials(
  subjectId: string,
  role: string = 'teacher',
  userId?: string
): Promise<Material[]> {
  const params: any[] = [subjectId];
  let roleFilter = '';

  if (role === 'student') {
    if (!userId) return [];
    params.push(userId);
    roleFilter = `AND sm.id IN (
      SELECT content_id FROM student_content_assignments
      WHERE content_type = 'material' AND student_id = $2 AND subject_id = $1
    )`;
  } else if (role === 'teacher') {
    if (userId) {
      params.push(userId);
      roleFilter = `AND (sm.is_published = true OR sm.uploaded_by = $${params.length})`;
    } else {
      roleFilter = 'AND sm.is_published = true';
    }
  }
  // admin: no extra filter

  const rows = await query<any>(`
    SELECT
      sm.id, sm.subject_id, sm.topic_id, t.name AS topic_name,
      sm.uploaded_by,
      u.first_name || ' ' || u.last_name AS uploader_name,
      sm.title, sm.description, sm.material_type,
      sm.file_url, sm.file_size_kb, sm.order_index, sm.is_active, sm.is_published, sm.created_at
    FROM subject_materials sm
    JOIN users u ON u.id = sm.uploaded_by
    LEFT JOIN topics t ON t.id = sm.topic_id
    WHERE sm.subject_id = $1 AND sm.is_active = true
    ${roleFilter}
    ORDER BY sm.order_index, sm.created_at
  `, params);

  return rows;
}

export async function publishMaterial(materialId: string, published: boolean): Promise<void> {
  await query(
    `UPDATE subject_materials SET is_published = $1, updated_at = now() WHERE id = $2`,
    [published, materialId]
  );
}

export async function addMaterial(data: {
  subjectId: string;
  uploadedBy: string;
  title: string;
  description?: string;
  material_type: string;
  file_url: string;
  file_size_kb?: number;
  topicId?: string;
}): Promise<Material> {
  const countRows = await query<any>(
    `SELECT COUNT(*) AS cnt FROM subject_materials WHERE subject_id = $1 AND is_active = true`,
    [data.subjectId]
  );
  const nextIndex = Number(countRows[0]?.cnt ?? 0);

  const rows = await query<any>(`
    INSERT INTO subject_materials
      (subject_id, uploaded_by, title, description, material_type, file_url, file_size_kb, order_index, topic_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, subject_id, topic_id, uploaded_by, title, description, material_type,
              file_url, file_size_kb, order_index, is_active, created_at
  `, [
    data.subjectId, data.uploadedBy, data.title,
    data.description ?? null, data.material_type, data.file_url,
    data.file_size_kb ?? null, nextIndex, data.topicId ?? null,
  ]);

  const uploaderRows = await query<any>(
    `SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1`, [data.uploadedBy]
  );

  return { ...rows[0], uploader_name: uploaderRows[0]?.name ?? 'Teacher' };
}

export async function deleteMaterial(materialId: string, requesterId: string): Promise<void> {
  // Soft-delete: teachers can only delete their own drafts; published content requires admin
  const result = await query<any>(`
    UPDATE subject_materials SET is_active = false, updated_at = now()
    WHERE id = $1
      AND (
        (uploaded_by = $2 AND is_published = false)
        OR EXISTS (
          SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $2 AND r.name = 'admin'
        )
      )
    RETURNING id
  `, [materialId, requesterId]);

  if (!result[0]) throw new Error('FORBIDDEN');
}

export async function reorderMaterials(subjectId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      `UPDATE subject_materials SET order_index = $1 WHERE id = $2 AND subject_id = $3`,
      [i, orderedIds[i], subjectId]
    );
  }
}
