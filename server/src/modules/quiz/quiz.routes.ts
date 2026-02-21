import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import * as quizController from './quiz.controller';

const router = Router();
router.use(authMiddleware);

// Quiz CRUD (teacher)
router.post('/', quizController.createQuiz);
router.get('/subject/:subjectId', quizController.getQuizzesBySubject);
router.get('/:quizId', quizController.getQuizDetail);
router.patch('/:quizId/publish', quizController.publishQuiz);

// Attempts (student)
router.post('/:quizId/attempts', quizController.startAttempt);
router.get('/:quizId/attempts', quizController.getMyAttempts);
router.post('/attempts/:attemptId/submit', quizController.submitAttempt);
router.get('/attempts/:attemptId/result', quizController.getAttemptResult);

export default router;
