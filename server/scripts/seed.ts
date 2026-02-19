/**
 * server/scripts/seed.ts
 *
 * Seeds the 100xlearning database with:
 *   - roles (admin / teacher / student)
 *   - admin user  (admin@100xlearning.com / Admin@123)
 *   - user_roles  (admin → role_id 1, self-assigned)
 *   - courses     (SAT, ACT, Advanced Placement)
 *
 * Run:
 *   npx ts-node server/scripts/seed.ts
 *
 * Idempotent — safe to run multiple times.
 */

import bcrypt from 'bcrypt';
import { pool, withTransaction } from '../src/config/db';

const BCRYPT_ROUNDS = 12;

async function seed(): Promise<void> {
    console.log('[seed] Starting database seed...');

    await withTransaction(async (client) => {

        // ──────────────────────────────────────────────────────────
        // 1. ROLES
        // ──────────────────────────────────────────────────────────
        console.log('[seed] Seeding roles...');

        await client.query(`
      INSERT INTO roles (id, name) VALUES
        (1, 'admin'),
        (2, 'teacher'),
        (3, 'student')
      ON CONFLICT DO NOTHING
    `);

        // ──────────────────────────────────────────────────────────
        // 2. ADMIN USER
        // ──────────────────────────────────────────────────────────
        console.log('[seed] Hashing admin password...');
        const passwordHash = await bcrypt.hash('Admin@123', BCRYPT_ROUNDS);

        console.log('[seed] Seeding admin user...');

        // Insert returns the new UUID; if the email already exists the
        // ON CONFLICT clause silently does nothing and returns no row.
        const insertUserResult = await client.query<{ id: string }>(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5
      )
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `, [
            'admin@100xlearning.com',
            passwordHash,
            'Super',
            'Admin',
            true,
        ]);

        // If the row was already there, fall back to a SELECT
        let adminId: string;
        if (insertUserResult.rows.length > 0) {
            adminId = insertUserResult.rows[0].id;
        } else {
            const selectResult = await client.query<{ id: string }>(`
        SELECT id FROM users WHERE email = $1
      `, ['admin@100xlearning.com']);

            if (selectResult.rows.length === 0) {
                throw new Error('[seed] Admin user not found after insert attempt.');
            }
            adminId = selectResult.rows[0].id;
        }

        console.log(`[seed] Admin user UUID: ${adminId}`);

        // ──────────────────────────────────────────────────────────
        // 3. USER_ROLES  (admin role, self-assigned)
        // ──────────────────────────────────────────────────────────
        console.log('[seed] Seeding user_roles...');

        await client.query(
            `INSERT INTO user_roles (user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [adminId, 1, adminId] as any[]
        );

        // ──────────────────────────────────────────────────────────
        // 4. COURSES
        // ──────────────────────────────────────────────────────────
        console.log('[seed] Seeding courses...');

        // Insert individually so each ON CONFLICT targets a single code.
        const courses: Array<{ name: string; code: string; description: string }> = [
            { name: 'SAT', code: 'SAT', description: 'Scholastic Assessment Test preparation' },
            { name: 'ACT', code: 'ACT', description: 'ACT college readiness preparation' },
            { name: 'Advanced Placement', code: 'AP', description: 'AP exam preparation' },
        ];

        for (const course of courses) {
            await client.query(
                `INSERT INTO courses (id, name, code, description, is_active, created_by)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                 ON CONFLICT (code) DO NOTHING`,
                [course.name, course.code, course.description, true, adminId] as any[]
            );
        }

    }); // end withTransaction

    console.log('[seed] ✅ Seed complete.');
}

// ──────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────
seed()
    .then(() => {
        process.exit(0);
    })
    .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[seed] ❌ Seed failed:', message);
        process.exit(1);
    })
    .finally(() => {
        // Ensure the pool drains so the process doesn't hang
        pool.end();
    });
