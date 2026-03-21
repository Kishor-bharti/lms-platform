// classes.controller.ts — REPLACE existing file
// Added: createSessionHandler

import { Request, Response } from 'express';
import * as classesService from './classes.service';
import { createSession, getSubjectStudents, getSubjectTeachers, getMySessionStats } from './classes.service';
import logger from '../../config/logger';

// ─── GET /api/classes/my-classes-v2 ───────────────────────────
export async function getMyClasses(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) return res.status(401).json({ error: 'Unauthorized' });
    const classes = await classesService.getMyClasses(userId, userRole);
    return res.json(classes);
  } catch (err) {
    logger.error('[classes] getMyClasses error:', err);
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

// ─── GET /api/classes/my-sessions-v2?date=YYYY-MM-DD ──────────
export async function getMySessionsV2(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) return res.status(401).json({ error: 'Unauthorized' });
    const rawDate = req.query.date as string | undefined;
    const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;
    const sessions = await classesService.getMySessionsV2(userId, userRole, date);
    return res.json(sessions);
  } catch (err) {
    logger.error('[classes] getMySessionsV2 error:', err);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

// ─── POST /api/classes/sessions/create ────────────────────────
// Teacher/admin only — create a new scheduled session under a subject
export async function createSessionHandler(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) return res.status(401).json({ error: 'Unauthorized' });

    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can create sessions' });
    }

    const {
      subjectId, title, sessionDate, startTime, endTime, topicId, studentIds,
      isRecurring, recurPattern, recurDays, recurEndDate,
    } = req.body;

    if (!subjectId || !title || !sessionDate || !startTime) {
      return res.status(400).json({
        error: 'subjectId, title, sessionDate, and startTime are all required',
      });
    }

    const result = await createSession({
      subjectId,
      teacherId: userId,
      title,
      sessionDate,
      startTime,
      ...(endTime      ? { endTime }      : {}),
      ...(topicId      ? { topicId }      : {}),
      ...(studentIds   ? { studentIds }   : {}),
      ...(isRecurring  ? { isRecurring, recurPattern, recurDays, recurEndDate } : {}),
    });

    return res.status(201).json(result);
  } catch (err: any) {
    logger.error('[classes] createSession error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create session' });
  }
}

// ─── POST /api/classes/sessions/:sessionId/start ──────────────
export async function startSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userRole      = req.user?.role;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can start sessions' });
    }

    const session = await classesService.startSessionById(sessionId, req.user!.id, userRole);
    return res.json(session);
  } catch (err: any) {
    logger.error('[classes] startSession error:', err);
    if (err.message === 'FORBIDDEN')              return res.status(403).json({ error: 'Not your session' });
    if (err.message === 'Session not found')       return res.status(404).json({ error: 'Session not found' });
    if (err.message === 'Session is already LIVE') return res.status(409).json({ error: 'Session is already live' });
    if (err.message === 'Session was missed')      return res.status(409).json({ error: 'This session window has passed and was not started in time.' });
    if (err.message === 'TOO_EARLY') {
      const mins = err.minsLeft ? ` You can start it in ${err.minsLeft} min.` : '';
      return res.status(403).json({ error: `Too early to start this session.${mins} Sessions can be started 5 minutes before scheduled time.` });
    }
    return res.status(500).json({ error: 'Failed to start session' });
  }
}

// ─── POST /api/classes/sessions/:sessionId/complete ───────────
export async function completeSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userRole      = req.user?.role;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can end sessions' });
    }

    const session = await classesService.completeSessionById(sessionId, req.user!.id, userRole);
    return res.json(session);
  } catch (err: any) {
    logger.error('[classes] completeSession error:', err);
    if (err.message === 'FORBIDDEN')         return res.status(403).json({ error: 'Not your session' });
    if (err.message === 'Session not found') return res.status(404).json({ error: 'Session not found' });
    return res.status(500).json({ error: 'Failed to complete session' });
  }
}

// ─── GET /api/classes/subjects/:subjectId/teachers ─────────────
export async function getSubjectTeachersHandler(req: Request, res: Response) {
  try {
    const subjectId = req.params.subjectId as string;
    const role = req.user?.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const teachers = await classesService.getSubjectTeachers(subjectId);
    return res.json(teachers);
  } catch (err) {
    logger.error('[classes] getSubjectTeachers error:', err);
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
}

// ─── GET /api/classes/subjects/:subjectId/students ─────────────
// Returns enrolled students for a subject (teacher/admin only).
export async function getSubjectStudentsHandler(req: Request, res: Response) {
  try {
    const subjectId = req.params.subjectId as string;
    const role = req.user?.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const students = await getSubjectStudents(subjectId);
    return res.json(students);
  } catch (err) {
    logger.error('[classes] getSubjectStudents error:', err);
    return res.status(500).json({ error: 'Failed to fetch students' });
  }
}

// ─── GET /api/classes/my-session-stats ─────────────────────────
// T7: Teacher session history — per-student breakdown.
export async function getMySessionStatsHandler(req: Request, res: Response) {
  try {
    const teacherId = req.user?.id;
    const role      = req.user?.role;
    if (!teacherId || (role !== 'teacher' && role !== 'admin')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const stats = await getMySessionStats(teacherId);
    return res.json(stats);
  } catch (err) {
    logger.error('[classes] getMySessionStats error:', err);
    return res.status(500).json({ error: 'Failed to fetch session stats' });
  }
}

// ─── DELETE /api/classes/sessions/:sessionId ───────────────────────────────
export async function deleteSessionById(req: Request, res: Response) {
  try {
    const sessionId = req.params.sessionId as string;
    const userId = req.user!.id as string;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can delete sessions' });
    }
    await classesService.deleteSession(sessionId, userId, role);
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[classes] deleteSession error:', err);
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only delete your own sessions' });
    return res.status(500).json({ error: 'Failed to delete session' });
  }
}
