import app from './app';
import { env, validateEnv } from './config/env';
import { pool } from './config/db';

validateEnv();

const requiredZoom = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
for (const key of requiredZoom) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

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
