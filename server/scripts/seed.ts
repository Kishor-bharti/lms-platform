/**
 * server/scripts/seed.ts
 *
 * Sets up the database using the environment loaded from .env.<NODE_ENV>
 * (defaults to .env.development — never touches production unless NODE_ENV=production).
 *
 * Usage:
 *   npm run seed             — schema.sql + seed.sql  (fresh empty database)
 *   npm run seed -- --reset  — drop.sql + schema.sql + seed.sql  (full wipe + rebuild)
 *
 * --reset is blocked when NODE_ENV=production.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { pool } from '../src/config/db';
import { env } from '../src/config/env';

const SQL_DIR  = path.resolve(__dirname, '../sql');
const IS_RESET = process.argv.includes('--reset');

// ── helpers ────────────────────────────────────────────────────

async function runFile(label: string, filePath: string): Promise<void> {
  console.log(`[seed] Running ${label}...`);
  const sql = fs.readFileSync(filePath, 'utf8');
  await pool.query(sql);
  console.log(`[seed] ✅ ${label} done.\n`);
}

function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/** Shows host + db name from the connection URL — never leaks passwords. */
function dbLabel(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return '(unparseable URL)';
  }
}

// ── main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const envName = env.NODE_ENV;
  const dbUrl   = env.DATABASE_URL;

  console.log('');
  console.log(`  Environment : ${envName}`);
  console.log(`  Database    : ${dbLabel(dbUrl)}`);
  console.log(`  Mode        : ${IS_RESET ? '⚠️  RESET (drop + rebuild)' : 'setup (schema + seed)'}`);
  console.log('');

  if (IS_RESET) {
    // Hard block on production
    if (envName === 'production') {
      console.error('[seed] ❌  --reset is blocked in production. Aborting.');
      process.exit(1);
    }

    const ok = await confirm('[seed] ⚠️  This will DROP all tables and data. Continue? (y/N): ');
    if (!ok) {
      console.log('[seed] Aborted.');
      process.exit(0);
    }
    console.log('');
    await runFile('drop.sql', path.join(SQL_DIR, 'drop.sql'));
  }

  await runFile('schema.sql', path.join(SQL_DIR, 'schema.sql'));
  await runFile('seed.sql',   path.join(SQL_DIR, 'seed.sql'));

  console.log('[seed] ✅ Database ready.');
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[seed] ❌ Failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(() => pool.end());
