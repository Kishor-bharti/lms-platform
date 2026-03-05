jest.mock('../../config/db');
jest.mock('../../utils/password');

import { getProfile, updateProfile, changePassword } from '../../modules/profile/profile.service';
import { query } from '../../config/db';
import { comparePassword, hashPassword } from '../../utils/password';

const mockQuery           = query as jest.MockedFunction<typeof query>;
const mockComparePassword = comparePassword as jest.MockedFunction<typeof comparePassword>;
const mockHashPassword    = hashPassword as jest.MockedFunction<typeof hashPassword>;

const profileRow = {
  id: 'user-uuid', email: 'user@test.com',
  first_name: 'John', last_name: 'Doe',
  phone: null, avatar_url: null, is_active: true,
  last_login_at: null, created_at: '', roles: ['student'],
};

describe('profile.service', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── getProfile ──────────────────────────────────────────────────────

  describe('getProfile', () => {
    it('returns the user profile with roles', async () => {
      mockQuery.mockResolvedValueOnce([profileRow]);

      const result = await getProfile('user-uuid');

      expect(result.email).toBe('user@test.com');
      expect(result.roles).toContain('student');
    });

    it('throws when user is not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(getProfile('bad-uuid')).rejects.toThrow('User not found');
    });
  });

  // ── updateProfile ───────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('updates provided fields and returns the updated profile', async () => {
      const updatedRow = { ...profileRow, first_name: 'Jane' };
      mockQuery
        .mockResolvedValueOnce([])           // UPDATE users
        .mockResolvedValueOnce([updatedRow]); // getProfile call after update

      const result = await updateProfile('user-uuid', { first_name: 'Jane' });

      expect(result.first_name).toBe('Jane');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('skips the UPDATE and calls getProfile directly when no fields are provided', async () => {
      mockQuery.mockResolvedValueOnce([profileRow]); // only getProfile called

      const result = await updateProfile('user-uuid', {});

      expect(result.email).toBe('user@test.com');
      expect(mockQuery).toHaveBeenCalledTimes(1); // only getProfile, no UPDATE
    });
  });

  // ── changePassword ──────────────────────────────────────────────────

  describe('changePassword', () => {
    it('updates the password when current password is correct', async () => {
      mockQuery
        .mockResolvedValueOnce([{ password_hash: '$2b$10$fakeoldhash' }]) // SELECT user
        .mockResolvedValueOnce([]);                                         // UPDATE password
      mockComparePassword.mockResolvedValueOnce(true);
      mockHashPassword.mockResolvedValueOnce('$2b$10$fakenewhash');

      await changePassword('user-uuid', {
        current_password: 'OldPass@1', new_password: 'NewPass@1',
      });

      expect(mockHashPassword).toHaveBeenCalledWith('NewPass@1');
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });

    it('throws WRONG_PASSWORD when current password does not match', async () => {
      mockQuery.mockResolvedValueOnce([{ password_hash: '$2b$10$fakeoldhash' }]);
      mockComparePassword.mockResolvedValueOnce(false);

      await expect(changePassword('user-uuid', {
        current_password: 'WrongOld', new_password: 'NewPass@1',
      })).rejects.toThrow('WRONG_PASSWORD');
    });

    it('throws TOO_SHORT when new password is less than 6 characters', async () => {
      mockQuery.mockResolvedValueOnce([{ password_hash: '$2b$10$fakeoldhash' }]);
      mockComparePassword.mockResolvedValueOnce(true);

      await expect(changePassword('user-uuid', {
        current_password: 'OldPass@1', new_password: 'abc',
      })).rejects.toThrow('TOO_SHORT');
    });

    it('throws when user is not found', async () => {
      mockQuery.mockResolvedValueOnce([]);

      await expect(changePassword('bad-uuid', {
        current_password: 'any', new_password: 'any123',
      })).rejects.toThrow('User not found');
    });
  });
});
