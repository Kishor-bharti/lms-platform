// courses.controller.ts
import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as coursesService from './courses.service';
import { getTopicsByCourse } from '../topics/topics.service';

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
    logger.error('[courses] getMyCourses error:', err);
    return res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

// GET /api/courses/:courseId/topics
export async function getCourseTopics(req: Request, res: Response) {
  try {
    const courseId = req.params.courseId as string;
    const topics = await getTopicsByCourse(courseId);
    return res.json(topics);
  } catch (err) {
    logger.error('[courses] getCourseTopics error:', err);
    return res.status(500).json({ error: 'Failed to fetch course topics' });
  }
}
