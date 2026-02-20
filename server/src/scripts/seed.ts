// seed.ts - dev script only, not part of production server runtime
// Uses DATABASE_URL directly (env does not expose individual DB_* vars)

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import { env } from '../config/env';

async function executeSqlFile(pool: Pool, filePath: string): Promise<void> {
  const sql = readFileSync(filePath, 'utf-8');
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\\c/i.test(s));

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function seedDatabase(): Promise<void> {
  // Use DATABASE_URL directly - it contains all connection info
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Creating tables from schema.sql...');
    const schemaPath = join(__dirname, '../../sql/schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    const tableStatements = schemaSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !/^(CREATE DATABASE|\\c)/i.test(s));

    for (const statement of tableStatements) {
      await pool.query(statement);
    }
    console.log('Tables created');

    console.log('Seeding data...');
    const seedPath = join(__dirname, '../../sql/seed.sql');
    await executeSqlFile(pool, seedPath);
    console.log('Data seeded');

  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    await seedDatabase();
    console.log('Database setup complete');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

main();
