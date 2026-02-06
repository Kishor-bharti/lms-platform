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
