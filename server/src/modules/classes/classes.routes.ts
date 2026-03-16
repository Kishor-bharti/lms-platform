// classes.routes.ts — add POST /sessions/create
// REPLACE your existing classes.routes.ts with this file

import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as classesController from './classes.controller';

const router = Router();

router.use(authMiddleware);

// ─── Subjects / Classes ───────────────────────────────────────
router.get('/my-classes-v2',  classesController.getMyClasses);

// A6: Teachers assigned to a subject (for session creation teacher selector)
router.get('/subjects/:subjectId/teachers', classesController.getSubjectTeachersHandler);
// T1/T6: Enrolled students for a subject (teacher use — session/assignment targeting)
router.get('/subjects/:subjectId/students', classesController.getSubjectStudentsHandler);

// ─── Sessions ─────────────────────────────────────────────────
router.get('/my-sessions-v2',   classesController.getMySessionsV2);
// T7: Teacher session history — per-student session count
router.get('/my-session-stats', classesController.getMySessionStatsHandler);

// Create a new session — teacher/admin only
router.post('/sessions/create', classesController.createSessionHandler);

// Start session (Zoom) — teacher/admin only
router.post('/sessions/:sessionId/start',    classesController.startSessionById);

// Mark session completed — teacher/admin only
router.post('/sessions/:sessionId/complete', classesController.completeSessionById);

// Cancel/delete session — creator or admin only
router.delete('/sessions/:sessionId', classesController.deleteSessionById);

export default router;
