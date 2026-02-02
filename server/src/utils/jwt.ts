import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { env } from '../config/env';
import { Role } from '../modules/auth/auth.types';

export interface JwtPayload {
  userId: number;
  role: Role;
}

const defaultExpiry = 60 * 60 * 24; // 1 day in seconds

export function signAccessToken(payload: JwtPayload, expiresIn: number = defaultExpiry): string {
  const secret: Secret | undefined = env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const options: SignOptions = { expiresIn };
  return jwt.sign(payload, secret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret: Secret | undefined = env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret) as JwtPayload;
}
