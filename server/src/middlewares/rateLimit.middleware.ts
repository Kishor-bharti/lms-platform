import rateLimit from 'express-rate-limit';
import logger from '../config/logger';

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
  handler(req, res, _next, options) {
    logger.warn('Rate limit hit: too many login attempts', {
      ip: req.ip,
      path: req.path,
      limit: options.limit,
      window_ms: options.windowMs,
    });
    res.status(options.statusCode).json(options.message);
  },
});