import { Request, Response } from 'express';
import { query } from '../../config/db';
import * as quizService from './quiz.service';

export async function getQuizzesBySubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const role = req.user?.role ?? 'student';
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    const quizzes = await quizService.getQuizzesBySubject(subjectId, role);
    return res.json(quizzes);
  } catch (err) {
    console.error('[quiz] getQuizzesBySubject:', err);
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
    console.error('[quiz] getQuizDetail:', err);
    return res.status(500).json({ error: 'Failed to fetch quiz' });
  }
}

export async function createQuiz(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can create quizzes' });
    }
    const { subjectId, courseId, title, quiz_type, description, duration_minutes, max_attempts, questions } = req.body;
    const quiz = await quizService.createQuiz({
      subjectId, courseId, createdBy: userId, title, quiz_type, description,
      duration_minutes, max_attempts, questions: questions ?? [],
    });
    return res.status(201).json(quiz);
  } catch (err: any) {
    console.error('[quiz] createQuiz:', err);
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
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can publish quizzes' });
    }

    // Ownership check (skip for admin)
    if (role === 'teacher') {
      const owned = await query<any>(
        `SELECT id FROM quizzes WHERE id = $1 AND created_by = $2`,
        [quizId, userId]
      );
      if (!owned[0]) {
        return res.status(403).json({ error: 'You do not own this quiz' });
      }
    }

    await quizService.setQuizPublished(quizId, Boolean(is_published));
    return res.json({ success: true });
  } catch (err) {
    console.error('[quiz] publishQuiz:', err);
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
    if (err.message === 'NOT_ENROLLED') {
      return res.status(403).json({ error: 'Not enrolled in this subject' });
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
    console.error('[quiz] startAttempt:', err);
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
    console.error('[quiz] submitAttempt:', err);
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
    console.error('[quiz] getAttemptResult:', err);
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
    console.error('[quiz] getMyAttempts:', err);
    return res.status(500).json({ error: 'Failed to get attempts' });
  }
}

export async function updateQuiz(req: Request, res: Response) {
  try {
    const { quizId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can edit quizzes' });
    }

    // Ownership check (skip for admin)
    if (role === 'teacher') {
      const owned = await query<any>(
        `SELECT id FROM quizzes WHERE id = $1 AND created_by = $2`,
        [quizId, userId]
      );
      if (!owned[0]) {
        return res.status(403).json({ error: 'You do not own this quiz' });
      }
    }

    const { title, quiz_type, description, duration_minutes, max_attempts, questions } = req.body;
    const quiz = await quizService.updateQuiz({
      quizId: quizId!, updatedBy: userId, title, quiz_type, description,
      duration_minutes, max_attempts, questions: questions ?? [],
    });
    return res.json(quiz);
  } catch (err: any) {
    if (err.message === 'Quiz not found') return res.status(404).json({ error: 'Quiz not found' });
    console.error('[quiz] updateQuiz:', err);
    return res.status(500).json({ error: err.message || 'Failed to update quiz' });
  }
}

export async function getQuizzesByCourse(req: Request, res: Response) {
  try {
    const data = await quizService.getQuizzesByCourse(
      req.params.courseId!, req.user!.id, req.user!.role
    );
    return res.json(data);
  } catch (err) {
    console.error('[quiz:course]', err);
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
    console.error('[quiz] getStudentQuizStatuses:', err);
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
    console.error('[quiz] partialSubmitPractice:', err);
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
    console.error('[quiz] resumePractice:', err);
    return res.status(500).json({ error: 'Failed to resume attempt' });
  }
}
