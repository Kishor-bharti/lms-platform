import { query } from '../config/db';

/**
 * Returns the permission_level ('read' | 'write') for a teacher on a subject,
 * or null if the teacher is not assigned to the subject.
 */
export async function getTeacherPermissionLevel(
  teacherId: string,
  subjectId: string
): Promise<string | null> {
  const rows = await query<{ permission_level: string }>(
    `SELECT permission_level FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2`,
    [subjectId, teacherId]
  );
  return rows[0]?.permission_level ?? null;
}

/**
 * Returns true if the user is allowed to create/edit content in the subject.
 * Admin always has write. Teachers need permission_level = 'write'.
 */
export async function hasContentWritePermission(
  userId: string,
  role: string,
  subjectId: string
): Promise<boolean> {
  if (role === 'admin') return true;
  if (role !== 'teacher') return false;
  const level = await getTeacherPermissionLevel(userId, subjectId);
  return level === 'write';
}
