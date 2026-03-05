import { hashPassword, comparePassword } from '../../utils/password';

describe('password utils', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash string', async () => {
      const hash = await hashPassword('MyPassword123');
      expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
    });

    it('produces a different hash each time (unique salts)', async () => {
      const h1 = await hashPassword('SamePassword');
      const h2 = await hashPassword('SamePassword');
      expect(h1).not.toBe(h2);
    });
  });

  describe('comparePassword', () => {
    it('returns true for the correct plaintext password', async () => {
      const hash = await hashPassword('Correct!Pass1');
      expect(await comparePassword('Correct!Pass1', hash)).toBe(true);
    });

    it('returns false for a wrong password', async () => {
      const hash = await hashPassword('Correct!Pass1');
      expect(await comparePassword('WrongPassword', hash)).toBe(false);
    });

    it('returns false for an empty string', async () => {
      const hash = await hashPassword('SomePassword');
      expect(await comparePassword('', hash)).toBe(false);
    });
  });
});
