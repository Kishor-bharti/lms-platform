import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as assignmentController from './assignment.controller';

const router = Router();
router.use(authMiddleware);

// Assignment CRUD (teacher)
router.post('/', assignmentController.createAssignment);
router.get('/subject/:subjectId', assignmentController.getAssignmentsBySubject);
router.patch('/:assignmentId/publish', assignmentController.publishAssignment);
router.delete('/:assignmentId', assignmentController.deleteAssignment);
router.get('/:assignmentId/submissions', assignmentController.getSubmissions);
router.patch('/submissions/:submissionId/grade', assignmentController.gradeSubmission);

// Student submit
router.post('/:assignmentId/submit', assignmentController.submitAssignment);

export default router;
