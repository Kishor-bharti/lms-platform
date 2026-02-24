import { Request, Response, NextFunction } from 'express';

// rbacMiddleware accepts lowercase role strings (matching JWT activeRole)
export function rbacMiddleware(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}
