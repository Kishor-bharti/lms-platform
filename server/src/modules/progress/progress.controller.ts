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
    // Admin: return graceful empty data — aggregate reporting not yet implemented
    return res.json({
      role: 'admin',
      data: [],
      message: 'Aggregate progress reporting for admins is not yet available',
    });
  } catch (err) {
    console.error('[progress]', err);
    return res.status(500).json({ error: 'Failed to fetch progress' });
  }
}
