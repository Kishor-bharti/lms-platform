import { Request, Response } from 'express';
import logger from '../../config/logger';
import {
  getStudentProgress,
  getTeacherReport,
  getWeeklyActivity,
  getActivityForRange,
  getQuizHistory,
  getTopicAnalysis,
  isStudentOfTeacher,
} from './progress.service';

export async function getMyProgress(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    if (role === 'student') {
      const data = await getStudentProgress(userId);
      return res.json({ role: 'student', data });
    }
    if (role === 'teacher') {
      const data = await getTeacherReport(userId);
      return res.json({ role: 'teacher', data });
    }
    return res.status(403).json({ error: 'Progress not available for this role' });
  } catch (err) {
    logger.error('[progress]', err);
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
}

export async function getMyWeeklyActivity(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    if (role !== 'student') return res.status(403).json({ error: 'Students only' });
    const data = await getWeeklyActivity(userId);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:weekly]', err);
    return res.status(500).json({ error: 'Failed to fetch weekly activity' });
  }
}

export async function getActivityRange(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    if (role !== 'student') return res.status(403).json({ error: 'Students only' });
    const { start, end } = req.query as { start?: string; end?: string };
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required (YYYY-MM-DD)' });
    const data = await getActivityForRange(userId, start, end);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:activity-range]', err);
    return res.status(500).json({ error: 'Failed to fetch activity' });
  }
}

export async function getMyQuizHistory(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role   = req.user!.role;
    if (role !== 'student') return res.status(403).json({ error: 'Students only' });
    const quizType = req.query.type as string | undefined;
    const data = await getQuizHistory(userId, quizType);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:history]', err);
    return res.status(500).json({ error: 'Failed to fetch quiz history' });
  }
}

export async function getMyTopicAnalysis(req: Request, res: Response) {
  try {
    const userId    = req.user!.id;
    const role      = req.user!.role;
    const subjectId = req.params.subjectId;
    if (role !== 'student') return res.status(403).json({ error: 'Students only' });
    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });
    const data = await getTopicAnalysis(userId, subjectId);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:topic-analysis]', err);
    return res.status(500).json({ error: 'Failed to fetch topic analysis' });
  }
}

// ---- Teacher views a specific student's report ----

export async function getStudentReport(req: Request, res: Response) {
  try {
    const teacherId = req.user!.id;
    const role      = req.user!.role;
    const studentId = req.params.studentId;
    if (role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    // Check access
    const allowed = await isStudentOfTeacher(teacherId, studentId);
    if (!allowed) return res.status(403).json({ error: 'Student is not in your subjects' });

    const data = await getStudentProgress(studentId);
    return res.json({ role: 'student', data });
  } catch (err) {
    logger.error('[progress:student-report]', err);
    return res.status(500).json({ error: 'Failed to fetch student report' });
  }
}

export async function getStudentWeeklyActivity(req: Request, res: Response) {
  try {
    const teacherId = req.user!.id;
    const role      = req.user!.role;
    const studentId = req.params.studentId as string;
    if (role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });

    const allowed = await isStudentOfTeacher(teacherId, studentId);
    if (!allowed) return res.status(403).json({ error: 'Student is not in your subjects' });

    const data = await getWeeklyActivity(studentId);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:student-weekly]', err);
    return res.status(500).json({ error: 'Failed to fetch student weekly activity' });
  }
}

export async function getStudentActivityRange(req: Request, res: Response) {
  try {
    const teacherId = req.user!.id;
    const role      = req.user!.role;
    const studentId = req.params.studentId as string;
    if (role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });

    const allowed = await isStudentOfTeacher(teacherId, studentId);
    if (!allowed) return res.status(403).json({ error: 'Student is not in your subjects' });

    const { start, end } = req.query as { start?: string; end?: string };
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required (YYYY-MM-DD)' });
    const data = await getActivityForRange(studentId, start, end);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:student-activity-range]', err);
    return res.status(500).json({ error: 'Failed to fetch student activity' });
  }
}

export async function getStudentQuizHistory(req: Request, res: Response) {
  try {
    const teacherId = req.user!.id;
    const role      = req.user!.role;
    const studentId = req.params.studentId as string;
    if (role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });

    const allowed = await isStudentOfTeacher(teacherId, studentId);
    if (!allowed) return res.status(403).json({ error: 'Student is not in your subjects' });

    const quizType = req.query.type as string | undefined;
    const data = await getQuizHistory(studentId, quizType);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:student-quiz-history]', err);
    return res.status(500).json({ error: 'Failed to fetch student quiz history' });
  }
}

export async function getStudentTopicAnalysis(req: Request, res: Response) {
  try {
    const teacherId = req.user!.id;
    const role      = req.user!.role;
    const studentId = req.params.studentId as string;
    const subjectId = req.params.subjectId as string;
    if (role !== 'teacher') return res.status(403).json({ error: 'Teachers only' });
    if (!studentId || !subjectId) return res.status(400).json({ error: 'studentId and subjectId are required' });

    const allowed = await isStudentOfTeacher(teacherId, studentId);
    if (!allowed) return res.status(403).json({ error: 'Student is not in your subjects' });

    const data = await getTopicAnalysis(studentId, subjectId);
    return res.json(data);
  } catch (err) {
    logger.error('[progress:student-topic-analysis]', err);
    return res.status(500).json({ error: 'Failed to fetch student topic analysis' });
  }
}
