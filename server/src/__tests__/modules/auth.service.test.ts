jest.mock('../../config/db');
jest.mock('../../utils/password');

import { login, refreshTokens } from '../../modules/auth/auth.service';
import { query } from '../../config/db';
import { comparePassword } from '../../utils/password';
import { signRefreshToken } from '../../utils/jwt';

const mockQuery          = query as jest.MockedFunction<typeof query>;
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;

const baseUser = {
  id:            'user-uuid-111',
  email:         'admin@test.com',
  first_name:    'Super',
  last_name:     'Admin',
  password_hash: '$2b$10$fakehashedpassword',
  is_active:     true,
  roles:         ['admin'],
};

describe('auth.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── login ──────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens and user info on valid credentials', async () => {
      mockQuery.mockResolvedValueOnce([baseUser]);
      mockComparePassword.mockResolvedValueOnce(true);

      const result = await login('admin@test.com', 'Admin@123', 'admin');

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('admin@test.com');
      expect(result.user.activeRole).toBe('admin');
      expect(result.user.roles).toContain('admin');
    });

    it('throws INVALID_CREDENTIALS when user is not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(login('nobody@x.com', 'pass', 'student'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws INVALID_CREDENTIALS for a wrong password', async () => {
      mockQuery.mockResolvedValueOnce([baseUser]);
      mockComparePassword.mockResolvedValueOnce(false);

      await expect(login('admin@test.com', 'wrongpass', 'admin'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws ACCOUNT_DISABLED for an inactive user (checked AFTER password)', async () => {
      mockQuery.mockResolvedValueOnce([{ ...baseUser, is_active: false }]);
      mockComparePassword.mockResolvedValueOnce(true);

      await expect(login('admin@test.com', 'Admin@123', 'admin'))
        .rejects.toMatchObject({ code: 'ACCOUNT_DISABLED' });
    });

    it('throws ROLE_DENIED when loginAs role is not assigned to the user', async () => {
      mockQuery.mockResolvedValueOnce([{ ...baseUser, roles: ['teacher'] }]);
      mockComparePassword.mockResolvedValueOnce(true);

      await expect(login('admin@test.com', 'Admin@123', 'student'))
        .rejects.toMatchObject({ code: 'ROLE_DENIED' });
    });

    it('checks password BEFORE is_active (timing safety)', async () => {
      // Even with inactive account, wrong password → INVALID_CREDENTIALS, not ACCOUNT_DISABLED
      mockQuery.mockResolvedValueOnce([{ ...baseUser, is_active: false }]);
      mockComparePassword.mockResolvedValueOnce(false);

      await expect(login('admin@test.com', 'wrong', 'admin'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('supports multi-role users selecting a specific role', async () => {
      const multiRoleUser = { ...baseUser, roles: ['admin', 'teacher'] };
      mockQuery.mockResolvedValueOnce([multiRoleUser]);
      mockComparePassword.mockResolvedValueOnce(true);

      const result = await login('admin@test.com', 'Admin@123', 'teacher');
      expect(result.user.activeRole).toBe('teacher');
    });
  });

  // ── refreshTokens ──────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('returns new access + refresh tokens for a valid refresh token', async () => {
      const originalPayload = {
        userId: 'user-uuid-111', email: 'admin@test.com',
        firstName: 'Super', lastName: 'Admin',
        roles: ['admin'] as string[], activeRole: 'admin',
      };
      const validRefreshToken = signRefreshToken(originalPayload);

      const result = await refreshTokens(validRefreshToken);

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('throws INVALID_REFRESH_TOKEN for an invalid token string', async () => {
      await expect(refreshTokens('definitely.not.valid'))
        .rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });

    it('throws INVALID_REFRESH_TOKEN when an access token is used as refresh', async () => {
      // Access and refresh tokens use different secrets — cross-use should fail
      const { signAccessToken } = jest.requireActual('../../utils/jwt') as typeof import('../../utils/jwt');
      const accessToken = signAccessToken({
        userId: 'u', email: 'e@e.com', firstName: 'F', lastName: 'L',
        roles: ['admin'] as string[], activeRole: 'admin',
      });

      await expect(refreshTokens(accessToken))
        .rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    });
  });
});
