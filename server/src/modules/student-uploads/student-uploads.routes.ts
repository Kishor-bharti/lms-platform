import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { getUploads, createUpload, addFeedback, getStudentTeachers, deleteUpload, getUploadUrl } from './student-uploads.controller';

const router = Router();
router.use(authMiddleware);

router.get('/subject/:subjectId',          getUploads);
router.get('/:uploadId/url',               getUploadUrl);
router.get('/my-teachers/:subjectId',      getStudentTeachers);
router.post('/',                           createUpload);
router.patch('/:uploadId/feedback',        addFeedback);
router.delete('/:uploadId',               deleteUpload);

export default router;
