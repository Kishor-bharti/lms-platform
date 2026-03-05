import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../../middlewares/validate.middleware';

const schema = z.object({
  name: z.string().min(1),
  age:  z.number().int().positive(),
});

function makeRes() {
  const res = {} as Response;
  (res as any).status = jest.fn().mockReturnValue(res);
  (res as any).json   = jest.fn().mockReturnValue(res);
  return res;
}

describe('validateBody', () => {
  const mw = validateBody(schema);
  let next: jest.Mock;

  beforeEach(() => { next = jest.fn(); });

  it('calls next() and updates req.body for valid input', () => {
    const req = { body: { name: 'Alice', age: 25 } } as Request;
    mw(req, makeRes(), next as NextFunction);
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Alice', age: 25 });
  });

  it('strips unknown fields from req.body', () => {
    const req = { body: { name: 'Alice', age: 25, extra: 'should-go' } } as Request;
    mw(req, makeRes(), next as NextFunction);
    expect(next).toHaveBeenCalled();
    expect(req.body).not.toHaveProperty('extra');
  });

  it('returns 400 for a missing required field', () => {
    const res  = makeRes();
    const req  = { body: { name: 'Alice' } } as Request;
    mw(req, res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for a wrong field type', () => {
    const res = makeRes();
    const req = { body: { name: 'Alice', age: 'not-a-number' } } as Request;
    mw(req, res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(400);
  });

  it('returns 400 for a failed string constraint', () => {
    const res = makeRes();
    const req = { body: { name: '', age: 25 } } as Request;
    mw(req, res, next as NextFunction);
    expect(next).not.toHaveBeenCalled();
    expect((res as any).status).toHaveBeenCalledWith(400);
  });

  it('includes field-level error details in the response', () => {
    const res = makeRes();
    mw({ body: { name: 'Alice' } } as Request, res, next as NextFunction);
    const body = (res as any).json.mock.calls[0][0];
    expect(body).toHaveProperty('details');
  });
});
