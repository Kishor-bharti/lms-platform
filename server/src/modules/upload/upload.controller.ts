import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

export async function uploadQuizImage(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const allowed = ['image/jpeg','image/png','image/gif','image/webp'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Only jpg/png/gif/webp allowed' });

    console.log(`[upload:quiz-image] Starting upload, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);

    const supabase = createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY, {
      global: {
        fetch: (url, options) => {
          // Add timeout to Supabase fetch requests
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout
          return fetch(url, { ...options, signal: controller.signal })
            .finally(() => clearTimeout(timeout));
        },
      },
    });
    
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const filename = `quiz-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from('quiz-images')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    
    if (error) {
      console.error(`[upload:quiz-image] Supabase error after ${Date.now() - startTime}ms:`, error);
      throw error;
    }

    const { data } = supabase.storage.from('quiz-images').getPublicUrl(filename);
    console.log(`[upload:quiz-image] Success in ${Date.now() - startTime}ms: ${data.publicUrl}`);
    return res.json({ url: data.publicUrl });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[upload:quiz-image] Failed after ${elapsed}ms:`, err?.message || err);
    
    const originalCause = err?.originalError?.cause;
    const causeCode = originalCause?.code;
    const causeMsg = originalCause?.message || '';
    
    // Provide more specific error messages for ISP blocking issues
    if (causeCode === 'UND_ERR_CONNECT_TIMEOUT' || err?.message?.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Connection timeout - your ISP may be blocking cloud storage. Try using mobile data or a VPN.',
        code: 'ISP_BLOCKED'
      });
    }
    if (causeCode === 'ECONNRESET' || causeMsg.includes('ECONNRESET')) {
      return res.status(502).json({ 
        error: 'Connection blocked by network - your ISP (like Excitel) may be blocking Supabase. Use mobile data or VPN.',
        code: 'ISP_BLOCKED'
      });
    }
    if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
      return res.status(504).json({ error: 'Upload timed out - server could not reach storage service' });
    }
    if (err?.message?.includes('fetch') || err?.message?.includes('network')) {
      return res.status(502).json({ error: 'Storage service unreachable - network issue' });
    }
    return res.status(500).json({ error: err?.message || 'Upload failed' });
  }
}
