// courses.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as coursesController from './courses.controller';

const router = Router();

router.use(authMiddleware);

// GET /api/courses/my-courses — returns courses + subjects for the logged-in user
router.get('/my-courses', coursesController.getMyCourses);

export default router;
