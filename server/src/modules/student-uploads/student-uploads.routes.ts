import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getUploads, createUpload, deleteUpload } from './student-uploads.controller';

const router = Router();
router.use(authMiddleware);

router.get('/subject/:subjectId', getUploads);
router.post('/',                  createUpload);
router.delete('/:uploadId',      deleteUpload);

export default router;
