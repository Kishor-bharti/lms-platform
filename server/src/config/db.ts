// config/db.ts — adds queryWithClient (needed by startSessionById)
// DO NOT change pool config or other exports

import { Pool, PoolClient } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl: env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.query('SELECT 1')
  .then(() => console.log('[db] Connection successful'))
  .catch((err) => console.error('[db] Connection failed:', err.message));

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
  console.log('[db] Verifying PostgreSQL connection...');
  try {
    const res = await pool.query<{ version: string }>('SELECT version()');
    const version = res.rows[0]?.version ?? '';
    if (!/postgres/i.test(version)) {
      throw new Error(`Not PostgreSQL: ${version}`);
    }
    console.log('[db] PostgreSQL verified:', version.split(' ').slice(0, 2).join(' '));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`DB verification failed: ${msg}`);
  }
}
