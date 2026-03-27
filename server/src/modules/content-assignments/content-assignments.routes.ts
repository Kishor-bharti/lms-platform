import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as caController from './content-assignments.controller';

const router = Router();
router.use(authMiddleware);

router.post('/',                                  caController.assignContent);
router.get('/subject/:subjectId',               caController.getAssignmentsForSubject);
router.get('/course/:courseId',                 caController.getAssignmentsForCourse);
router.get('/course/:courseId/students',        caController.getCourseStudents);
router.get('/:contentType/:contentId',          caController.getAssignmentsForContent);
router.delete('/:id',                           caController.revokeAssignment);

export default router;
