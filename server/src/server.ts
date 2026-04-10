import app from './app';
import { env, validateEnv } from './config/env';
import { pool } from './config/db';
import logger from './config/logger';

// ── Startup diagnostics ────────────────────────────────────────
// Log complete config summary so production deployments are self-documenting.
// Never log secrets — only presence/absence.
logger.info('[startup] Server initializing', {
  node_env: env.NODE_ENV,
  port: env.PORT,
  // Auth
  jwt_secret_set: !!env.JWT_SECRET,
  jwt_refresh_secret_set: !!env.JWT_REFRESH_SECRET,
  // Database
  database_url_set: !!env.DATABASE_URL,
  // CORS
  frontend_origins: env.FRONTEND_ORIGINS,
  // AWS S3
  aws_region: env.AWS_REGION,
  aws_credentials_set: !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY),
  s3_portal_bucket: env.S3_PORTAL_BUCKET,
  s3_temp_bucket: env.S3_TEMP_BUCKET,
  s3_quiz_bucket: env.S3_QUIZ_BUCKET,
  // Zoom
  zoom_configured: !!(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET),
  zoom_host_email: env.ZOOM_HOST_EMAIL || null,
});

validateEnv();

// Schema sanity check
pool.query("SELECT to_regclass('public.users')")
  .then((res) => logger.info('[db] Users table exists', { result: res.rows[0]?.to_regclass }))
  .catch((err) => logger.error('[db] Table check failed', { error: err.message }));

const port = env.PORT || 4000;

const server = app.listen(port, () => {
  logger.info(`[startup] Server listening on port ${port}`, { port });
});

// Catch unhandled promise rejections before they bring down the process
process.on('unhandledRejection', (reason) => {
  logger.error('[process] Unhandled promise rejection', { reason: String(reason) });
});

// Catch uncaught synchronous exceptions
process.on('uncaughtException', (err) => {
  logger.error('[process] Uncaught exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

const shutdown = async (signal: string) => {
  logger.info(`[shutdown] Received ${signal}, closing server gracefully...`);
  server.close(async () => {
    try {
      await pool.end();
      logger.info('[shutdown] Database pool closed. Bye!');
    } catch (err) {
      logger.error('[shutdown] Error closing database pool', { error: err });
    } finally {
      process.exit(0);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
