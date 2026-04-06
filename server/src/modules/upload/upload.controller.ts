import { Request, Response } from 'express';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { getStorageClient, buildStorageRef, createSignedUrl, sanitizeStorageFileName } from '../../utils/storage';

export async function uploadAssignmentFile(req: Request, res: Response) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
      'application/zip', 'application/x-zip-compressed',
      'text/plain',
    ];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Unsupported file type' });

    // Determine bucket: admin uploads go to portal-assets (published content),
    // teacher/student uploads go to temp-uploads (moved to portal-assets on publish)
    const role = req.user!.role;
    const bucket = role === 'admin' ? env.SUPABASE_PORTAL_BUCKET : env.SUPABASE_TEMP_BUCKET;
    const supabase = getStorageClient();
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const explicitTitle = typeof req.body?.title === 'string' ? req.body.title : '';
    const originalBase = req.file.originalname.replace(/\.[^.]+$/, '');
    const sourceTitle = explicitTitle.trim() || originalBase;
    const safeBaseName = sanitizeStorageFileName(sourceTitle);
    const nonce = Math.random().toString(36).slice(2, 10);
    const filename = `${role}/${Date.now()}-${nonce}/${safeBaseName}.${ext}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) {
      const msg = (error as any).message || String(error);
      logger.error('[upload:assignment-file] Supabase error:', msg);
      if (msg.includes('Bucket not found') || msg.includes('not found')) {
        return res.status(500).json({
          error: `Storage bucket "${bucket}" not found. Create a private bucket named "${bucket}" in your Supabase dashboard -> Storage.`,
        });
      }
      if (msg.includes('mime') || msg.includes('MIME') || msg.includes('mime type') || msg.includes('invalid')) {
        return res.status(500).json({
          error: `The storage bucket "${bucket}" rejected this file type. Make sure the bucket has no MIME type restrictions.`,
        });
      }
      return res.status(500).json({ error: `Upload failed: ${msg}` });
    }

    // Return a signed URL as `url` for immediate client-side display and form round-tripping.
    // The backend's resolveStorageRef parses both signed URLs and "bucket/path" refs on read,
    // then re-signs them fresh. `ref` is also returned for clients that want to store the
    // canonical reference instead of the short-lived signed URL.
    const ref = buildStorageRef(bucket, filename);
    const signedUrl = await createSignedUrl(bucket, filename);
    return res.json({ url: signedUrl || ref, ref, signed_url: signedUrl, name: req.file.originalname, bucket });
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

    const supabase = getStorageClient();
    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const explicitTitle = typeof req.body?.title === 'string' ? req.body.title : '';
    const originalBase = req.file.originalname.replace(/\.[^.]+$/, '');
    const sourceTitle = explicitTitle.trim() || originalBase;
    const safeBaseName = sanitizeStorageFileName(sourceTitle);
    const nonce = Math.random().toString(36).slice(2, 10);
    const filename = `quiz-images/${Date.now()}-${nonce}/${safeBaseName}.${ext}`;
    const bucket = 'quiz-images';

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (error) throw error;

    // Return signed URL as `url` for immediate preview; also include `ref` for clients that
    // prefer to store the canonical reference. See uploadAssignmentFile for rationale.
    const ref = buildStorageRef(bucket, filename);
    const signedUrl = await createSignedUrl(bucket, filename);
    return res.json({ url: signedUrl || ref, ref, signed_url: signedUrl });
  } catch (err) {
    logger.error('[upload:quiz-image]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
