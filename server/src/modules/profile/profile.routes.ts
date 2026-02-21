import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getProfile, updateProfile, changePassword } from './profile.controller';

const router = Router();
router.use(authMiddleware);

router.get('/me',           getProfile);
router.patch('/me',         updateProfile);
router.post('/me/password', changePassword);

export default router;
