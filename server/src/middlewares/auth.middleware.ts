import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import logger from '../config/logger';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('Auth: missing or malformed Authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyAccessToken(token);
    // FIX: JWT payload has activeRole (not role)
    req.user = { id: payload.userId, role: payload.activeRole };
    return next();
  } catch {
    logger.warn('Auth: invalid or expired access token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
