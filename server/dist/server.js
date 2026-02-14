"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const db_1 = require("./config/db");
// TASK 1: Startup Diagnostics
console.log('[startup] NODE_ENV:', process.env.NODE_ENV);
console.log('[startup] PORT:', process.env.PORT);
console.log('[startup] DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('[startup] FRONTEND_ORIGINS:', process.env.FRONTEND_ORIGINS);
(0, env_1.validateEnv)();
const requiredZoom = ['ZOOM_ACCOUNT_ID', 'ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];
for (const key of requiredZoom) {
    if (!process.env[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
}
// TASK 5: Migration Check Log
db_1.pool.query("SELECT to_regclass('public.users')")
    .then((res) => console.log('[db] Users table exists:', res.rows[0]?.to_regclass))
    .catch((err) => console.error('[db] Table check failed:', err.message));
const port = env_1.env.PORT || 4000;
const server = app_1.default.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
const shutdown = async (signal) => {
    console.log(`[shutdown] Received ${signal}, closing server...`);
    server.close(async () => {
        try {
            await db_1.pool.end();
            console.log('[shutdown] Database pool closed.');
        }
        catch (err) {
            console.error('[shutdown] Error closing database pool.', err);
        }
        finally {
            process.exit(0);
        }
    });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
//# sourceMappingURL=server.js.map