import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getMyProgress, getMyWeeklyActivity, getMyQuizHistory } from './progress.controller';

const router = Router();
router.use(authMiddleware);
router.get('/me',             getMyProgress);
router.get('/weekly',         getMyWeeklyActivity);
router.get('/quiz-history',   getMyQuizHistory);

export default router;
