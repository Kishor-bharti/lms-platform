"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.verifyConnection = verifyConnection;
const pg_1 = require("pg");
const env_1 = require("./env");
function convertQuestionMarksToDollarParams(sql, params) {
    if (!params || params.length === 0)
        return { text: sql, params };
    let idx = 0;
    const text = sql.replace(/\?/g, () => `$${++idx}`);
    return { text, params };
}
if (!env_1.env.DB_HOST || !env_1.env.DB_USER || !env_1.env.DB_NAME) {
    throw new Error('Database configuration missing: ensure DB_HOST, DB_USER, and DB_NAME are set in environment');
}
const sslOption = process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;
exports.pool = new pg_1.Pool({
    host: env_1.env.DB_HOST,
    port: env_1.env.DB_PORT,
    user: env_1.env.DB_USER,
    password: env_1.env.DB_PASSWORD || undefined,
    database: env_1.env.DB_NAME,
    max: 10,
    ssl: sslOption,
});
async function query(sql, params) {
    const converted = convertQuestionMarksToDollarParams(sql, params);
    const res = await exports.pool.query(converted.text, converted.params);
    return res.rows;
}
async function verifyConnection() {
    try {
        const res = await exports.pool.query('SELECT version()');
        const versionRaw = res.rows[0]?.version ?? '';
        if (typeof versionRaw !== 'string' || !/postgres/i.test(versionRaw)) {
            throw new Error(`Connected server did not identify as PostgreSQL: ${JSON.stringify(res.rows[0])}`);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Postgres connection verification failed: ${msg}`);
    }
}
//# sourceMappingURL=db.js.map