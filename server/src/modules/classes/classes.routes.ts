import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import * as classesController from './classes.controller';

const router = Router();

router.use(authMiddleware);

// Teacher routes
const createClassSchema = z.object({
	title: z.string().min(1),
	subject: z.string().optional(),
});

const createSessionSchema = z.object({
	classId: z.string().min(1),
	title: z.string().min(1),
	scheduledAt: z.string().min(1),
});

const startSessionSchema = z.object({
	sessionId: z.string().min(1),
});

router.post('/create', validateBody(createClassSchema), classesController.createClass);
router.post('/sessions/create', validateBody(createSessionSchema), classesController.createSession);
router.post('/sessions/start', validateBody(startSessionSchema), classesController.startSession);

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

export default router;
