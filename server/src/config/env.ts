import dotenv from 'dotenv';

if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: process.env.JWT_SECRET || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  DB_HOST: process.env.DB_HOST || '',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || '',
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || process.env.FRONTEND_URL || '',
  FRONTEND_ORIGINS: (process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
};

export function validateEnv(): void {
  if (env.NODE_ENV === 'production') {
    if (!env.JWT_SECRET) {
      throw new Error('Missing required environment variable: JWT_SECRET');
    }
    if (!env.DATABASE_URL) {
      throw new Error('Missing required environment variable: DATABASE_URL');
    }
    if (!env.FRONTEND_ORIGINS.length) {
      throw new Error('Missing required environment variable: FRONTEND_ORIGINS');
    }
  } else {
    if (!env.JWT_SECRET) {
      throw new Error('Missing required environment variable: JWT_SECRET');
    }
    if (!env.DATABASE_URL && (!env.DB_HOST || !env.DB_USER || !env.DB_NAME)) {
      throw new Error('Database configuration missing: provide DATABASE_URL or DB_HOST/DB_USER/DB_NAME');
    }
  }
}
