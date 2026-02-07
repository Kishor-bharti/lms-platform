import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as classesController from './classes.controller';

const router = Router();

router.use(authMiddleware);

// Teacher routes
router.post('/create', classesController.createClass);
router.post('/sessions/create', classesController.createSession);
router.post('/sessions/start', classesController.startSession);

// Student routes
router.get('/my-classes', classesController.getStudentClasses);

// Common routes
router.get('/teacher-classes', classesController.getTeacherClasses);
router.get('/sessions/:sessionId', classesController.getSessionById);

// New data-driven APIs
router.get('/my-classes-v2', classesController.getMyClasses);
router.get('/my-sessions-v2', classesController.getMySessionsV2);

export default router;
