import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadQuizImage } from './upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
});
const router = Router();
router.use(authMiddleware);
router.post('/quiz-image', upload.single('image'), uploadQuizImage);
export default router;
