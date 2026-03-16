import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadQuizImage, uploadAssignmentFile } from './upload.controller';

const upload2MB  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2  * 1024 * 1024 } });
const upload10MB = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(authMiddleware);
router.post('/quiz-image',  upload2MB.single('image'),  uploadQuizImage);
router.post('/assignment',  upload10MB.single('file'),  uploadAssignmentFile);
export default router;
