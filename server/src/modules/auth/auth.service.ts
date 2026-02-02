import { query } from '../../config/db';
import { comparePassword } from '../../utils/password';
import { signAccessToken } from '../../utils/jwt';
import { User } from './auth.types';

export async function login(email: string, password: string) {
  const rows = await query<User>(
    'SELECT id, name, email, password_hash, role, status, created_at FROM users WHERE email = ? LIMIT 1',
    [email]
  );

  if (rows.length === 0) {
    const err = new Error('USER_NOT_FOUND') as any;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const user = rows[0]!;

  if (user.status !== 'ACTIVE') {
    const err = new Error('USER_INACTIVE') as any;
    err.code = 'USER_INACTIVE';
    throw err;
  }

  const match = await comparePassword(password, user.password_hash);
  if (!match) {
    const err = new Error('INVALID_PASSWORD') as any;
    err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const token = signAccessToken({ userId: user.id, role: user.role });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role
    }
  };
}
