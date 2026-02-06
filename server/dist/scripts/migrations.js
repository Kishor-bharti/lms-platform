"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTables = createTables;
async function createTables(query) {
    try {
        await query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);
        await query(`
      CREATE TABLE IF NOT EXISTS classes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(150) NOT NULL,
        subject VARCHAR(100),
        teacher_id BIGINT NOT NULL,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
        await query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID NOT NULL,
        student_id BIGINT NOT NULL,
        enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (class_id, student_id),
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
        await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        class_id UUID NOT NULL,
        title VARCHAR(150),
        zoom_link TEXT,
        recording_url TEXT,
        status VARCHAR(50) DEFAULT 'SCHEDULED',
        scheduled_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
      );
    `);
        console.log('Tables created successfully');
    }
    catch (error) {
        if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
            throw error;
        }
    }
}
//# sourceMappingURL=migrations.js.map