import { query } from '../../config/db';
import { hashPassword, comparePassword } from '../../utils/password';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const rows = await query<any>(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.phone,
      u.avatar_url, u.is_active, u.last_login_at, u.created_at,
      COALESCE(
        array_agg(r.name ORDER BY r.id) FILTER (WHERE r.name IS NOT NULL),
        '{}'
      ) AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = $1
    GROUP BY u.id, u.email, u.first_name, u.last_name,
             u.phone, u.avatar_url, u.is_active, u.last_login_at, u.created_at
  `, [userId]);

  if (!rows[0]) throw new Error('User not found');
  return rows[0];
}

export async function updateProfile(userId: string, data: {
  first_name?: string;
  last_name?: string;
  phone?: string;
}): Promise<UserProfile> {
  const sets: string[] = [];
  const params: any[]  = [];
  let   idx            = 1;

  if (data.first_name !== undefined) { sets.push(`first_name = $${idx++}`); params.push(data.first_name); }
  if (data.last_name  !== undefined) { sets.push(`last_name  = $${idx++}`); params.push(data.last_name);  }
  if (data.phone      !== undefined) { sets.push(`phone      = $${idx++}`); params.push(data.phone);      }

  if (sets.length === 0) return getProfile(userId);

  sets.push(`updated_at = now()`);
  params.push(userId);

  await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx}`,
    params
  );

  return getProfile(userId);
}

export async function changePassword(userId: string, data: {
  current_password: string;
  new_password: string;
}): Promise<void> {
  const rows = await query<any>(
    `SELECT password_hash FROM users WHERE id = $1`, [userId]
  );
  if (!rows[0]) throw new Error('User not found');

  const match = await comparePassword(data.current_password, rows[0].password_hash);
  if (!match) throw new Error('WRONG_PASSWORD');

  if (data.new_password.length < 6) throw new Error('TOO_SHORT');

  const hash = await hashPassword(data.new_password);
  await query(`UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2`, [hash, userId]);
}
