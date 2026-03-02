import { Request, Response } from 'express';
import * as assignmentService from './assignment.service';

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
    console.error('[assignment] getBySubject:', err);
    return res.status(500).json({ error: 'Failed to fetch assignments' });
  }
}

export async function createAssignment(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can create assignments' });
    }
    const { subjectId, title, description, due_date, max_marks, attachment_url, topicId } = req.body;
    if (!subjectId || !title) {
      return res.status(400).json({ error: 'subjectId and title are required' });
    }
    const assignment = await assignmentService.createAssignment({
      subjectId, createdBy: userId, title, description, due_date, max_marks, attachment_url, topicId,
    });
    return res.status(201).json(assignment);
  } catch (err: any) {
    console.error('[assignment] create:', err);
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
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers can publish assignments' });
    }
    await assignmentService.setAssignmentPublished(assignmentId, Boolean(is_published));
    return res.json({ success: true });
  } catch (err) {
    console.error('[assignment] publish:', err);
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
    const submissions = await assignmentService.getSubmissions(assignmentId);
    return res.json(submissions);
  } catch (err) {
    console.error('[assignment] getSubmissions:', err);
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
    console.error('[assignment] submit:', err);
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
    const { marks_awarded, feedback } = req.body;
    if (marks_awarded === undefined || marks_awarded === null) {
      return res.status(400).json({ error: 'marks_awarded is required' });
    }
    const result = await assignmentService.gradeSubmission({
      submissionId, graderId, marks_awarded: Number(marks_awarded), feedback,
    });
    return res.json(result);
  } catch (err: any) {
    if (err.message === 'Submission not found') return res.status(404).json({ error: 'Submission not found' });
    console.error('[assignment] grade:', err);
    return res.status(500).json({ error: 'Failed to grade submission' });
  }
}

export async function deleteAssignment(req: Request, res: Response) {
  try {
    const { assignmentId } = req.params;
    const requesterId = req.user!.id;
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Only teachers and admins can delete assignments' });
    }
    await assignmentService.deleteAssignment(assignmentId, requesterId);
    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only delete your own assignments' });
    console.error('[assignment] delete:', err);
    return res.status(500).json({ error: 'Failed to delete assignment' });
  }
}
