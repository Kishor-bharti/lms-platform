// classes.controller.ts — REPLACE existing file
// Added: createSessionHandler

import { Request, Response } from 'express';
import * as classesService from './classes.service';
import { createSession } from './classes.service';

// ─── GET /api/classes/my-classes-v2 ───────────────────────────
export async function getMyClasses(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) return res.status(401).json({ error: 'Unauthorized' });
    const classes = await classesService.getMyClasses(userId, userRole);
    return res.json(classes);
  } catch (err) {
    console.error('[classes] getMyClasses error:', err);
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

// ─── GET /api/classes/my-sessions-v2 ──────────────────────────
export async function getMySessionsV2(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) return res.status(401).json({ error: 'Unauthorized' });
    const sessions = await classesService.getMySessionsV2(userId, userRole);
    return res.json(sessions);
  } catch (err) {
    console.error('[classes] getMySessionsV2 error:', err);
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

    const { subjectId, title, sessionDate, startTime, topicId } = req.body as {
      subjectId?:   string;
      title?:       string;
      sessionDate?: string;
      startTime?:   string;
      topicId?:     string;
    };

    if (!subjectId || !title || !sessionDate || !startTime) {
      return res.status(400).json({
        error: 'subjectId, title, sessionDate, and startTime are all required',
      });
    }

    const session = await createSession({
      subjectId,
      teacherId: userId,
      title,
      sessionDate,
      startTime,
      ...(topicId ? { topicId } : {}),
    });

    return res.status(201).json(session);
  } catch (err: any) {
    console.error('[classes] createSession error:', err);
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

    const session = await classesService.startSessionById(sessionId, req.user!.id);
    return res.json(session);
  } catch (err: any) {
    console.error('[classes] startSession error:', err);
    if (err.message === 'FORBIDDEN')           return res.status(403).json({ error: 'Not your session' });
    if (err.message === 'Session not found')     return res.status(404).json({ error: 'Session not found' });
    if (err.message === 'Session is already LIVE') return res.status(409).json({ error: 'Session is already live' });
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

    const session = await classesService.completeSessionById(sessionId, req.user!.id);
    return res.json(session);
  } catch (err: any) {
    console.error('[classes] completeSession error:', err);
    if (err.message === 'FORBIDDEN')         return res.status(403).json({ error: 'Not your session' });
    if (err.message === 'Session not found') return res.status(404).json({ error: 'Session not found' });
    return res.status(500).json({ error: 'Failed to complete session' });
  }
}

// ─── DELETE /api/classes/sessions/:sessionId ───────────────────────────────
export async function deleteSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const role = req.user?.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can delete sessions' });
    }
    await classesService.deleteSession(sessionId, req.user!.id);
    return res.json({ success: true });
  } catch (err: any) {
    console.error('[classes] deleteSession error:', err);
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only delete your own sessions' });
    return res.status(500).json({ error: 'Failed to delete session' });
  }
}
