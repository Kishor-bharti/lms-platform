import { Request, Response, NextFunction } from 'express';
import { Role } from '../modules/auth/auth.types';

export function rbacMiddleware(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}
