"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const auth_service_1 = require("./auth.service");
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }
    try {
        const result = await (0, auth_service_1.login)(email, password);
        return res.json(result);
    }
    catch (err) {
        const code = err?.code;
        if (code === 'USER_INACTIVE') {
            return res.status(403).json({ message: 'User is inactive' });
        }
        if (code === 'USER_NOT_FOUND' || code === 'INVALID_PASSWORD') {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        return res.status(500).json({ message: 'Internal server error' });
    }
}
//# sourceMappingURL=auth.controller.js.map