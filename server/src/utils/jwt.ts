import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { env } from '../config/env';

// ─── Token payload ──────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  activeRole: string;
}

// ─── Access token  (15 min) ─────────────────────────────────────
export function signAccessToken(payload: JwtPayload): string {
  const secret = env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET not configured');
  const options: SignOptions = { expiresIn: '15m' };
  return jwt.sign(payload, secret, options);
}

// ─── Refresh token  (7 days) ────────────────────────────────────
export function signRefreshToken(payload: JwtPayload): string {
  const secret = env.JWT_REFRESH_SECRET as Secret;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured');
  const options: SignOptions = { expiresIn: '7d' };
  return jwt.sign(payload, secret, options);
}

// ─── Verify access token (used by auth middleware) ──────────────
export function verifyAccessToken(token: string): JwtPayload {
  const secret = env.JWT_SECRET as Secret;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret) as JwtPayload;
}

// ─── Verify refresh token (used by refresh endpoint) ────────────
export function verifyRefreshToken(token: string): JwtPayload {
  const secret = env.JWT_REFRESH_SECRET as Secret;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not configured');
  return jwt.verify(token, secret) as JwtPayload;
}
