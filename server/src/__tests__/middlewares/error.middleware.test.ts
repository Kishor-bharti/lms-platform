import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../middlewares/error.middleware';

function makeRes() {
  const res = { headersSent: false } as Partial<Response>;
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json   = jest.fn().mockReturnValue(res);
  return res as Response;
}

const req  = {} as Request;
const next = jest.fn() as NextFunction;

describe('errorHandler', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  it('uses the error statusCode for the HTTP response', () => {
    const res = makeRes();
    errorHandler({ statusCode: 400, message: 'Bad request' } as any, req, res, next);
    expect((res as any).status).toHaveBeenCalledWith(400);
  });

  it('returns the error message in response body', () => {
    const res = makeRes();
    errorHandler({ statusCode: 400, message: 'Validation failed' } as any, req, res, next);
    const body = (res as any).json.mock.calls[0][0];
    expect(body.error.message).toBe('Validation failed');
  });

  it('includes the error code when provided', () => {
    const res = makeRes();
    errorHandler(
      { statusCode: 401, message: 'Unauthorized', code: 'INVALID_CREDENTIALS' } as any,
      req, res, next
    );
    const body = (res as any).json.mock.calls[0][0];
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('defaults to 500 for plain Error objects', () => {
    const res = makeRes();
    errorHandler(new Error('unexpected failure'), req, res, next);
    expect((res as any).status).toHaveBeenCalledWith(500);
  });

  it('masks 5xx messages in production', () => {
    process.env['NODE_ENV'] = 'production';
    const res = makeRes();
    errorHandler({ statusCode: 500, message: 'DB password exposed' } as any, req, res, next);
    const body = (res as any).json.mock.calls[0][0];
    expect(body.error.message).toBe('Internal server error');
  });

  it('masks ALL messages in production (including 4xx)', () => {
    process.env['NODE_ENV'] = 'production';
    const res = makeRes();
    errorHandler({ statusCode: 404, message: 'Resource not found' } as any, req, res, next);
    const body = (res as any).json.mock.calls[0][0];
    expect(body.error.message).toBe('Internal server error');
  });

  it('masks 5xx messages even in development (status-based, not env-based)', () => {
    process.env['NODE_ENV'] = 'development';
    const res = makeRes();
    errorHandler({ statusCode: 500, message: 'Detailed dev error' } as any, req, res, next);
    const body = (res as any).json.mock.calls[0][0];
    expect(body.error.message).toBe('Internal server error');
  });
});
