import bcrypt from 'bcrypt';

export async function hashPassword(plain: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(plain, saltRounds);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
