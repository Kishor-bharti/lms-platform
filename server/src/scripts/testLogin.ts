// testLogin.ts - dev script only, not part of production build
// Usage: ts-node src/scripts/testLogin.ts <email> <password> <role>

import { login } from '../modules/auth/auth.service';

async function main() {
  const email    = process.argv[2] || '';
  const password = process.argv[3] || '';
  const loginAs  = (process.argv[4] || 'student') as any;

  if (!email || !password) {
    console.error('Usage: ts-node src/scripts/testLogin.ts <email> <password> [role]');
    process.exit(1);
  }

  try {
    const res = await login(email, password, loginAs);
    console.log('OK', JSON.stringify(res));
  } catch (e: any) {
    console.error('ERR', e?.code || e?.message || e);
    process.exit(2);
  }
}

main();
