import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import logger from '../config/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function errorHandler(err: AppError, req: Request, res: Response, _next: NextFunction) {
  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
  const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  const logPayload = {
    message: err.message,
    code: err.code,
    status,
    path: req.path,
    method: req.method,
    user_id: req.user?.id,
    role: req.user?.role,
    ip: req.ip,
    details: err.details,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
  };

  if (status >= 500) {
    logger.error('Unhandled server error', logPayload);
  } else {
    logger.warn('Client error response', logPayload);
  }

  return res.status(status).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      code,
    },
  });
}
