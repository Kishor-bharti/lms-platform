import { Request, Response } from 'express';
import logger from '../../config/logger';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

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
    const supabase = createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY);
    const ext = req.file.originalname.split('.').pop() || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) {
      const msg = (error as any).message || String(error);
      logger.error('[upload:assignment-file] Supabase error:', msg);
      // Give a clear message if the bucket is missing or has MIME restrictions
      if (msg.includes('Bucket not found') || msg.includes('not found')) {
        return res.status(500).json({
          error: `Storage bucket "${bucket}" not found. Create a public bucket named "${bucket}" in your Supabase dashboard → Storage.`,
        });
      }
      if (msg.includes('mime') || msg.includes('MIME') || msg.includes('mime type') || msg.includes('invalid')) {
        return res.status(500).json({
          error: `The storage bucket "${bucket}" rejected this file type. Make sure the bucket has no MIME type restrictions, or set SUPABASE_ASSIGNMENT_BUCKET to a bucket that allows all file types.`,
        });
      }
      return res.status(500).json({ error: `Upload failed: ${msg}` });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return res.json({ url: data.publicUrl, name: req.file.originalname });
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

    const supabase = createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY);
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `quiz-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('quiz-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(filename);
    return res.json({ url: data.publicUrl });
  } catch (err) {
    logger.error('[upload:quiz-image]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
