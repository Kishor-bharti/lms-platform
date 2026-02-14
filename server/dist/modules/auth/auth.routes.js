"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_controller_1 = require("./auth.controller");
const rateLimit_middleware_1 = require("../../middlewares/rateLimit.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
router.post('/login', (0, validate_middleware_1.validateBody)(loginSchema), rateLimit_middleware_1.loginRateLimiter, auth_controller_1.login);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map