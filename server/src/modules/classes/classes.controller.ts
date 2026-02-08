import { Request, Response } from 'express';
import * as classesService from './classes.service';

export async function createClass(req: Request, res: Response) {
  try {
    const { title, subject } = req.body as { title?: string; subject?: string };
    const userId = req.user?.id;

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ message: 'Title is required and must be a string' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const newClass = await classesService.createClass(title, subject || '', userId);
    res.status(201).json(newClass);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create class' });
  }
}

export async function createSession(req: Request, res: Response) {
  try {
    const { classId, title, scheduledAt } = req.body as {
      classId?: string;
      title?: string;
      scheduledAt?: string;
    };

    if (!classId || typeof classId !== 'string') {
      return res.status(400).json({ message: 'classId is required and must be a string' });
    }

    if (!title || typeof title !== 'string') {
      return res.status(400).json({ message: 'title is required and must be a string' });
    }

    if (!scheduledAt || typeof scheduledAt !== 'string') {
      return res.status(400).json({ message: 'scheduledAt is required and must be a string' });
    }

    const session = await classesService.createSession(classId, title, new Date(scheduledAt));
    res.status(201).json(session);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create session' });
  }
}

export async function startSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.body as { sessionId?: string };

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required and must be a string' });
    }

    const session = await classesService.startSession(sessionId);
    res.json(session);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to start session' });
  }
}

export async function getTeacherClasses(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const classes = await classesService.getTeacherClasses(userId);
    res.json(classes);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
}

export async function getStudentClasses(req: Request, res: Response) {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const classes = await classesService.getStudentEnrolledClasses(userId);
    res.json(classes);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
}

export async function getSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params as { sessionId?: string };

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required and must be a string' });
    }

    const session = await classesService.getSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    res.json(session);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch session' });
  }
}

// New data-driven API handlers
export async function getMyClasses(req: Request, res: Response) {
  try {
    const userId = req.user?.id?.toString();
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const classes = await classesService.getMyClasses(userId, userRole);
    res.json(classes);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch classes' });
  }
}

export async function getMySessionsV2(req: Request, res: Response) {
  try {
    const userId = req.user?.id?.toString();
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const sessions = await classesService.getMySessionsV2(userId, userRole);
    res.json(sessions);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
}

export async function startSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params as { sessionId?: string };
    const userRole = req.user?.role;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required' });
    }

    if (userRole !== 'TEACHER') {
      return res.status(403).json({ message: 'Only teachers can start sessions' });
    }

    const session = await classesService.startSessionById(sessionId);
    res.json(session);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to start session' });
  }
}
export async function completeSessionById(req: Request, res: Response) {
  try {
    const { sessionId } = req.params as { sessionId?: string };
    const userRole = req.user?.role;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required' });
    }

    if (userRole !== 'TEACHER') {
      return res.status(403).json({ message: 'Only teachers can complete sessions' });
    }

    const session = await classesService.completeSessionById(sessionId);
    res.json(session);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to complete session' });
  }
}
export async function enrollStudentById(req: Request, res: Response) {
  try {
    const { classId } = req.params as { classId?: string };
    const { studentId } = req.body as { studentId?: number };
    const userRole = req.user?.role;

    if (!classId || typeof classId !== 'string') {
      return res.status(400).json({ message: 'classId is required' });
    }

    if (!studentId || typeof studentId !== 'number') {
      return res.status(400).json({ message: 'studentId is required and must be a number' });
    }

    if (userRole !== 'TEACHER') {
      return res.status(403).json({ message: 'Only teachers can enroll students' });
    }

    const enrollment = await classesService.enrollStudentIfNotExists(classId, studentId);
    res.status(200).json(enrollment);
  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Failed to enroll student' });
  }
}