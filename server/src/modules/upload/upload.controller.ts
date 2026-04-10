import { Request, Response } from 'express';
import logger from '../../config/logger';
import { env } from '../../config/env';
import { uploadToS3, buildStorageRef, createSignedUrl } from '../../utils/storage';

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
    const bucket = role === 'admin' ? env.S3_PORTAL_BUCKET : env.S3_TEMP_BUCKET;
    const ext = req.file.originalname.split('.').pop() || 'bin';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      await uploadToS3(bucket, filename, req.file.buffer, req.file.mimetype);
    } catch (err: any) {
      const msg = err.message || String(err);
      logger.error('[upload:assignment-file] S3 error:', msg);
      return res.status(500).json({ error: `Upload failed: ${msg}` });
    }

    // Return a signed URL as `url` for immediate client-side display and form round-tripping.
    // The backend's resolveStorageRef parses "bucket/path" refs on read and re-signs them fresh.
    // `ref` is also returned for clients that want to store the canonical reference.
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

    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `quiz-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const bucket = env.S3_QUIZ_BUCKET;

    await uploadToS3(bucket, filename, req.file.buffer, req.file.mimetype);

    // Return signed URL as `url` for immediate preview; also include `ref` for clients that
    // prefer to store the canonical reference.
    const ref = buildStorageRef(bucket, filename);
    const signedUrl = await createSignedUrl(bucket, filename);
    return res.json({ url: signedUrl || ref, ref, signed_url: signedUrl });
  } catch (err) {
    logger.error('[upload:quiz-image]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
