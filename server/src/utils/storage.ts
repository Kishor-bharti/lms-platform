import {
  S3Client,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import logger from '../config/logger';

// ---------------------------------------------------------------------------
// S3 Client
// ---------------------------------------------------------------------------

let _s3Client: S3Client | null = null;

/**
 * Lazy singleton S3Client.
 * Credentials are read from env vars if set; otherwise the SDK falls back to
 * the EC2 instance metadata service (IAM role) automatically — no config needed.
 */
export function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.AWS_REGION,
      ...(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: env.AWS_ACCESS_KEY_ID,
              secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
  return _s3Client;
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
 * N round-trips to S3. When 50 students open the same materials page at the same
 * time that is 50 × N redundant API calls for the exact same URLs. The cache
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
 *   - OLD format: full Supabase public URL   (backwards compat for migrated data)
 *
 * resolveStorageRef normalises both into { bucket, path }.
 */
export function resolveStorageRef(stored: string): { bucket: string; path: string } | null {
  if (!stored) return null;

  // Backwards compat: old Supabase public URL format
  const publicMatch = stored.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch) return { bucket: publicMatch[1]!, path: publicMatch[2]! };

  // Backwards compat: Supabase signed URL format
  const signedMatch = stored.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(?:\?|$)/);
  if (signedMatch) return { bucket: signedMatch[1]!, path: signedMatch[2]! };

  // Current format: "bucket/path" — first segment is bucket, rest is path
  const slashIdx = stored.indexOf('/');
  if (slashIdx > 0 && !stored.startsWith('http')) {
    return { bucket: stored.substring(0, slashIdx), path: stored.substring(slashIdx + 1) };
  }

  return null;
}

/** @deprecated Use resolveStorageRef instead */
export const parseStorageUrl = resolveStorageRef;

/** Build the compact storage reference: "bucket/path" */
export function buildStorageRef(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

// ---------------------------------------------------------------------------
// Signed URL generation (with cache)
// ---------------------------------------------------------------------------

const DEFAULT_SIGNED_URL_EXPIRY = 900; // 15 minutes

/**
 * Generate a presigned GET URL for an S3 object.
 * Checks the in-memory cache first; calls S3 only on a cache miss.
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

  try {
    const s3 = getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: path });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn });

    // Cache for (expiresIn - 60) seconds so the URL is always served with ≥ 60 s left
    const ttlMs = Math.max(0, expiresIn - 60) * 1000;
    _signedUrlCache.set(key, { url: signedUrl, expiresAt: Date.now() + ttlMs });

    return signedUrl;
  } catch (err) {
    logger.error(`[storage] Failed to sign ${bucket}/${path}:`, err);
    return null;
  }
}

/**
 * Resolve a stored reference (old Supabase URL or new "bucket/path") to a presigned URL.
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
 * Batch-resolve multiple fields on an object to presigned URLs.
 * Returns a new object with the specified fields replaced with presigned URLs.
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
        (result as any)[field] = (await resolveSignedUrl(val)) ?? val;
      }
    })
  );
  return result;
}

// ---------------------------------------------------------------------------
// Upload helper
// ---------------------------------------------------------------------------

/**
 * Upload a file buffer to S3.
 */
export async function uploadToS3(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * Move a file from one bucket to another via S3 CopyObject + DeleteObject.
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

  const s3 = getS3Client();

  try {
    await s3.send(
      new CopyObjectCommand({
        CopySource: `${parsed.bucket}/${parsed.path}`,
        Bucket: targetBucket,
        Key: parsed.path,
      })
    );

    _evictFile(parsed.bucket, parsed.path);

    await s3.send(
      new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.path })
    );

    return buildStorageRef(targetBucket, parsed.path);
  } catch (err) {
    logger.error(`[storage] moveFileBetweenBuckets failed:`, err);
    return null;
  }
}

/**
 * Delete a file from S3 by its stored reference.
 * Evicts the cache entry so subsequent calls don't return a dead URL.
 */
export async function deleteFileByUrl(storedRef: string): Promise<boolean> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return false;

  _evictFile(parsed.bucket, parsed.path);

  try {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.path }));
    return true;
  } catch (err) {
    logger.error(`[storage] Failed to delete ${parsed.path} from ${parsed.bucket}:`, err);
    return false;
  }
}

/**
 * Delete multiple files from S3 by their stored references.
 * Groups by bucket for batch DeleteObjects requests.
 * Evicts all affected cache entries before deletion.
 */
export async function deleteFilesByUrls(refs: string[]): Promise<void> {
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

  const s3 = getS3Client();
  for (const [bucket, paths] of byBucket) {
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: paths.map((Key) => ({ Key })) },
        })
      );
    } catch (err) {
      logger.error(`[storage] Batch delete from ${bucket} failed:`, err);
    }
  }
}
