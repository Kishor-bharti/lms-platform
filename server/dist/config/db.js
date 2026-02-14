"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.query = query;
exports.queryWithClient = queryWithClient;
exports.withTransaction = withTransaction;
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
const sslOption = env_1.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined;
const poolConfig = env_1.env.DATABASE_URL
    ? {
        connectionString: env_1.env.DATABASE_URL,
        max: 10,
        ssl: sslOption,
    }
    : {
        host: env_1.env.DB_HOST,
        port: env_1.env.DB_PORT,
        user: env_1.env.DB_USER,
        password: env_1.env.DB_PASSWORD || undefined,
        database: env_1.env.DB_NAME,
        max: 10,
        ssl: sslOption,
    };
exports.pool = new pg_1.Pool(poolConfig);
async function query(sql, params) {
    const converted = convertQuestionMarksToDollarParams(sql, params);
    const res = await exports.pool.query(converted.text, converted.params);
    return res.rows;
}
async function queryWithClient(client, sql, params) {
    const converted = convertQuestionMarksToDollarParams(sql, params);
    const res = await client.query(converted.text, converted.params);
    return res.rows;
}
async function withTransaction(fn) {
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
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