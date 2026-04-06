import { env } from '../config/env';
import { IStorageProvider } from './IStorageProvider';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';
import logger from '../config/logger';

let _provider: IStorageProvider | undefined;

/**
 * Returns the active storage provider, selected via the STORAGE_ENGINE env var.
 *
 * STORAGE_ENGINE=supabase  (default) → SupabaseStorageProvider
 * STORAGE_ENGINE=s3                  → S3StorageProvider (also works for
 *                                      DigitalOcean Spaces and Cloudflare R2)
 *
 * The provider is created once and reused (singleton).
 */
export function getStorageProvider(): IStorageProvider {
  if (!_provider) {
    const engine = env.STORAGE_ENGINE || 'supabase';
    if (engine === 's3') {
      _provider = new S3StorageProvider();
      logger.info('[storage] Using S3StorageProvider');
    } else {
      _provider = new SupabaseStorageProvider();
      logger.info('[storage] Using SupabaseStorageProvider');
    }
  }
  return _provider;
}

/** Reset the cached provider (useful in tests). */
export function resetStorageProvider(): void {
  _provider = undefined;
}

// ─── URL utility helpers ────────────────────────────────────────────────────
// These helpers operate on Supabase-style public URLs only:
// https://xxx.supabase.co/storage/v1/object/public/<bucket>/<path>
//
// They are not intended for S3/DigitalOcean/Cloudflare URLs.
// If you switch to STORAGE_ENGINE=s3, store bucket + path separately in your
// database records instead of relying on URL parsing.

/**
 * Parse a Supabase public URL into { bucket, path }.
 * Returns null if the URL does not match the expected Supabase URL pattern.
 *
 * NOTE: This only works for Supabase-style URLs. S3 public URLs have a different
 * structure and are not supported by this function.
 *
 * @example
 * parseStorageUrl("https://xxx.supabase.co/storage/v1/object/public/temp-uploads/1234.pdf")
 * // → { bucket: "temp-uploads", path: "1234.pdf" }
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1]!, path: match[2]! };
}

/**
 * Move a file from one bucket to another by downloading and re-uploading it.
 * Returns the new public URL, or null if the operation failed.
 * If the file is already in the target bucket, returns the original URL unchanged.
 */
export async function moveFileBetweenBuckets(
  fileUrl: string,
  targetBucket: string,
): Promise<string | null> {
  const parsed = parseStorageUrl(fileUrl);
  if (!parsed) return null;
  if (parsed.bucket === targetBucket) return fileUrl;

  const provider = getStorageProvider();

  const fileData = await provider.download(parsed.bucket, parsed.path);
  if (!fileData) return null;

  // Derive a content-type from the path extension (best-effort)
  const extMatch = parsed.path.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1]!.toLowerCase() : '';
  const contentType = (ext && MIME_TYPES[ext]) ? MIME_TYPES[ext]! : 'application/octet-stream';

  try {
    const newUrl = await provider.upload(targetBucket, parsed.path, fileData, contentType);
    await provider.delete(parsed.bucket, [parsed.path]);
    return newUrl;
  } catch (err) {
    return null;
  }
}

/**
 * Delete a single file by its public URL.
 * Returns true on success, false if the URL could not be parsed or deletion failed.
 */
export async function deleteFileByUrl(fileUrl: string): Promise<boolean> {
  const parsed = parseStorageUrl(fileUrl);
  if (!parsed) return false;

  try {
    await getStorageProvider().delete(parsed.bucket, [parsed.path]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete multiple files by their public URLs.
 * Files are grouped by bucket for efficient batch deletion.
 */
export async function deleteFilesByUrls(urls: string[]): Promise<void> {
  const byBucket = new Map<string, string[]>();

  for (const url of urls) {
    if (!url) continue;
    const parsed = parseStorageUrl(url);
    if (!parsed) continue;
    const list = byBucket.get(parsed.bucket) ?? [];
    list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
  }

  const provider = getStorageProvider();
  for (const [bucket, paths] of byBucket) {
    await provider.delete(bucket, paths);
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

const MIME_TYPES: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  gif:  'image/gif',
  webp: 'image/webp',
  txt:  'text/plain',
};
