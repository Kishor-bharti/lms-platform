"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = require("../config/env");
function requireStringEnv(name) {
    const value = env_1.env[name];
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`Missing or invalid string env: ${String(name)}`);
    }
    return value;
}
function requireNumberEnv(name) {
    const value = env_1.env[name];
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`Missing or invalid number env: ${String(name)}`);
    }
    return value;
}
function assertDbNameSafe(name) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) {
        throw new Error('DB_NAME must contain only letters, numbers, and underscore');
    }
}
async function createDatabase() {
    const host = requireStringEnv('DB_HOST');
    const port = requireNumberEnv('DB_PORT');
    const user = requireStringEnv('DB_USER');
    const password = requireStringEnv('DB_PASSWORD');
    const dbName = requireStringEnv('DB_NAME');
    assertDbNameSafe(dbName);
    const conn = await promise_1.default.createConnection({ host, port, user, password });
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
}
async function createUsersTable() {
    const host = requireStringEnv('DB_HOST');
    const port = requireNumberEnv('DB_PORT');
    const user = requireStringEnv('DB_USER');
    const password = requireStringEnv('DB_PASSWORD');
    const dbName = requireStringEnv('DB_NAME');
    const conn = await promise_1.default.createConnection({ host, port, user, password, database: dbName });
    const createSql = `
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_users_email UNIQUE (email),
      CONSTRAINT chk_users_role CHECK (role IN ('ADMIN','TEACHER','STUDENT')),
      CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE','INACTIVE'))
    ) ENGINE=InnoDB
      DEFAULT CHARSET = utf8mb4
      COLLATE = utf8mb4_unicode_ci;
  `;
    await conn.query(createSql);
    await conn.end();
}
async function seedUsers() {
    const host = requireStringEnv('DB_HOST');
    const port = requireNumberEnv('DB_PORT');
    const user = requireStringEnv('DB_USER');
    const password = requireStringEnv('DB_PASSWORD');
    const dbName = requireStringEnv('DB_NAME');
    const conn = await promise_1.default.createConnection({ host, port, user, password, database: dbName });
    const pass1 = await bcrypt_1.default.hash('123', 10);
    const pass2 = await bcrypt_1.default.hash('123', 10);
    const insertSql = `
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      password_hash = VALUES(password_hash),
      role = VALUES(role),
      status = VALUES(status);
  `;
    await conn.execute(insertSql, ['Kishor', 'kishor@gmail.com', pass1, 'STUDENT', 'ACTIVE']);
    await conn.execute(insertSql, ['Harman', 'harman@gmail.com', pass2, 'TEACHER', 'ACTIVE']);
    await conn.end();
}
async function main() {
    console.log('Creating database...');
    await createDatabase();
    console.log('Ensuring users table exists...');
    await createUsersTable();
    console.log('Seeding users...');
    await seedUsers();
    console.log('Done.');
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=seed.js.map