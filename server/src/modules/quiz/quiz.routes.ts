import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import * as quizController from './quiz.controller';

const router = Router();
router.use(authMiddleware);

const optionSchema = z.object({
  label:      z.string().min(1).max(5),
  text:       z.string().optional().default(''),   // optional when imageUrl is set
  imageUrl:   z.string().url().optional().or(z.literal('')),
  is_correct: z.boolean(),
});

const questionSchema = z.object({
  question_text: z.string().min(1),
  image_url:     z.string().url().optional().or(z.literal('')),
  explanation:   z.string().optional(),
  explanation_image_url: z.string().url().optional().or(z.literal('')),
  difficulty:    z.enum(['easy', 'medium', 'hard']),
  marks:         z.number().min(0.5).max(100),
  order_index:   z.number().int().min(0),
  topic_id:      z.string().uuid().optional().or(z.literal('')),
  options:       z.array(optionSchema).min(2).max(6).refine(
    (opts) => opts.filter(o => o.is_correct).length === 1,
    { message: 'Exactly one option must be marked correct' }
  ),
});

const createQuizSchema = z.object({
  subjectId:         z.string().uuid().optional(),
  courseId:          z.string().uuid().optional(),
  topicId:           z.string().uuid().optional(),
  title:             z.string().min(1).max(255),
  quiz_type:         z.enum(['test', 'practice']),
  description:       z.string().optional(),
  duration_minutes:  z.number().int().min(0).max(300).default(0),
  max_attempts:      z.number().int().min(1).max(10).optional().default(1),
  questions:         z.array(questionSchema).min(1),
}).refine(
  (data) => data.subjectId || data.courseId,
  { message: 'Either subjectId or courseId is required' }
);

const updateQuizSchema = z.object({
  topicId:           z.string().uuid().optional(),
  title:             z.string().min(1).max(255),
  quiz_type:         z.enum(['test', 'practice']),
  description:       z.string().optional(),
  duration_minutes:  z.number().int().min(0).max(300).default(0),
  max_attempts:      z.number().int().min(1).max(10).optional().default(1),
  questions:         z.array(questionSchema).min(1),
});

// Quiz CRUD
router.post('/', validateBody(createQuizSchema), quizController.createQuiz);
router.get('/course/:courseId', quizController.getQuizzesByCourse);
router.get('/subject/:subjectId', quizController.getQuizzesBySubject);
router.get('/subject/:subjectId/status', quizController.getStudentQuizStatuses);
router.get('/:quizId', quizController.getQuizDetail);
router.patch('/:quizId/publish', quizController.publishQuiz);
router.put('/:quizId', validateBody(updateQuizSchema), quizController.updateQuiz);
router.delete('/:quizId', quizController.deleteQuiz);

// Per-quiz write permissions (admin only)
router.get('/:quizId/permissions', quizController.getQuizWritePermissions);
router.post('/:quizId/permissions', quizController.grantQuizWritePermission);
router.delete('/:quizId/permissions/:teacherId', quizController.revokeQuizWritePermission);

// Attempts (student)
router.post('/:quizId/attempts', quizController.startAttempt);
router.get('/:quizId/attempts', quizController.getMyAttempts);
router.post('/attempts/:attemptId/submit', quizController.submitAttempt);
router.post('/attempts/:attemptId/partial-submit', quizController.partialSubmitPractice);
router.get('/attempts/:attemptId/resume', quizController.resumePractice);
router.get('/attempts/:attemptId/result', quizController.getAttemptResult);

export default router;
