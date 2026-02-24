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

  console.log('[env] All required environment variables validated ✅');
}