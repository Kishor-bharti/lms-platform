"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const fs_1 = require("fs");
const path_1 = require("path");
const env_1 = require("../config/env");
// Pool connected to postgres system database to create target DB
async function ensureDatabaseExists() {
    const adminPool = new pg_1.Pool({
        host: env_1.env.DB_HOST || undefined,
        port: env_1.env.DB_PORT,
        user: env_1.env.DB_USER || undefined,
        password: env_1.env.DB_PASSWORD || undefined,
        database: 'postgres',
    });
    try {
        await adminPool.query(`CREATE DATABASE ${env_1.env.DB_NAME}`);
        console.log(`✓ Database ${env_1.env.DB_NAME} created`);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!/already exists/i.test(msg)) {
            throw err;
        }
        console.log(`✓ Database ${env_1.env.DB_NAME} already exists`);
    }
    finally {
        await adminPool.end();
    }
}
async function executeSqlFile(pool, filePath) {
    const sql = (0, fs_1.readFileSync)(filePath, 'utf-8');
    // Split by semicolon and filter empty statements
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    for (const statement of statements) {
        await pool.query(statement);
    }
}
async function seedDatabase() {
    const pool = new pg_1.Pool({
        host: env_1.env.DB_HOST || undefined,
        port: env_1.env.DB_PORT,
        user: env_1.env.DB_USER || undefined,
        password: env_1.env.DB_PASSWORD || undefined,
        database: env_1.env.DB_NAME || undefined,
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
        }
        catch (err) {
            console.log('✓ No existing tables to drop');
        }
        // Execute schema.sql (creates tables)
        console.log('Creating tables from schema.sql...');
        const schemaPath = (0, path_1.join)(__dirname, '../../sql/schema.sql');
        const schemaSql = (0, fs_1.readFileSync)(schemaPath, 'utf-8');
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
        const seedPath = (0, path_1.join)(__dirname, '../../sql/seed.sql');
        const seedSql = (0, fs_1.readFileSync)(seedPath, 'utf-8');
        const seedStatements = seedSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !/^\\c/i.test(s));
        for (const statement of seedStatements) {
            await pool.query(statement);
        }
        console.log('✓ Data seeded');
    }
    finally {
        await pool.end();
    }
}
async function main() {
    try {
        await ensureDatabaseExists();
        await seedDatabase();
        console.log('✓ Database setup complete');
        process.exit(0);
    }
    catch (err) {
        console.error('✗ Seeding failed:', err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=seed.js.map