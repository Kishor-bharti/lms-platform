import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import * as quizController from './quiz.controller';

const router = Router();
router.use(authMiddleware);

const optionSchema = z.object({
  label:      z.string().min(1).max(5),
  text:       z.string().min(1),
  is_correct: z.boolean(),
});

const questionSchema = z.object({
  question_text: z.string().min(1),
  explanation:   z.string().optional(),
  difficulty:    z.enum(['easy', 'medium', 'hard']),
  marks:         z.number().int().min(1).max(100),
  order_index:   z.number().int().min(0),
  options:       z.array(optionSchema).min(2).max(6).refine(
    (opts) => opts.filter(o => o.is_correct).length === 1,
    { message: 'Exactly one option must be marked correct' }
  ),
});

const createQuizSchema = z.object({
  subjectId:         z.string().uuid(),
  title:             z.string().min(1).max(255),
  quiz_type:         z.enum(['test', 'practice']),
  description:       z.string().optional(),
  duration_minutes:  z.number().int().min(1).max(300),
  passing_score:     z.number().min(0).max(100).optional(),
  max_attempts:      z.number().int().min(1).max(10).optional(),
  questions:         z.array(questionSchema).min(1),
});

// Quiz CRUD (teacher)
router.post('/', validateBody(createQuizSchema), quizController.createQuiz);
router.get('/subject/:subjectId', quizController.getQuizzesBySubject);
router.get('/:quizId', quizController.getQuizDetail);
router.patch('/:quizId/publish', quizController.publishQuiz);

// Attempts (student)
router.post('/:quizId/attempts', quizController.startAttempt);
router.get('/:quizId/attempts', quizController.getMyAttempts);
router.post('/attempts/:attemptId/submit', quizController.submitAttempt);
router.get('/attempts/:attemptId/result', quizController.getAttemptResult);

export default router;
