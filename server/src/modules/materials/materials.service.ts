import { query } from '../../config/db';
import { deleteFilesByUrls, moveFileBetweenBuckets, renameStorageRefToTitle, signFileFields } from '../../utils/storage';
import { env } from '../../config/env';
import logger from '../../config/logger';

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

  return Promise.all(rows.map((r: any) => signFileFields(r, ['file_url'])));
}

export async function updateMaterial(
  materialId: string,
  data: { title?: string; description?: string; material_type?: string; file_url?: string; topicId?: string }
): Promise<Material> {
  const currentRows = await query<any>(`SELECT title, file_url FROM subject_materials WHERE id = $1`, [materialId]);
  const current = currentRows[0];
  if (!current) throw new Error('NOT_FOUND');

  let resolvedFileUrl = data.file_url;
  if (data.title !== undefined && data.title !== current.title) {
    const candidate = data.file_url ?? current.file_url;
    if (candidate) {
      const renamed = await renameStorageRefToTitle(candidate, data.title, 'bin');
      if (renamed) resolvedFileUrl = renamed;
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.title !== undefined)         { sets.push(`title = $${idx++}`);         params.push(data.title); }
  if (data.description !== undefined)   { sets.push(`description = $${idx++}`);   params.push(data.description || null); }
  if (data.material_type !== undefined) { sets.push(`material_type = $${idx++}`); params.push(data.material_type); }
  if (resolvedFileUrl !== undefined)    { sets.push(`file_url = $${idx++}`);      params.push(resolvedFileUrl); }
  if (data.topicId !== undefined)       { sets.push(`topic_id = $${idx++}`);      params.push(data.topicId || null); }

  if (sets.length === 0) throw new Error('Nothing to update');

  sets.push(`updated_at = now()`);
  params.push(materialId);

  const rows = await query<any>(`
    UPDATE subject_materials SET ${sets.join(', ')}
    WHERE id = $${idx}
    RETURNING id, subject_id, topic_id, uploaded_by, title, description, material_type,
              file_url, file_size_kb, order_index, is_active, is_published, created_at
  `, params);

  if (!rows[0]) throw new Error('NOT_FOUND');
  return signFileFields(rows[0], ['file_url']);
}

export async function publishMaterial(materialId: string, published: boolean): Promise<void> {
  // When publishing, move file from temp-uploads to portal-assets
  if (published) {
    const rows = await query<any>(`SELECT file_url FROM subject_materials WHERE id = $1`, [materialId]);
    if (rows[0]?.file_url) {
      try {
        const newUrl = await moveFileBetweenBuckets(rows[0].file_url, env.SUPABASE_PORTAL_BUCKET);
        if (newUrl && newUrl !== rows[0].file_url) {
          await query(`UPDATE subject_materials SET file_url = $1 WHERE id = $2`, [newUrl, materialId]);
        }
      } catch (err) {
        logger.warn('[materials] Failed to move file on publish, continuing with original URL:', err);
      }
    }
  }
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
  let fileRef = data.file_url;
  if (fileRef) {
    const renamed = await renameStorageRefToTitle(fileRef, data.title, 'bin');
    if (renamed) fileRef = renamed;
  }

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
    data.description ?? null, data.material_type, fileRef,
    data.file_size_kb ?? null, nextIndex, data.topicId ?? null,
  ]);

  const uploaderRows = await query<any>(
    `SELECT first_name || ' ' || last_name AS name FROM users WHERE id = $1`, [data.uploadedBy]
  );

  return signFileFields({ ...rows[0], uploader_name: uploaderRows[0]?.name ?? 'Teacher' }, ['file_url']);
}

export async function deleteMaterial(materialId: string, requesterId: string): Promise<void> {
  const fileRows = await query<any>(`SELECT file_url FROM subject_materials WHERE id = $1`, [materialId]);
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

  if (fileRows[0]?.file_url) {
    await deleteFilesByUrls([fileRows[0].file_url]);
  }
}

export async function reorderMaterials(subjectId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await query(
      `UPDATE subject_materials SET order_index = $1 WHERE id = $2 AND subject_id = $3`,
      [i, orderedIds[i], subjectId]
    );
  }
}
