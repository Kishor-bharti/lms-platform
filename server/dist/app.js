"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const classes_routes_1 = __importDefault(require("./modules/classes/classes.routes"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./middlewares/error.middleware");
const app = (0, express_1.default)();
app.set('trust proxy', 1);
app.use((0, helmet_1.default)());
app.use(express_1.default.json());
const normalizeOrigin = (value) => value ? value.replace(/\/+$/, '') : undefined;
const allowedOrigins = env_1.env.NODE_ENV === 'production'
    ? env_1.env.FRONTEND_ORIGINS.map(normalizeOrigin).filter(Boolean)
    : ['http://localhost:3000'];
console.info(`[cors] Allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
const corsOptions = {
    origin(origin, callback) {
        if (!origin)
            return callback(null, true);
        const normalizedOrigin = normalizeOrigin(origin);
        if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin))
            return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
app.use('/api/auth', auth_routes_1.default);
app.use('/api/classes', classes_routes_1.default);
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map