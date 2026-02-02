import { Request, Response, NextFunction } from 'express';
import { Role } from '../modules/auth/auth.types';
export declare function rbacMiddleware(allowedRoles: Role[]): (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
//# sourceMappingURL=rbac.middleware.d.ts.map