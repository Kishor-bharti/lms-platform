import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../utils/jwt';

const payload = {
  userId:     'user-uuid-123',
  email:      'test@example.com',
  firstName:  'Test',
  lastName:   'User',
  roles:      ['student'] as string[],
  activeRole: 'student',
};

describe('jwt utils', () => {
  describe('signAccessToken', () => {
    it('returns a non-empty JWT string', () => {
      const token = signAccessToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('encodes the correct payload fields', () => {
      const token   = signAccessToken(payload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.activeRole).toBe(payload.activeRole);
      expect(decoded.roles).toEqual(payload.roles);
    });
  });

  describe('signRefreshToken', () => {
    it('returns a non-empty JWT string', () => {
      const token = signRefreshToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('encodes the correct payload fields', () => {
      const token   = signRefreshToken(payload);
      const decoded = verifyRefreshToken(token);
      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
    });
  });

  describe('verifyAccessToken', () => {
    it('throws for a completely invalid string', () => {
      expect(() => verifyAccessToken('not.a.token')).toThrow();
    });

    it('throws for a token signed with the wrong secret', () => {
      const fakeToken = jwt.sign(payload, 'wrong-secret');
      expect(() => verifyAccessToken(fakeToken)).toThrow();
    });

    it('throws when a refresh token is passed instead', () => {
      // Refresh token is signed with JWT_REFRESH_SECRET, not JWT_SECRET
      const refreshToken = signRefreshToken(payload);
      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('throws for an invalid token', () => {
      expect(() => verifyRefreshToken('bad.token.here')).toThrow();
    });

    it('throws when an access token is passed instead', () => {
      // Access token is signed with JWT_SECRET, not JWT_REFRESH_SECRET
      const accessToken = signAccessToken(payload);
      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });
  });
});
