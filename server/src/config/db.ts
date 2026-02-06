import { Pool } from 'pg';
import { env } from './env';

function convertQuestionMarksToDollarParams(sql: string, params?: any[]): { text: string; params: any[] | undefined } {
  if (!params || params.length === 0) return { text: sql, params };
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, params };
}

if (!env.DB_HOST || !env.DB_USER || !env.DB_NAME) {
  throw new Error('Database configuration missing: ensure DB_HOST, DB_USER, and DB_NAME are set in environment');
}

const sslOption = process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;

export const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD || undefined,
  database: env.DB_NAME,
  max: 10,
  ssl: sslOption as any,
});

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const converted = convertQuestionMarksToDollarParams(sql, params);
  const res = await pool.query<T>(converted.text, converted.params);
  return res.rows as T[];
}

export async function verifyConnection(): Promise<void> {
  try {
    const res = await pool.query<{ version?: string }>('SELECT version()');
    const versionRaw = res.rows[0]?.version ?? '';
    if (typeof versionRaw !== 'string' || !/postgres/i.test(versionRaw)) {
      throw new Error(`Connected server did not identify as PostgreSQL: ${JSON.stringify(res.rows[0])}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Postgres connection verification failed: ${msg}`);
  }
}
