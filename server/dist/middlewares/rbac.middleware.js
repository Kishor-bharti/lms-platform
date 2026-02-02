"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacMiddleware = rbacMiddleware;
function rbacMiddleware(allowedRoles) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }
        return next();
    };
}
//# sourceMappingURL=rbac.middleware.js.map