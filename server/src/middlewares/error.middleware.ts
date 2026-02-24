import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

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
    details: err.details,
    stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
  };

  console.error('[error]', logPayload);

  return res.status(status).json({
    error: {
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
      code,
    },
  });
}