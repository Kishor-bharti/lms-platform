"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const validate_middleware_1 = require("../../middlewares/validate.middleware");
const classesController = __importStar(require("./classes.controller"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
// Teacher routes
const createClassSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    subject: zod_1.z.string().optional(),
});
const createSessionSchema = zod_1.z.object({
    classId: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    scheduledAt: zod_1.z.string().min(1),
});
const startSessionSchema = zod_1.z.object({
    sessionId: zod_1.z.string().min(1),
});
router.post('/create', (0, validate_middleware_1.validateBody)(createClassSchema), classesController.createClass);
router.post('/sessions/create', (0, validate_middleware_1.validateBody)(createSessionSchema), classesController.createSession);
router.post('/sessions/start', (0, validate_middleware_1.validateBody)(startSessionSchema), classesController.startSession);
// Student routes
router.get('/my-classes', classesController.getStudentClasses);
// Common routes
router.get('/teacher-classes', classesController.getTeacherClasses);
router.get('/sessions/:sessionId', classesController.getSessionById);
// New data-driven APIs
router.get('/my-classes-v2', classesController.getMyClasses);
router.get('/my-sessions-v2', classesController.getMySessionsV2);
// Sessions API
router.post('/sessions/:sessionId/start', classesController.startSessionById);
router.post('/sessions/:sessionId/complete', classesController.completeSessionById);
exports.default = router;
//# sourceMappingURL=classes.routes.js.map