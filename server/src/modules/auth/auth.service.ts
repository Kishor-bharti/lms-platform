import { query } from '../../config/db';
import { comparePassword } from '../../utils/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { UserRow, LoginAsRole, LoginResponse } from './auth.types';

// ─── Typed auth error ───────────────────────────────────────────
function authError(code: string): Error {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

// ─── Main login service ─────────────────────────────────────────
export async function login(
  email: string,
  password: string,
  loginAs: LoginAsRole
): Promise<LoginResponse> {

  // 1. Fetch user + all their roles in one query
  const rows = await query<UserRow>(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.password_hash,
      u.is_active,
      array_agg(r.name) AS roles
    FROM   users u
    JOIN   user_roles ur ON ur.user_id = u.id
    JOIN   roles      r  ON r.id       = ur.role_id
    WHERE  u.email = $1
    GROUP  BY u.id, u.email, u.first_name,
              u.last_name, u.password_hash, u.is_active
  `, [email]);

  // 2. User not found
  if (rows.length === 0) {
    throw authError('INVALID_CREDENTIALS');
  }

  const user = rows[0]!;

  // 3. Password check — do BEFORE is_active so timing doesn't leak existence
  const match = await comparePassword(password, user.password_hash);
  if (!match) {
    throw authError('INVALID_CREDENTIALS');
  }

  // 4. Account disabled
  if (!user.is_active) {
    throw authError('ACCOUNT_DISABLED');
  }

  // 5. Role mismatch — user doesn't hold the role they're trying to log in as
  if (!user.roles.includes(loginAs)) {
    throw authError('ROLE_DENIED');
  }

  // 6. Sign tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    roles: user.roles,
    activeRole: loginAs,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: user.roles,
      activeRole: loginAs,
    },
  };
}

// ─── Refresh tokens service ────────────────────────────────────
export async function refreshTokens(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Sign new tokens with the same payload
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      activeRole: payload.activeRole,
    };

    const newAccessToken = signAccessToken(tokenPayload);
    const newRefreshToken = signRefreshToken(tokenPayload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  } catch (err) {
    throw authError('INVALID_REFRESH_TOKEN');
  }
}
