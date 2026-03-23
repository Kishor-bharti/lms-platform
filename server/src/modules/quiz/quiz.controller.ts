import { Request, Response } from 'express';
import logger from '../../config/logger';
import { query } from '../../config/db';
import * as quizService from './quiz.service';
import { hasContentWritePermission, hasQuizWritePermission } from '../../utils/permissions';

export async function getQuizzesBySubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const role = req.user?.role ?? 'student';
    const userId = req.user?.id;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    const quizzes = await quizService.getQuizzesBySubject(subjectId, role, userId);
    return res.json(quizzes);
  } catch (err) {
    logger.error('[quiz] getQuizzesBySubject:', err);
    return res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
}

export async function getQuizDetail(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const role = req.user?.role ?? 'student';
    if (!quizId) {
      return res.status(400).json({ error: 'quizId is required' });
    }
    const quiz = await quizService.getQuizWithQuestions(quizId, role);
    return res.json(quiz);
  } catch (err: any) {
    if (err.message === 'Quiz not found') return res.status(404).json({ error: 'Quiz not found' });
    logger.error('[quiz] getQuizDetail:', err);
    return res.status(500).json({ error: 'Failed to fetch quiz' });
  }
}

export async function createQuiz(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { subjectId, courseId, topicId, title, quiz_type, description, duration_minutes, max_attempts, questions } = req.body;

    // Admin always allowed; teachers need write permission on the subject
    const canCreate = await hasContentWritePermission(userId, role, subjectId ?? courseId ?? '');
    if (!canCreate) {
      return res.status(403).json({ error: 'Insufficient permissions to create quizzes in this subject' });
    }

    const quiz = await quizService.createQuiz({
      subjectId, courseId, topicId, createdBy: userId, title, quiz_type, description,
      duration_minutes, max_attempts, questions: questions ?? [],
    });
    return res.status(201).json(quiz);
  } catch (err: any) {
    logger.error('[quiz] createQuiz:', err);
    return res.status(500).json({ error: err.message || 'Failed to create quiz' });
  }
}

export async function publishQuiz(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const { is_published } = req.body;
    if (!quizId) {
      return res.status(400).json({ error: 'quizId is required' });
    }
    const role = req.user!.role;
    
    // Only admin can publish/unpublish quizzes
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can publish quizzes' });
    }

    await quizService.setQuizPublished(quizId, Boolean(is_published));
    return res.json({ success: true });
  } catch (err) {
    logger.error('[quiz] publishQuiz:', err);
    return res.status(500).json({ error: 'Failed to update quiz' });
  }
}

export async function startAttempt(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const studentId = req.user!.id;
    if (!quizId) {
      return res.status(400).json({ error: 'quizId is required' });
    }
    const result = await quizService.startAttempt(quizId, studentId);
    return res.status(201).json(result);
  } catch (err: any) {
    if (err.message === 'NOT_ASSIGNED') {
      return res.status(403).json({ error: 'This quiz has not been assigned to you' });
    }
    if (err.message === 'QUIZ_NOT_FOUND') {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    if (err.message === 'QUIZ_NOT_PUBLISHED') {
      return res.status(403).json({ error: 'Quiz is not available yet' });
    }
    if (err.message === 'MAX_ATTEMPTS_REACHED') {
      return res.status(409).json({ error: 'Maximum attempts reached for this quiz' });
    }
    if (err.message === 'HAS_PARTIAL_ATTEMPT') {
      return res.status(409).json({ error: 'You have a saved practice session — resume it first' });
    }
    logger.error('[quiz] startAttempt:', err);
    return res.status(500).json({ error: 'Failed to start attempt' });
  }
}

export async function submitAttempt(req: Request, res: Response) {
  try {
    const { attemptId } = req.params;
    const studentId = req.user!.id;
    const { answers, timeTakenSeconds } = req.body;
    if (!attemptId) {
      return res.status(400).json({ error: 'attemptId is required' });
    }
    const result = await quizService.submitAttempt({
      attemptId: attemptId, studentId, answers: answers ?? [], timeTakenSeconds: timeTakenSeconds ?? 0,
    });
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'Attempt not found') return res.status(404).json({ error: 'Attempt not found' });
    if (err.message === 'Attempt already submitted') return res.status(409).json({ error: 'Already submitted' });
    logger.error('[quiz] submitAttempt:', err);
    return res.status(500).json({ error: 'Failed to submit attempt' });
  }
}

export async function getAttemptResult(req: Request, res: Response) {
  try {
    const { attemptId } = req.params;
    const studentId = req.user!.id;
    if (!attemptId) {
      return res.status(400).json({ error: 'attemptId is required' });
    }
    const result = await quizService.getAttemptResult(attemptId, studentId);
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'Attempt not found') return res.status(404).json({ error: 'Attempt not found' });
    logger.error('[quiz] getAttemptResult:', err);
    return res.status(500).json({ error: 'Failed to get result' });
  }
}

export async function getMyAttempts(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const studentId = req.user!.id;
    if (!quizId) {
      return res.status(400).json({ error: 'quizId is required' });
    }
    const attempts = await quizService.getMyAttempts(quizId, studentId);
    return res.json(attempts);
  } catch (err) {
    logger.error('[quiz] getMyAttempts:', err);
    return res.status(500).json({ error: 'Failed to get attempts' });
  }
}

export async function updateQuiz(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;

    // Look up quiz to get subjectId for permission check
    const quizRows = await query<any>('SELECT subject_id FROM quizzes WHERE id = $1', [quizId]);
    if (!quizRows[0]) return res.status(404).json({ error: 'Quiz not found' });
    const subjectId = quizRows[0].subject_id;

    // Admin always allowed; teacher needs subject-level write OR per-quiz write
    const canEdit = await hasQuizWritePermission(userId, role, quizId!, subjectId);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have write permission for this quiz' });
    }

    const { topicId, title, quiz_type, description, duration_minutes, max_attempts, questions } = req.body;
    const quiz = await quizService.updateQuiz({
      quizId: quizId!, updatedBy: userId, topicId, title, quiz_type, description,
      duration_minutes, max_attempts, questions: questions ?? [],
    });

    // If a teacher edited, auto-unpublish so admin must review before re-publishing
    if (role === 'teacher') {
      await quizService.setQuizPublished(quizId!, false);
    }

    return res.json(quiz);
  } catch (err: any) {
    if (err.message === 'Quiz not found') return res.status(404).json({ error: 'Quiz not found' });
    logger.error('[quiz] updateQuiz:', err);
    return res.status(500).json({ error: err.message || 'Failed to update quiz' });
  }
}

// ---- Teacher: append questions (append-only, concurrent-safe) ----

export async function appendQuestions(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const role   = req.user!.role;
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required' });
    }

    const quizRows = await query<any>(
      'SELECT subject_id FROM quizzes WHERE id = $1 AND is_active = true',
      [quizId]
    );
    if (!quizRows[0]) return res.status(404).json({ error: 'Quiz not found' });

    const canEdit = await hasQuizWritePermission(userId, role, quizId!, quizRows[0].subject_id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have write permission for this quiz' });
    }

    await quizService.appendQuestionsToQuiz(quizId!, userId, questions);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[quiz] appendQuestions:', err);
    return res.status(500).json({ error: 'Failed to append questions' });
  }
}

// ---- Per-quiz write permission endpoints (admin only) ----

export async function getQuizWritePermissions(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { quizId } = req.params;
    const perms = await quizService.getQuizWritePermissions(quizId!);
    return res.json(perms);
  } catch (err) {
    logger.error('[quiz] getQuizWritePermissions:', err);
    return res.status(500).json({ error: 'Failed to fetch permissions' });
  }
}

export async function grantQuizWritePermission(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { quizId } = req.params;
    const { teacherId } = req.body;
    if (!teacherId) return res.status(400).json({ error: 'teacherId is required' });
    await quizService.grantQuizWritePermission(quizId!, teacherId, req.user!.id);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[quiz] grantQuizWritePermission:', err);
    return res.status(500).json({ error: 'Failed to grant permission' });
  }
}

export async function revokeQuizWritePermission(req: Request, res: Response) {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { quizId, teacherId } = req.params;
    await quizService.revokeQuizWritePermission(quizId!, teacherId!);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[quiz] revokeQuizWritePermission:', err);
    return res.status(500).json({ error: 'Failed to revoke permission' });
  }
}

export async function deleteQuiz(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const role = req.user!.role;
    
    // Only admin can delete quizzes
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete quizzes' });
    }

    await quizService.deleteQuiz(quizId!);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[quiz] deleteQuiz:', err);
    return res.status(500).json({ error: 'Failed to delete quiz' });
  }
}

export async function getQuizzesByCourse(req: Request, res: Response) {
  try {
    const data = await quizService.getQuizzesByCourse(
      req.params.courseId!, req.user!.id, req.user!.role
    );
    return res.json(data);
  } catch (err) {
    logger.error('[quiz:course]', err);
    return res.status(500).json({ error: 'Failed to fetch course quizzes' });
  }
}

export async function getStudentQuizStatuses(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const studentId = req.user!.id;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    const statuses = await quizService.getStudentQuizStatuses(subjectId, studentId);
    return res.json(statuses);
  } catch (err) {
    logger.error('[quiz] getStudentQuizStatuses:', err);
    return res.status(500).json({ error: 'Failed to fetch quiz statuses' });
  }
}

export async function partialSubmitPractice(req: Request, res: Response) {
  try {
    const { attemptId } = req.params;
    const studentId = req.user!.id;
    const { answers, lastQuestionIndex } = req.body;
    if (!attemptId) return res.status(400).json({ error: 'attemptId is required' });
    const result = await quizService.partialSubmitPractice({
      attemptId, studentId, answers: answers ?? [], lastQuestionIndex: lastQuestionIndex ?? 0,
    });
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ error: 'Attempt not found' });
    if (err.message === 'NOT_PRACTICE') return res.status(400).json({ error: 'Only practice quizzes support partial save' });
    if (err.message === 'ATTEMPT_NOT_RESUMABLE') return res.status(409).json({ error: 'Attempt cannot be saved' });
    logger.error('[quiz] partialSubmitPractice:', err);
    return res.status(500).json({ error: 'Failed to save progress' });
  }
}

export async function resumePractice(req: Request, res: Response) {
  try {
    const { attemptId } = req.params;
    const studentId = req.user!.id;
    if (!attemptId) return res.status(400).json({ error: 'attemptId is required' });
    const result = await quizService.resumePractice(attemptId, studentId);
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'ATTEMPT_NOT_FOUND') return res.status(404).json({ error: 'Attempt not found' });
    if (err.message === 'NOT_PRACTICE') return res.status(400).json({ error: 'Only practice attempts can be resumed' });
    if (err.message === 'ATTEMPT_NOT_PARTIAL') return res.status(409).json({ error: 'Attempt is not in partial state' });
    logger.error('[quiz] resumePractice:', err);
    return res.status(500).json({ error: 'Failed to resume attempt' });
  }
}
