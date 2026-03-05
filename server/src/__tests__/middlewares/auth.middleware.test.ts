jest.mock('../../utils/jwt');

import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { verifyAccessToken, JwtPayload } from '../../utils/jwt';

const mockVerify = verifyAccessToken as jest.MockedFunction<typeof verifyAccessToken>;

function makeRes() {
  const res = {} as Response;
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeReq(authHeader?: string): Request {
  return { headers: authHeader ? { authorization: authHeader } : {} } as Request;
}

describe('authMiddleware', () => {
  let next: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  it('returns 401 when Authorization header is absent', () => {
    authMiddleware(makeReq(), makeRes(), next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((makeRes() as any).status).not.toHaveBeenCalledWith(200);
  });

  it('returns 401 for a non-Bearer scheme', () => {
    const res = makeRes();
    authMiddleware(makeReq('Basic abc123'), res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token verification throws', () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid signature'); });
    const res = makeRes();
    authMiddleware(makeReq('Bearer bad.token.here'), res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(401);
  });

  it('sets req.user and calls next() for a valid token', () => {
    const fakePayload: JwtPayload = {
      userId:     'user-uuid-abc',
      email:      'user@test.com',
      firstName:  'Test',
      lastName:   'User',
      roles:      ['teacher'],
      activeRole: 'teacher',
    };
    mockVerify.mockReturnValue(fakePayload);

    const req = makeReq('Bearer valid.jwt.token');
    authMiddleware(req, makeRes(), next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect((req as any).user).toEqual({ id: 'user-uuid-abc', role: 'teacher' });
  });
});
