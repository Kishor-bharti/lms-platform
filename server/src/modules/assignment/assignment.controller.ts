import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as assignmentService from './assignment.service';
import { hasContentWritePermission } from '../../utils/permissions';

export async function getAssignmentsBySubject(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const userId = req.user!.id;
    const role = req.user!.role;
    if (!subjectId) {
      return res.status(400).json({ error: 'subjectId is required' });
    }
    if (role === 'student') {
      const assignments = await assignmentService.getStudentAssignments(subjectId, userId);
      return res.json(assignments);
    }
    const assignments = await assignmentService.getAssignmentsBySubject(subjectId, userId);
    return res.json(assignments);
  } catch (err) {
    logger.error('[assignment] getBySubject:', err);
    return res.status(500).json({ error: 'Failed to fetch assignments' });
  }
}

export async function createAssignment(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { subjectId, title, description, duration_days, max_marks, attachment_url, topicId, assignedTo } = req.body;
    if (!subjectId || !title) {
      return res.status(400).json({ error: 'subjectId and title are required' });
    }
    const canCreate = await hasContentWritePermission(userId, role, subjectId);
    if (!canCreate) {
      return res.status(403).json({ error: 'Insufficient permissions to create assignments in this subject' });
    }
    const assignment = await assignmentService.createAssignment({
      subjectId, createdBy: userId, title, description, duration_days, max_marks, attachment_url, topicId,
      assignedTo: assignedTo || undefined,
    });
    return res.status(201).json(assignment);
  } catch (err: any) {
    logger.error('[assignment] create:', err);
    return res.status(500).json({ error: err.message || 'Failed to create assignment' });
  }
}

export async function publishAssignment(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }
    const { is_published } = req.body;
    const role = req.user!.role;
    if (role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can publish assignments' });
    }
    await assignmentService.setAssignmentPublished(assignmentId, Boolean(is_published));
    return res.json({ success: true });
  } catch (err) {
    logger.error('[assignment] publish:', err);
    return res.status(500).json({ error: 'Failed to update assignment' });
  }
}

export async function getSubmissions(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can view all submissions' });
    }
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }
    // Teachers only see submissions from their assigned students; admins see all
    const teacherId = role === 'teacher' ? req.user!.id : undefined;
    const submissions = await assignmentService.getSubmissions(assignmentId, teacherId);
    return res.json(submissions);
  } catch (err) {
    logger.error('[assignment] getSubmissions:', err);
    return res.status(500).json({ error: 'Failed to get submissions' });
  }
}

export async function submitAssignment(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user!.id;
    const { submission_url, notes } = req.body;
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }
    const result = await assignmentService.submitAssignment({
      assignmentId: assignmentId, studentId, submission_url, notes,
    });
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'Assignment not found') return res.status(404).json({ error: 'Assignment not found' });
    logger.error('[assignment] submit:', err);
    return res.status(500).json({ error: 'Failed to submit assignment' });
  }
}

export async function gradeSubmission(req: Request, res: Response) {
  try {
    const { submissionId } = req.params;
    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }
    const graderId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can grade submissions' });
    }
    const { marks_awarded, feedback, feedback_file_url } = req.body;
    if (marks_awarded === undefined || marks_awarded === null) {
      return res.status(400).json({ error: 'marks_awarded is required' });
    }
    const result = await assignmentService.gradeSubmission({
      submissionId, graderId, marks_awarded: Number(marks_awarded), feedback, feedback_file_url,
    });
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'Submission not found') return res.status(404).json({ error: 'Submission not found' });
    logger.error('[assignment] grade:', err);
    return res.status(500).json({ error: 'Failed to grade submission' });
  }
}

export async function updateAssignment(req: Request, res: Response) {
  try {
    const assignmentId = req.params.assignmentId as string;
    const requesterId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { title, description, duration_days, max_marks, attachment_url, topicId, assignedTo } = req.body;
    const updated = await assignmentService.updateAssignment(assignmentId, requesterId, {
      title, description, duration_days, max_marks, attachment_url, topicId, assignedTo,
    });
    return res.json(updated);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only edit your own assignments' });
    logger.error('[assignment] update:', err);
    return res.status(500).json({ error: err.message || 'Failed to update assignment' });
  }
}

export async function deleteAssignment(req: Request, res: Response) {
  try {
    const assignmentId = req.params.assignmentId as string;
    const requesterId = req.user!.id as string;
    const role = req.user!.role;
    if (role !== 'admin' && role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await assignmentService.deleteAssignment(assignmentId, requesterId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only delete your own assignments' });
    logger.error('[assignment] delete:', err);
    return res.status(500).json({ error: 'Failed to delete assignment' });
  }
}
