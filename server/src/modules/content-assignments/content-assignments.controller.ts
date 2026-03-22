import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as caService from './content-assignments.service';

export async function assignContent(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can assign content' });
    }
    const { subjectId, contentType, contentId, studentIds } = req.body;
    if (
      !subjectId || !contentType || !contentId ||
      !Array.isArray(studentIds) || studentIds.length === 0
    ) {
      return res.status(400).json({
        error: 'subjectId, contentType, contentId, and studentIds[] are required',
      });
    }
    const valid = ['quiz', 'assignment', 'material'];
    if (!valid.includes(contentType)) {
      return res.status(400).json({ error: 'contentType must be quiz, assignment, or material' });
    }
    await caService.assignContent({
      subjectId,
      contentType,
      contentId,
      studentIds,
      assignedBy: req.user!.id,
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    logger.error('[content-assignments] assign:', err);
    return res.status(500).json({ error: 'Failed to assign content' });
  }
}

export async function getAssignmentsForContent(req: Request, res: Response) {
  try {
    const { contentType, contentId } = req.params;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const assignments = await caService.getAssignmentsForContent(contentType!, contentId!);
    return res.json(assignments);
  } catch (err) {
    logger.error('[content-assignments] getForContent:', err);
    return res.status(500).json({ error: 'Failed to fetch assignments' });
  }
}

export async function getAssignmentsForSubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const assignments = await caService.getAssignmentsForSubject(subjectId!);
    return res.json(assignments);
  } catch (err) {
    logger.error('[content-assignments] getForSubject:', err);
    return res.status(500).json({ error: 'Failed to fetch assignments' });
  }
}

export async function revokeAssignment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await caService.revokeAssignment(id!);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[content-assignments] revoke:', err);
    return res.status(500).json({ error: 'Failed to revoke assignment' });
  }
}
