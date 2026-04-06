/**
 * IStorageProvider — the stable interface for all storage operations.
 *
 * All service code should depend on this interface, never on a specific
 * vendor SDK. To switch storage backends (Supabase → S3 → local disk),
 * only the provider implementation and the STORAGE_ENGINE env var change.
 * See docs/CaseStudy_ORM_and_Portability.md for full rationale.
 */
export interface IStorageProvider {
  /**
   * Upload a file to the given bucket/path.
   * Returns the public URL of the uploaded file.
   */
  upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<string>;

  /**
   * Generate a short-lived signed (pre-authenticated) URL for private access.
   * Returns null if URL generation fails.
   * @param expiresIn  Expiry in seconds (default: 3600)
   */
  getSignedUrl(bucket: string, path: string, expiresIn?: number): Promise<string | null>;

  /**
   * Get the permanent public URL for a file (no expiry, bucket must be public).
   */
  getPublicUrl(bucket: string, path: string): string;

  /**
   * Delete one or more files from a bucket.
   */
  delete(bucket: string, paths: string[]): Promise<void>;

  /**
   * Download a file and return its contents as a Buffer.
   * Returns null if the download fails.
   */
  download(bucket: string, path: string): Promise<Buffer | null>;
}
