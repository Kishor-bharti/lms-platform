"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClass = createClass;
exports.createSession = createSession;
exports.startSession = startSession;
exports.getTeacherClasses = getTeacherClasses;
exports.getStudentEnrolledClasses = getStudentEnrolledClasses;
exports.getSessionById = getSessionById;
exports.enrollStudent = enrollStudent;
const crypto_1 = require("crypto");
const db_1 = require("../../config/db");
async function createClass(title, subject, teacherId) {
    const id = (0, crypto_1.randomUUID)();
    await (0, db_1.query)('INSERT INTO classes (id, title, subject, teacher_id) VALUES (?, ?, ?, ?)', [id, title, subject, teacherId]);
    const classes = await (0, db_1.query)('SELECT * FROM classes WHERE id = ?', [id]);
    if (!classes[0]) {
        throw new Error('Failed to create class');
    }
    return classes[0];
}
async function createSession(classId, title, scheduledAt) {
    const id = (0, crypto_1.randomUUID)();
    await (0, db_1.query)('INSERT INTO sessions (id, class_id, title, status, scheduled_at) VALUES (?, ?, ?, ?, ?)', [id, classId, title, 'SCHEDULED', scheduledAt]);
    const sessions = await (0, db_1.query)('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!sessions[0]) {
        throw new Error('Failed to create session');
    }
    return sessions[0];
}
async function startSession(sessionId) {
    const zoomLink = `https://zoom.mock/meeting/${sessionId}`;
    await (0, db_1.query)('UPDATE sessions SET zoom_link = ?, status = ? WHERE id = ?', [zoomLink, 'LIVE', sessionId]);
    const sessions = await (0, db_1.query)('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    if (!sessions[0]) {
        throw new Error('Session not found');
    }
    return sessions[0];
}
async function getTeacherClasses(teacherId) {
    return await (0, db_1.query)('SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC', [teacherId]);
}
async function getStudentEnrolledClasses(studentId) {
    const enrollments = await (0, db_1.query)(`SELECT c.id, c.title, c.subject, c.start_date, c.end_date, u.name as teacher_name
     FROM classes c
     JOIN enrollments e ON c.id = e.class_id
     JOIN users u ON c.teacher_id = u.id
     WHERE e.student_id = ?
     ORDER BY c.created_at DESC`, [studentId]);
    const studentClasses = [];
    for (const enrollment of enrollments) {
        const sessions = await (0, db_1.query)('SELECT id, title, status, zoom_link, scheduled_at FROM sessions WHERE class_id = ? ORDER BY scheduled_at DESC', [enrollment.id]);
        studentClasses.push({
            id: enrollment.id,
            title: enrollment.title,
            subject: enrollment.subject,
            teacher_name: enrollment.teacher_name,
            start_date: enrollment.start_date,
            end_date: enrollment.end_date,
            sessions: sessions.map(s => ({
                id: s.id,
                title: s.title,
                status: s.status,
                zoom_link: s.zoom_link,
                scheduled_at: s.scheduled_at
            }))
        });
    }
    return studentClasses;
}
async function getSessionById(sessionId) {
    const sessions = await (0, db_1.query)('SELECT * FROM sessions WHERE id = ?', [sessionId]);
    return sessions[0] || null;
}
async function enrollStudent(classId, studentId) {
    const id = (0, crypto_1.randomUUID)();
    await (0, db_1.query)('INSERT INTO enrollments (id, class_id, student_id) VALUES (?, ?, ?)', [id, classId, studentId]);
    const enrollments = await (0, db_1.query)('SELECT * FROM enrollments WHERE id = ?', [id]);
    if (!enrollments[0]) {
        throw new Error('Failed to create enrollment');
    }
    return enrollments[0];
}
//# sourceMappingURL=classes.service.js.map