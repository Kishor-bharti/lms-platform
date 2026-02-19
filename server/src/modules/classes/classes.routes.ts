// classes.routes.ts

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as classesController from './classes.controller';

const router = Router();

// All routes require a valid JWT
router.use(authMiddleware);

// ─── Subjects / Classes ───────────────────────────────────────
// Returns subjects based on role (teacher → assigned, student → enrolled, admin → all)
router.get('/my-classes-v2', classesController.getMyClasses);

// ─── Sessions ─────────────────────────────────────────────────
// Returns sessions based on role
router.get('/my-sessions-v2', classesController.getMySessionsV2);

// Start a session (creates Zoom meeting) — teacher/admin only
router.post('/sessions/:sessionId/start', classesController.startSessionById);

// Mark session completed — teacher/admin only
router.post('/sessions/:sessionId/complete', classesController.completeSessionById);

export default router;
