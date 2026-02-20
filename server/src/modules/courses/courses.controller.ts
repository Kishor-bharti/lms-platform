// courses.controller.ts
import { Request, Response } from 'express';
import * as coursesService from './courses.service';

// GET /api/courses/my-courses
export async function getMyCourses(req: Request, res: Response) {
  try {
    const userId   = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const courses = await coursesService.getMyCourses(userId, userRole);
    return res.json(courses);
  } catch (err) {
    console.error('[courses] getMyCourses error:', err);
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
}
