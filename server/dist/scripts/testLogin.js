"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_service_1 = require("../modules/auth/auth.service");
async function main() {
    const email = process.argv[2] || "";
    const password = process.argv[3] || "";
    if (!email || !password) {
        console.error("Usage: ts-node src/scripts/testLogin.ts <email> <password>");
        process.exit(1);
    }
    try {
        const res = await (0, auth_service_1.login)(email, password);
        console.log("OK", JSON.stringify(res));
    }
    catch (e) {
        console.error("ERR", e?.code || e?.message || e);
        process.exit(2);
    }
}
main();
//# sourceMappingURL=testLogin.js.map