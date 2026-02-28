import { query } from '../../config/db';

export async function getTopicsBySubject(subjectId: string) {
  return query<any>(`
    SELECT id, subject_id, name, description, order_index, is_active, created_at
    FROM topics
    WHERE subject_id = $1 AND is_active = true
    ORDER BY order_index, name
  `, [subjectId]);
}

export async function createTopic(data: {
  subject_id: string; name: string; description?: string;
  order_index?: number; created_by: string;
}) {
  const rows = await query<any>(`
    INSERT INTO topics (subject_id, name, description, order_index, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, subject_id, name, description, order_index, is_active, created_at
  `, [data.subject_id, data.name, data.description ?? null,
      data.order_index ?? 0, data.created_by]);
  return rows[0];
}

export async function updateTopic(id: string, data: {
  name?: string; description?: string; order_index?: number;
}) {
  const rows = await query<any>(`
    UPDATE topics SET
      name        = COALESCE($2, name),
      description = COALESCE($3, description),
      order_index = COALESCE($4, order_index),
      updated_at  = now()
    WHERE id = $1
    RETURNING id, subject_id, name, description, order_index, is_active
  `, [id, data.name ?? null, data.description ?? null, data.order_index ?? null]);
  return rows[0];
}

export async function softDeleteTopic(id: string) {
  await query(`UPDATE topics SET is_active = false, updated_at = now() WHERE id = $1`, [id]);
}

export async function getTopicsByCourse(courseId: string) {
  return query<any>(`
    SELECT t.id, t.subject_id, t.name, t.description, t.order_index,
           s.title AS subject_name
    FROM   topics t
    JOIN   subjects s ON s.id = t.subject_id
    WHERE  s.course_id = $1 AND t.is_active = true
    ORDER  BY s.title, t.order_index, t.name
  `, [courseId]);
}
