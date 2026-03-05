import { Request, Response, NextFunction } from 'express';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

function makeRes() {
  const res = {} as Response;
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(role?: string): Request {
  const req: any = {};
  if (role !== undefined) req.user = { id: 'uuid', role };
  return req as Request;
}

describe('rbacMiddleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    next = jest.fn();
  });

  it('calls next() when the user role is in the allowed list', () => {
    const mw = rbacMiddleware(['admin', 'teacher']);
    mw(makeReq('teacher'), makeRes(), next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when the user role is NOT in the allowed list', () => {
    const mw  = rbacMiddleware(['admin']);
    const res = makeRes();
    mw(makeReq('student'), res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(403);
  });

  it('returns 403 when req.user is not set at all', () => {
    const mw  = rbacMiddleware(['admin']);
    const res = makeRes();
    mw(makeReq(), res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(403);
  });

  it('allows admin when admin is the only permitted role', () => {
    const mw = rbacMiddleware(['admin']);
    mw(makeReq('admin'), makeRes(), next as NextFunction);
    expect(next).toHaveBeenCalled();
  });

  it('allows student when multiple roles are permitted', () => {
    const mw = rbacMiddleware(['admin', 'teacher', 'student']);
    mw(makeReq('student'), makeRes(), next as NextFunction);
    expect(next).toHaveBeenCalled();
  });
});
