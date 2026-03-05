import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// Paths to skip from HTTP access logs (health/latency checks create noise)
const SKIP_PATHS = new Set(['/health', '/test-latency']);

export function httpLogger(req: Request, res: Response, next: NextFunction) {
  if (SKIP_PATHS.has(req.path)) return next();

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    logger.http('HTTP request', {
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length ? req.query : undefined,
      status,
      duration_ms: duration,
      ip: req.ip || req.socket?.remoteAddress,
      user_id: req.user?.id,
      role: req.user?.role,
      user_agent: req.headers['user-agent'],
      content_length: res.getHeader('content-length'),
    });

    // Separately log slow requests (>2s) as warnings so they stand out
    if (duration > 2000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration_ms: duration,
        status,
        user_id: req.user?.id,
      });
    }
  });

  next();
}
