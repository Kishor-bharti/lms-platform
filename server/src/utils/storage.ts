import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import logger from '../config/logger';

function getSupabase() {
  return createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY);
}

/**
 * Extract the file path from a full Supabase public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/temp-uploads/1234-abc.pdf"
 *   -> { bucket: "temp-uploads", path: "1234-abc.pdf" }
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1]!, path: match[2]! };
}

/**
 * Move a file from one bucket to another (download + upload + delete).
 * Returns the new public URL, or null if the move failed.
 */
export async function moveFileBetweenBuckets(
  fileUrl: string,
  targetBucket: string
): Promise<string | null> {
  const parsed = parseStorageUrl(fileUrl);
  if (!parsed) return null;
  if (parsed.bucket === targetBucket) return fileUrl; // already in target

  const supabase = getSupabase();

  // Download from source
  const { data: fileData, error: dlErr } = await supabase.storage
    .from(parsed.bucket)
    .download(parsed.path);

  if (dlErr || !fileData) {
    logger.error(`[storage] Failed to download ${parsed.path} from ${parsed.bucket}:`, dlErr);
    return null;
  }

  // Upload to target with same path
  const buffer = Buffer.from(await fileData.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(targetBucket)
    .upload(parsed.path, buffer, { contentType: fileData.type, upsert: true });

  if (upErr) {
    logger.error(`[storage] Failed to upload ${parsed.path} to ${targetBucket}:`, upErr);
    return null;
  }

  // Delete from source
  const { error: rmErr } = await supabase.storage
    .from(parsed.bucket)
    .remove([parsed.path]);

  if (rmErr) {
    logger.warn(`[storage] Failed to delete ${parsed.path} from ${parsed.bucket} (file was copied):`, rmErr);
  }

  const { data } = supabase.storage.from(targetBucket).getPublicUrl(parsed.path);
  return data.publicUrl;
}

/**
 * Delete a file from Supabase storage by its public URL.
 */
export async function deleteFileByUrl(fileUrl: string): Promise<boolean> {
  const parsed = parseStorageUrl(fileUrl);
  if (!parsed) return false;

  const supabase = getSupabase();
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    logger.error(`[storage] Failed to delete ${parsed.path} from ${parsed.bucket}:`, error);
    return false;
  }
  return true;
}

/**
 * Delete multiple files from Supabase storage by their public URLs.
 */
export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  // Group by bucket for efficiency
  const byBucket = new Map<string, string[]>();
  for (const url of urls) {
    if (!url) continue;
    const parsed = parseStorageUrl(url);
    if (!parsed) continue;
    const list = byBucket.get(parsed.bucket) || [];
    list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
  }

  const supabase = getSupabase();
  for (const [bucket, paths] of byBucket) {
    // Supabase allows batch delete
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      logger.error(`[storage] Batch delete from ${bucket} failed:`, error);
    }
  }
}
