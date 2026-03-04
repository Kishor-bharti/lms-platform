import app from './app';
import { env, validateEnv } from './config/env';
import { pool } from './config/db';
import logger from './config/logger';

// Startup diagnostics
logger.info('[startup] Server initializing', {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url_set: !!process.env.DATABASE_URL,
  frontend_origins: process.env.FRONTEND_ORIGINS,
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
