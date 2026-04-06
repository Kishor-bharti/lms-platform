import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import logger from '../config/logger';
import { IStorageProvider } from './IStorageProvider';

export class SupabaseStorageProvider implements IStorageProvider {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(env.SUPABASE_URL_PUBLIC, env.SUPABASE_ANON_KEY);
  }

  async upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<string> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, data, { contentType, upsert: true });

    if (error) {
      logger.error(`[storage:supabase] upload failed (${bucket}/${path}):`, error);
      throw error;
    }

    return this.getPublicUrl(bucket, path);
  }

  async getSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string | null> {
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);

    if (error || !data) {
      logger.error(`[storage:supabase] getSignedUrl failed (${bucket}/${path}):`, error);
      return null;
    }

    return data.signedUrl;
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async delete(bucket: string, paths: string[]): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove(paths);
    if (error) {
      logger.error(`[storage:supabase] delete failed (${bucket}):`, error);
      throw error;
    }
  }

  async download(bucket: string, path: string): Promise<Buffer | null> {
    const { data, error } = await this.client.storage.from(bucket).download(path);
    if (error || !data) {
      logger.error(`[storage:supabase] download failed (${bucket}/${path}):`, error);
      return null;
    }
    return Buffer.from(await data.arrayBuffer());
  }
}
