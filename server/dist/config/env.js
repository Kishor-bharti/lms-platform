"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
exports.validateEnv = validateEnv;
const dotenv_1 = __importDefault(require("dotenv"));
// if (process.env.NODE_ENV === 'test') {
//   dotenv.config({ path: '.env.test' });
// } else {
//   dotenv.config();
// }
dotenv_1.default.config({
    path: process.env.NODE_ENV === "test"
        ? ".env.test"
        : process.env.NODE_ENV === "production"
            ? ".env.production"
            : ".env.development"
});
exports.env = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    JWT_SECRET: process.env.JWT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    FRONTEND_ORIGINS: (process.env.FRONTEND_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
};
function validateEnv() {
    if (exports.env.NODE_ENV === 'production') {
        if (!exports.env.JWT_SECRET) {
            throw new Error('Missing required environment variable: JWT_SECRET');
        }
        if (!exports.env.DATABASE_URL) {
            throw new Error('Missing required environment variable: DATABASE_URL');
        }
        if (!exports.env.FRONTEND_ORIGINS.length) {
            throw new Error('Missing required environment variable: FRONTEND_ORIGINS');
        }
    }
    else {
        if (!exports.env.JWT_SECRET) {
            throw new Error('Missing required environment variable: JWT_SECRET');
        }
        if (!exports.env.DATABASE_URL && (!exports.env.DB_HOST || !exports.env.DB_USER || !exports.env.DB_NAME)) {
            throw new Error('Database configuration missing: provide DATABASE_URL or DB_HOST/DB_USER/DB_NAME');
        }
    }
}
//# sourceMappingURL=env.js.map