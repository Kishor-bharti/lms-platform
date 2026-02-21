import { Request, Response } from 'express';
import { getStudentProgress, getTeacherReport } from './progress.service';

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
    console.error('[progress]', err);
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
}
