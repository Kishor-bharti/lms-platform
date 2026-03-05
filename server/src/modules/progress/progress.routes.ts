import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import {
  getMyProgress,
  getMyWeeklyActivity,
  getActivityRange,
  getMyQuizHistory,
  getMyTopicAnalysis,
  getStudentReport,
  getStudentWeeklyActivity,
  getStudentActivityRange,
  getStudentQuizHistory,
  getStudentTopicAnalysis,
} from './progress.controller';

const router = Router();
router.use(authMiddleware);

// Student endpoints
router.get('/me',                             getMyProgress);
router.get('/weekly',                         getMyWeeklyActivity);
router.get('/activity',                       getActivityRange);
router.get('/quiz-history',                   getMyQuizHistory);
router.get('/topics/:subjectId',              getMyTopicAnalysis);

// Teacher: view a specific student's report data
router.get('/student/:studentId',             getStudentReport);
router.get('/student/:studentId/weekly',      getStudentWeeklyActivity);
router.get('/student/:studentId/activity',    getStudentActivityRange);
router.get('/student/:studentId/quiz-history',getStudentQuizHistory);
router.get('/student/:studentId/topics/:subjectId', getStudentTopicAnalysis);

export default router;
