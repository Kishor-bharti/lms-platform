import {
  S3Client,
  PutObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import logger from '../config/logger';
import { IStorageProvider } from './IStorageProvider';
import { Readable } from 'stream';

/**
 * S3StorageProvider — works with any S3-compatible object storage:
 *   - AWS S3 (set S3_ENDPOINT to the regional endpoint or omit for default)
 *   - DigitalOcean Spaces (S3_ENDPOINT = https://<region>.digitaloceanspaces.com)
 *   - Cloudflare R2 (S3_ENDPOINT = https://<accountId>.r2.cloudflarestorage.com)
 *
 * Public URLs follow the pattern: <S3_PUBLIC_BASE_URL>/<path>
 * Set S3_PUBLIC_BASE_URL to your CDN/bucket public origin.
 */
export class S3StorageProvider implements IStorageProvider {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    });
  }

  async upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: data,
      ContentType: contentType,
    });

    await this.client.send(command);
    return this.getPublicUrl(bucket, path);
  }

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: path });
      return await awsGetSignedUrl(this.client, command, { expiresIn });
    } catch (err) {
      logger.error(`[storage:s3] getSignedUrl failed (${bucket}/${path}):`, err);
      return null;
    }
  }

  getPublicUrl(bucket: string, path: string): string {
    const base = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '');
    if (base) return `${base}/${path}`;

    // Fallback: construct URL from endpoint or AWS default
    const endpoint = env.S3_ENDPOINT?.replace(/\/$/, '');
    if (endpoint) return `${endpoint}/${bucket}/${path}`;

    // AWS S3 virtual-hosted-style
    return `https://${bucket}.s3.${env.S3_REGION || 'us-east-1'}.amazonaws.com/${path}`;
  }

  async delete(bucket: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: paths.map((Key) => ({ Key })),
        Quiet: true,
      },
    });

    await this.client.send(command);
  }

  async download(bucket: string, path: string): Promise<Buffer | null> {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: path });
      const response = await this.client.send(command);

      if (!response.Body) return null;

      // AWS SDK v3 returns a Readable stream in Node.js environments.
      // Add a runtime guard before casting to safely iterate the stream.
      if (!(response.Body instanceof Readable)) {
        logger.error(`[storage:s3] download: unexpected Body type (${bucket}/${path})`);
        return null;
      }

      const stream: Readable = response.Body;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else if (chunk instanceof Uint8Array) {
          chunks.push(Buffer.from(chunk));
        } else {
          chunks.push(Buffer.from(String(chunk)));
        }
      }
      return Buffer.concat(chunks);
    } catch (err) {
      logger.error(`[storage:s3] download failed (${bucket}/${path}):`, err);
      return null;
    }
  }
}
