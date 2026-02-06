import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

// Pool connected to postgres system database to create target DB
async function ensureDatabaseExists(): Promise<void> {
  const adminPool = new Pool({
    host: env.DB_HOST || undefined,
    port: env.DB_PORT,
    user: env.DB_USER || undefined,
    password: env.DB_PASSWORD || undefined,
    database: 'postgres',
  });
  try {
    await adminPool.query(`CREATE DATABASE ${env.DB_NAME}`);
    console.log(`✓ Database ${env.DB_NAME} created`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(msg)) {
      throw err;
    }
    console.log(`✓ Database ${env.DB_NAME} already exists`);
  } finally {
    await adminPool.end();
  }
}

async function executeSqlFile(pool: Pool, filePath: string): Promise<void> {
  const sql = readFileSync(filePath, 'utf-8');
  // Split by semicolon and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await pool.query(statement);
  }
}

async function seedDatabase(): Promise<void> {
  const pool = new Pool({
    host: env.DB_HOST || undefined,
    port: env.DB_PORT,
    user: env.DB_USER || undefined,
    password: env.DB_PASSWORD || undefined,
    database: env.DB_NAME || undefined,
  });

  try {
    // Drop existing tables
    console.log('Dropping existing tables...');
    try {
      await pool.query('DROP TABLE IF EXISTS sessions CASCADE');
      await pool.query('DROP TABLE IF EXISTS enrollments CASCADE');
      await pool.query('DROP TABLE IF EXISTS classes CASCADE');
      await pool.query('DROP TABLE IF EXISTS users CASCADE');
      console.log('✓ Tables dropped');
    } catch (err) {
      console.log('✓ No existing tables to drop');
    }

    // Execute schema.sql (creates tables)
    console.log('Creating tables from schema.sql...');
    const schemaPath = join(__dirname, '../../sql/schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');
    
    // Extract only the table creation part (skip CREATE DATABASE and \c)
    const tableStatements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !/^(CREATE DATABASE|\\c)/i.test(s));

    for (const statement of tableStatements) {
      await pool.query(statement);
    }
    console.log('✓ Tables created');

    // Execute seed.sql
    console.log('Seeding data...');
    const seedPath = join(__dirname, '../../sql/seed.sql');
    const seedSql = readFileSync(seedPath, 'utf-8');

    const seedStatements = seedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !/^\\c/i.test(s));

    for (const statement of seedStatements) {
      await pool.query(statement);
    }
    console.log('✓ Data seeded');
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    await ensureDatabaseExists();
    await seedDatabase();
    console.log('✓ Database setup complete');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seeding failed:', err);
    process.exit(1);
  }
}

main();
