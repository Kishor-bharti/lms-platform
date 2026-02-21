import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getMyProgress } from './progress.controller';

const router = Router();
router.use(authMiddleware);
router.get('/me', getMyProgress);

export default router;
