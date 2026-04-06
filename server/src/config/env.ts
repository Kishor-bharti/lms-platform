import dotenv from 'dotenv';

dotenv.config({
  path: process.env.NODE_ENV === 'test'
    ? '.env.test'
    : process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development'
});

export const env = {
  NODE_ENV:     process.env.NODE_ENV ?? 'development',
  PORT:         parseInt(process.env.PORT || '4000', 10),

  // Database — single URL, no individual vars
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Auth
  JWT_SECRET:         process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',

  // CORS
  FRONTEND_ORIGINS: (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  // Storage — Adapter Pattern
  // Set STORAGE_ENGINE=s3 to switch to any S3-compatible provider (AWS S3, DigitalOcean Spaces, Cloudflare R2).
  // Defaults to 'supabase'.
  STORAGE_ENGINE: process.env.STORAGE_ENGINE || 'supabase',

  // Supabase Storage (used when STORAGE_ENGINE=supabase)
  SUPABASE_URL_PUBLIC:        process.env.SUPABASE_URL_PUBLIC        || '',
  SUPABASE_ANON_KEY:          process.env.SUPABASE_ANON_KEY          || '',
  SUPABASE_ASSIGNMENT_BUCKET: process.env.SUPABASE_ASSIGNMENT_BUCKET || 'assignment-files',

  // S3-compatible Storage (used when STORAGE_ENGINE=s3)
  S3_REGION:           process.env.S3_REGION            || 'us-east-1',
  S3_ACCESS_KEY_ID:    process.env.S3_ACCESS_KEY_ID     || '',
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || '',
  // Optional: custom endpoint for S3-compatible providers (e.g. DigitalOcean Spaces, Cloudflare R2)
  S3_ENDPOINT:         process.env.S3_ENDPOINT          || '',
  // Optional: base public URL for files (e.g. CDN or bucket domain). Falls back to constructed URL.
  S3_PUBLIC_BASE_URL:  process.env.S3_PUBLIC_BASE_URL   || '',

  // Zoom
  ZOOM_ACCOUNT_ID:    process.env.ZOOM_ACCOUNT_ID || '',
  ZOOM_CLIENT_ID:     process.env.ZOOM_CLIENT_ID || '',
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET || '',
  ZOOM_HOST_EMAIL:    process.env.ZOOM_HOST_EMAIL || '',
};

export function validateEnv(): void {
  const required: (keyof typeof env)[] = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DATABASE_URL',
  ];

  // Additional required in production
  if (env.NODE_ENV === 'production') {
    required.push(
      'ZOOM_ACCOUNT_ID',
      'ZOOM_CLIENT_ID',
      'ZOOM_CLIENT_SECRET',
      'ZOOM_HOST_EMAIL',
    );

    if (!env.FRONTEND_ORIGINS.length) {
      throw new Error('Missing FRONTEND_ORIGINS');
    }
  }

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  // Use console here intentionally — logger depends on env and may not be ready yet
  console.log('[env] All required environment variables validated ✅');
}