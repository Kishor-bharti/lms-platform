// courses.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as coursesController from './courses.controller';

const router = Router();

router.use(authMiddleware);

// GET /api/courses/my-courses — returns courses + subjects for the logged-in user
router.get('/my-courses', coursesController.getMyCourses);

// GET /api/courses/:courseId/topics — all topics for all subjects in a course
router.get('/:courseId/topics', coursesController.getCourseTopics);

export default router;
