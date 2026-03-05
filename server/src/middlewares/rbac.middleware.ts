import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

// rbacMiddleware accepts lowercase role strings (matching JWT activeRole)
export function rbacMiddleware(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      logger.warn('RBAC: access denied', {
        user_id: req.user?.id,
        role: role ?? 'none',
        required_roles: allowedRoles,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}
