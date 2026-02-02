"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const db_1 = require("../../config/db");
const password_1 = require("../../utils/password");
const jwt_1 = require("../../utils/jwt");
async function login(email, password) {
    const rows = await (0, db_1.query)('SELECT id, name, email, password_hash, role, status, created_at FROM users WHERE email = ? LIMIT 1', [email]);
    if (rows.length === 0) {
        const err = new Error('USER_NOT_FOUND');
        err.code = 'USER_NOT_FOUND';
        throw err;
    }
    const user = rows[0];
    if (user.status !== 'ACTIVE') {
        const err = new Error('USER_INACTIVE');
        err.code = 'USER_INACTIVE';
        throw err;
    }
    const match = await (0, password_1.comparePassword)(password, user.password_hash);
    if (!match) {
        const err = new Error('INVALID_PASSWORD');
        err.code = 'INVALID_PASSWORD';
        throw err;
    }
    const token = (0, jwt_1.signAccessToken)({ userId: user.id, role: user.role });
    return {
        token,
        user: {
            id: user.id,
            name: user.name,
            role: user.role
        }
    };
}
//# sourceMappingURL=auth.service.js.map