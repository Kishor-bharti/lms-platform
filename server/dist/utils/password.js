"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
const bcrypt_1 = __importDefault(require("bcrypt"));
async function hashPassword(plain) {
    const saltRounds = 10;
    return bcrypt_1.default.hash(plain, saltRounds);
}
async function comparePassword(plain, hash) {
    return bcrypt_1.default.compare(plain, hash);
}
//# sourceMappingURL=password.js.map