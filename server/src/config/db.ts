import { Pool, PoolConfig } from 'pg';
import { env } from './env';

function convertQuestionMarksToDollarParams(sql: string, params?: any[]): { text: string; params: any[] | undefined } {
  if (!params || params.length === 0) return { text: sql, params };
  let idx = 0;
  const text = sql.replace(/\?/g, () => `$${++idx}`);
  return { text, params };
}

const sslOption =
  env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined;


type PoolConfigWithConnection = PoolConfig & { connectionString?: string };

const poolConfig: PoolConfigWithConnection = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      max: 10,
      ssl: sslOption as any,
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD || undefined,
      database: env.DB_NAME,
      max: 10,
      ssl: sslOption as any,
    };

export const pool = new Pool(poolConfig);

// TASK 2: Database Connection Verification Log
pool.query('SELECT 1')
  .then(() => console.log('[db] Connection successful'))
  .catch((err) => console.error('[db] Connection failed:', err.message));

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const converted = convertQuestionMarksToDollarParams(sql, params);
  const res = await pool.query<T>(converted.text, converted.params);
  return res.rows as T[];
}

export async function queryWithClient<T = any>(client: any, sql: string, params?: any[]): Promise<T[]> {
  const converted = convertQuestionMarksToDollarParams(sql, params);
  const res = await client.query(converted.text, converted.params);
  return res.rows as T[];
}

export async function withTransaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await (pool as any).connect();
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

export async function verifyConnection(): Promise<void> {
  console.log('[db] Verifying PostgreSQL connection...');
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
