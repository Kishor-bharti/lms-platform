// classes.controller.ts — v2.1 aligned, lowercase role checks

import { Request, Response } from 'express';
import * as classesService from './classes.service';

// ─── GET /api/classes/my-classes-v2 ───────────────────────────
// Returns subjects: teacher → assigned, student → enrolled, admin → all

export async function getMyClasses(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;   // lowercase: 'admin' | 'teacher' | 'student'

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const classes = await classesService.getMyClasses(userId, userRole);
    return res.json(classes);
  } catch (err) {
    console.error('[classes] getMyClasses error:', err);
    return res.status(500).json({ error: 'Failed to fetch classes' });
  }
}

// ─── GET /api/classes/my-sessions-v2 ──────────────────────────
// Returns sessions: teacher → their sessions, student → enrolled, admin → all

export async function getMySessionsV2(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sessions = await classesService.getMySessionsV2(userId, userRole);
    return res.json(sessions);
  } catch (err) {
    console.error('[classes] getMySessionsV2 error:', err);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
}

// ─── POST /api/classes/sessions/:sessionId/start ─────────────
// Teacher only — creates Zoom meeting, sets status = 'live'

export async function startSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userRole      = req.user?.role;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // FIX: lowercase role check
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can start sessions' });
    }

    const session = await classesService.startSessionById(sessionId);
    return res.json(session);
  } catch (err: any) {
    console.error('[classes] startSession error:', err);
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (err.message === 'Session is already LIVE') {
      return res.status(409).json({ error: 'Session is already live' });
    }
    return res.status(500).json({ error: 'Failed to start session' });
  }
}

// ─── POST /api/classes/sessions/:sessionId/complete ──────────
// Teacher only — sets status = 'completed'

export async function completeSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const userRole      = req.user?.role;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    // FIX: lowercase role check
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can end sessions' });
    }

    const session = await classesService.completeSessionById(sessionId);
    return res.json(session);
  } catch (err: any) {
    console.error('[classes] completeSession error:', err);
    if (err.message === 'Session not found') {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.status(500).json({ error: 'Failed to complete session' });
  }
}
