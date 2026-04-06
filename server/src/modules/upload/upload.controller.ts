import { Request, Response } from 'express';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { getStorageProvider } from '../../storage';

export async function uploadAssignmentFile(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain',
    ];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Unsupported file type' });

    const bucket = env.SUPABASE_ASSIGNMENT_BUCKET;
    const ext = req.file.originalname.split('.').pop() || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    let url: string;
    try {
      url = await getStorageProvider().upload(bucket, filename, req.file.buffer, req.file.mimetype);
    } catch (storageErr: any) {
      const msg = storageErr?.message || String(storageErr);
      logger.error('[upload:assignment-file] storage error:', msg);
      if (msg.includes('Bucket not found') || msg.includes('not found')) {
        return res.status(500).json({
          error: `Storage bucket "${bucket}" not found. Create a public bucket named "${bucket}" in your storage dashboard.`,
        });
      }
      if (msg.includes('mime') || msg.includes('MIME') || msg.includes('invalid')) {
        return res.status(500).json({
          error: `The storage bucket "${bucket}" rejected this file type.`,
        });
      }
      return res.status(500).json({ error: `Upload failed: ${msg}` });
    }

    return res.json({ url, name: req.file.originalname });
  } catch (err: any) {
    logger.error('[upload:assignment-file]', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

export async function uploadQuizImage(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Only jpg/png/gif/webp allowed' });

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `quiz-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const url = await getStorageProvider().upload('quiz-images', filename, req.file.buffer, req.file.mimetype);
    return res.json({ url });
  } catch (err) {
    logger.error('[upload:quiz-image]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
