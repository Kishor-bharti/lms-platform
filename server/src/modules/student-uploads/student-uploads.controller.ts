import { Request, Response } from 'express';
import logger from '../../config/logger';
import * as uploadService from './student-uploads.service';

export async function getUploads(req: Request, res: Response) {
  try {
    const { subjectId } = req.params;
    const role = req.user!.role;
    const userId = req.user!.id;

    if (!subjectId) return res.status(400).json({ error: 'subjectId is required' });

    if (role === 'student') {
      const uploads = await uploadService.getMyUploads(subjectId, userId);
      return res.json(uploads);
    }

    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const uploads = await uploadService.getUploads(subjectId, role, userId);
    return res.json(uploads);
  } catch (err) {
    logger.error('[student-uploads] getUploads:', err);
    return res.status(500).json({ error: 'Failed to fetch uploads' });
  }
}

export async function createUpload(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    if (role !== 'student') {
      return res.status(403).json({ error: 'Only students can upload files here' });
    }

    const studentId = req.user!.id;
    const { subjectId, teacherId, topicId, title, description, file_url, file_name } = req.body;

    if (!subjectId || !title || !file_url) {
      return res.status(400).json({ error: 'subjectId, title, and file_url are required' });
    }

    const upload = await uploadService.createUpload({
      subjectId, studentId, teacherId, topicId, title, description, file_url, file_name,
    });
    return res.status(201).json(upload);
  } catch (err: any) {
    logger.error('[student-uploads] create:', err);
    return res.status(500).json({ error: err.message || 'Failed to create upload' });
  }
}

export async function addFeedback(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    if (role !== 'teacher' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const uploadId = req.params.uploadId as string;
    const teacherId = req.user!.id;
    const { feedback_text, feedback_file_url } = req.body;

    if (!feedback_text && !feedback_file_url) {
      return res.status(400).json({ error: 'Provide feedback text or file' });
    }

    const updated = await uploadService.addFeedback(uploadId, teacherId, role, feedback_text, feedback_file_url);
    return res.json(updated);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only give feedback on your students\' uploads' });
    logger.error('[student-uploads] addFeedback:', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }
}

export async function getStudentTeachers(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    if (role !== 'student') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const subjectId = req.params.subjectId as string;
    const studentId = req.user!.id;

    const teachers = await uploadService.getStudentTeachers(subjectId, studentId);
    return res.json(teachers);
  } catch (err) {
    logger.error('[student-uploads] getStudentTeachers:', err);
    return res.status(500).json({ error: 'Failed to fetch teachers' });
  }
}

export async function deleteUpload(req: Request, res: Response) {
  try {
    const uploadId = req.params.uploadId as string;
    const studentId = req.user!.id;
    const role = req.user!.role;

    if (!uploadId) return res.status(400).json({ error: 'uploadId is required' });

    if (role !== 'student' && role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (role === 'admin') {
      await uploadService.deleteUploadAsAdmin(uploadId);
    } else {
      await uploadService.deleteUpload(uploadId, studentId);
    }

    return res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: 'You can only delete your own uploads' });
    logger.error('[student-uploads] delete:', err);
    return res.status(500).json({ error: 'Failed to delete upload' });
  }
}
