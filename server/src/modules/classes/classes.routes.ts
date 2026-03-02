// classes.routes.ts — add POST /sessions/create
// REPLACE your existing classes.routes.ts with this file

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as classesController from './classes.controller';

const router = Router();

router.use(authMiddleware);

// ─── Subjects / Classes ───────────────────────────────────────
router.get('/my-classes-v2',  classesController.getMyClasses);

// ─── Sessions ─────────────────────────────────────────────────
router.get('/my-sessions-v2', classesController.getMySessionsV2);

// Create a new session — teacher/admin only
router.post('/sessions/create', classesController.createSessionHandler);

// Start session (Zoom) — teacher/admin only
router.post('/sessions/:sessionId/start',    classesController.startSessionById);

// Mark session completed — teacher/admin only
router.post('/sessions/:sessionId/complete', classesController.completeSessionById);

// Cancel/delete session — creator or admin only
router.delete('/sessions/:sessionId', classesController.deleteSessionById);

export default router;
