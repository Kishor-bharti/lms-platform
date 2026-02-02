"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jwt_1 = require("../utils/jwt");
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    const token = authHeader.substring(7);
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = { id: payload.userId, role: payload.role };
        return next();
    }
    catch (e) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}
//# sourceMappingURL=auth.middleware.js.map