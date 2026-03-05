// config/db.ts — adds queryWithClient (needed by startSessionById)
// DO NOT change pool config or other exports

import { Pool, PoolClient } from 'pg';
import { env } from './env';
import logger from './logger';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 40000,
  connectionTimeoutMillis: 20000,
  ssl: env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.query('SELECT 1')
  .then(() => logger.info('[db] Connection successful'))
  .catch((err) => logger.error('[db] Connection failed', { error: err.message }));

// ─── Standard query helper ─────────────────────────────────────
export async function query<T extends Record<string, any> = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const res = await pool.query<T>(sql, params);
  return res.rows;
}

// ─── Client-bound query (use inside withTransaction) ──────────
// NEW: required by startSessionById / completeSessionById
export async function queryWithClient<T extends Record<string, any> = any>(
  client: PoolClient,
  sql: string,
  params?: any[]
): Promise<T[]> {
  const res = await client.query<T>(sql, params);
  return res.rows;
}

// ─── Transaction wrapper ───────────────────────────────────────
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─── Startup connection check ──────────────────────────────────
export async function verifyConnection(): Promise<void> {
  logger.info('[db] Verifying PostgreSQL connection...');
  try {
    const res = await pool.query<{ version: string }>('SELECT version()');
    const version = res.rows[0]?.version ?? '';
    if (!/postgres/i.test(version)) {
      throw new Error(`Not PostgreSQL: ${version}`);
    }
    logger.info('[db] PostgreSQL verified', { version: version.split(' ').slice(0, 2).join(' ') });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DB verification failed: ${msg}`);
  }
}
