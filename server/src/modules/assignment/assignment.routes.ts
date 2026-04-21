import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as assignmentController from './assignment.controller';


const router = Router();
router.use(authMiddleware);

// Fresh signed URL on demand (prevents stale URL errors in SPA)
router.get('/:assignmentId/url',                   assignmentController.getAssignmentUrl);
router.get('/submissions/:submissionId/url',       assignmentController.getSubmissionUrl);

// Assignment CRUD (teacher)
router.post('/', assignmentController.createAssignment);
router.get('/subject/:subjectId', assignmentController.getAssignmentsBySubject);
router.patch('/:assignmentId/publish', assignmentController.publishAssignment);
router.put('/:assignmentId', assignmentController.updateAssignment);
router.delete('/:assignmentId', assignmentController.deleteAssignment);
router.get('/:assignmentId/submissions', assignmentController.getSubmissions);
router.patch('/submissions/:submissionId/grade', assignmentController.gradeSubmission);

// Student submit
router.post('/:assignmentId/submit', assignmentController.submitAssignment);

export default router;
