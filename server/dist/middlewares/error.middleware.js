"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const env_1 = require("../config/env");
function errorHandler(err, req, res, _next) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;
    const code = err.code || (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
    const message = status >= 500 ? 'Internal server error' : err.message || 'Request failed';
    // TASK 4: Improve Global Error Handler
    console.error('[global error]', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        statusCode: status,
    });
    const logPayload = {
        message: err.message,
        code: err.code,
        status,
        path: req.path,
        method: req.method,
        details: err.details,
        stack: env_1.env.NODE_ENV !== 'production' ? err.stack : undefined,
    };
    console.error('[error]', logPayload);
    return res.status(status).json({
        error: {
            message: process.env.NODE_ENV === 'production' ? 'Internal server error' : message,
            code,
        },
    });
}
//# sourceMappingURL=error.middleware.js.map