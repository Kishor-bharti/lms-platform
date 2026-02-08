import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as classesController from './classes.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', classesController.getMyClasses);
router.get('/my-sessions-v2', classesController.getMySessionsV2);
router.post('/', classesController.createClass);
router.post('/:classId/enroll', classesController.enrollStudentById);
router.post('/:classId/complete', classesController.completeSessionById);

export default router;
