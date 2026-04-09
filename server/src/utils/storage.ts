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
// Signed URL in-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  url: string;
  expiresAt: number; // Date.now() ms
}

/**
 * Process-level signed URL cache.
 *
 * Key format: "bucket\0path\0expiresIn" — null byte prevents bucket/path collisions.
 * TTL = (expiresIn - 60) seconds so we never serve a URL with less than 60 s of
 * life left. Entries are evicted proactively on delete and move so we never hand
 * out a signed URL for a file that no longer exists.
 *
 * Why this matters: every signFileFields() call that resolves N file fields makes
 * N round-trips to Supabase. When 50 students open the same materials page at the
 * same time that is 50 × N redundant API calls for the exact same URLs. The cache
 * collapses that to 1 call per unique file within the TTL window.
 */
const _signedUrlCache = new Map<string, CacheEntry>();

function _cacheKey(bucket: string, path: string, expiresIn: number): string {
  return `${bucket}\0${path}\0${expiresIn}`;
}

/** Remove all cached entries for a given file (any expiresIn variant). */
function _evictFile(bucket: string, path: string): void {
  const prefix = `${bucket}\0${path}\0`;
  for (const key of _signedUrlCache.keys()) {
    if (key.startsWith(prefix)) _signedUrlCache.delete(key);
  }
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
// Signed URL generation (with cache)
// ---------------------------------------------------------------------------

const DEFAULT_SIGNED_URL_EXPIRY = 900; // 15 minutes

/**
 * Generate a signed URL for a stored reference.
 * Checks the in-memory cache first; calls Supabase only on a cache miss.
 * Returns null if the reference is invalid or signing fails.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY
): Promise<string | null> {
  const key = _cacheKey(bucket, path, expiresIn);
  const cached = _signedUrlCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const supabase = getStorageClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) {
    logger.error(`[storage] Failed to sign ${bucket}/${path}:`, error);
    return null;
  }

  // Cache for (expiresIn - 60) seconds so the URL is always served with ≥ 60 s left
  const ttlMs = Math.max(0, expiresIn - 60) * 1000;
  _signedUrlCache.set(key, { url: data.signedUrl, expiresAt: Date.now() + ttlMs });

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
 * Evicts the source file's cache entry on success.
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

  // Delete from source — evict cache so the old bucket reference is no longer served
  _evictFile(parsed.bucket, parsed.path);

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
 * Evicts the cache entry so subsequent calls don't return a dead URL.
 */
export async function deleteFileByUrl(storedRef: string): Promise<boolean> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return false;

  _evictFile(parsed.bucket, parsed.path);

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
 * Evicts all affected cache entries before deletion.
 */
export async function deleteFilesByUrls(refs: string[]): Promise<void> {
  // Group by bucket for efficiency
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref) continue;
    const parsed = resolveStorageRef(ref);
    if (!parsed) continue;
    _evictFile(parsed.bucket, parsed.path);
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
