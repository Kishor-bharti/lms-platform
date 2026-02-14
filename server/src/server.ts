import app from './app';
import { env, validateEnv } from './config/env';
import { pool } from './config/db';

// TASK 1: Startup Diagnostics
console.log('[startup] NODE_ENV:', process.env.NODE_ENV);
console.log('[startup] PORT:', process.env.PORT);
console.log('[startup] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[startup] FRONTEND_ORIGINS:', process.env.FRONTEND_ORIGINS);

validateEnv();

const requiredZoom = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
for (const key of requiredZoom) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

// TASK 5: Migration Check Log
pool.query("SELECT to_regclass('public.users')")
  .then((res) => console.log('[db] Users table exists:', res.rows[0]?.to_regclass))
  .catch((err) => console.error('[db] Table check failed:', err.message));

const port = env.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

const shutdown = async (signal: string) => {
  console.log(`[shutdown] Received ${signal}, closing server...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('[shutdown] Database pool closed.');
    } catch (err) {
      console.error('[shutdown] Error closing database pool.', err);
    } finally {
      process.exit(0);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
