import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import logger from '../config/logger';

// ---------------------------------------------------------------------------
// Supabase clients
// ---------------------------------------------------------------------------

let _serviceClient: SupabaseClient | null = null;

/**
 * Service-role client — used for ALL server-side storage operations.
 * Falls back to anon key if service role key is not configured (dev compat).
 */
export function getStorageClient(): SupabaseClient {
  if (!_serviceClient) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    if (!key) {
      throw new Error('No Supabase key configured (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY)');
    }
    _serviceClient = createClient(env.SUPABASE_URL_PUBLIC, key);
  }
  return _serviceClient;
}

// ---------------------------------------------------------------------------
// Storage reference helpers
// ---------------------------------------------------------------------------

/**
 * Stored references can be either:
 *   - NEW format: "bucket-name/object-path"  (e.g. "portal-assets/1234-abc.pdf")
 *   - OLD format: full public URL            (e.g. "https://xxx.supabase.co/storage/v1/object/public/portal-assets/1234-abc.pdf")
 *
 * resolveStorageRef normalises both into { bucket, path }.
 */
export function resolveStorageRef(stored: string): { bucket: string; path: string } | null {
  if (!stored) return null;

  // Old format: full Supabase public URL
  const publicMatch = stored.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch) return { bucket: publicMatch[1]!, path: publicMatch[2]! };

  // Signed URL format: /storage/v1/object/sign/bucket/path?token=...
  const signedMatch = stored.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(?:\?|$)/);
  if (signedMatch) return { bucket: signedMatch[1]!, path: signedMatch[2]! };

  // New format: "bucket/path" — first segment is bucket, rest is path
  const slashIdx = stored.indexOf('/');
  if (slashIdx > 0 && !stored.startsWith('http')) {
    return { bucket: stored.substring(0, slashIdx), path: stored.substring(slashIdx + 1) };
  }

  return null;
}

/** @deprecated Use resolveStorageRef instead */
export const parseStorageUrl = resolveStorageRef;

/**
 * Build the compact storage reference: "bucket/path"
 */
export function buildStorageRef(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

// ---------------------------------------------------------------------------
// Signed URL generation
// ---------------------------------------------------------------------------

const DEFAULT_SIGNED_URL_EXPIRY = 900; // 15 minutes

/**
 * Generate a signed URL for a stored reference.
 * Returns null if the reference is invalid or signing fails.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY
): Promise<string | null> {
  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    logger.error(`[storage] Failed to sign ${bucket}/${path}:`, error);
    return null;
  }
  return data.signedUrl;
}

/**
 * Resolve a stored reference (old URL or new "bucket/path") to a signed URL.
 * Returns null for empty/invalid references.
 */
export async function resolveSignedUrl(
  stored: string | null | undefined,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY
): Promise<string | null> {
  if (!stored) return null;
  const ref = resolveStorageRef(stored);
  if (!ref) return null;
  return createSignedUrl(ref.bucket, ref.path, expiresIn);
}

/**
 * Batch-resolve multiple fields on an object to signed URLs.
 * Returns a new object with the specified fields replaced with signed URLs.
 */
export async function signFileFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj };
  await Promise.all(
    fields.map(async (field) => {
      const val = obj[field];
      if (typeof val === 'string' && val) {
        (result as any)[field] = await resolveSignedUrl(val) ?? val;
      }
    })
  );
  return result;
}

// ---------------------------------------------------------------------------
// File operations (using service-role client)
// ---------------------------------------------------------------------------

/**
 * Move a file from one bucket to another (download + upload + delete).
 * Returns the new storage reference ("bucket/path"), or null on failure.
 */
export async function moveFileBetweenBuckets(
  storedRef: string,
  targetBucket: string
): Promise<string | null> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return null;
  if (parsed.bucket === targetBucket) return buildStorageRef(targetBucket, parsed.path);

  const supabase = getStorageClient();

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

  return buildStorageRef(targetBucket, parsed.path);
}

/**
 * Delete a file from Supabase storage by its stored reference.
 */
export async function deleteFileByUrl(storedRef: string): Promise<boolean> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return false;

  const supabase = getStorageClient();
  const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.path]);
  if (error) {
    logger.error(`[storage] Failed to delete ${parsed.path} from ${parsed.bucket}:`, error);
    return false;
  }
  return true;
}

/**
 * Delete multiple files from Supabase storage by their stored references.
 */
export async function deleteFilesByUrls(refs: string[]): Promise<void> {
  // Group by bucket for efficiency
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref) continue;
    const parsed = resolveStorageRef(ref);
    if (!parsed) continue;
    const list = byBucket.get(parsed.bucket) || [];
    list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
  }

  const supabase = getStorageClient();
  for (const [bucket, paths] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      logger.error(`[storage] Batch delete from ${bucket} failed:`, error);
    }
  }
}
