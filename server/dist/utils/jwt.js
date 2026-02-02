"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const defaultExpiry = 60 * 60 * 24; // 1 day in seconds
function signAccessToken(payload, expiresIn = defaultExpiry) {
    const secret = env_1.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET not configured');
    const options = { expiresIn };
    return jsonwebtoken_1.default.sign(payload, secret, options);
}
function verifyAccessToken(token) {
    const secret = env_1.env.JWT_SECRET;
    if (!secret)
        throw new Error('JWT_SECRET not configured');
    return jsonwebtoken_1.default.verify(token, secret);
}
//# sourceMappingURL=jwt.js.map