"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createClass = createClass;
exports.createSession = createSession;
exports.startSession = startSession;
exports.getTeacherClasses = getTeacherClasses;
exports.getStudentEnrolledClasses = getStudentEnrolledClasses;
exports.getSessionById = getSessionById;
exports.enrollStudent = enrollStudent;
exports.getMyClasses = getMyClasses;
exports.getTeacherClassesV2 = getTeacherClassesV2;
exports.getEnrolledClassesV2 = getEnrolledClassesV2;
exports.getMySessionsV2 = getMySessionsV2;
exports.getSessionsByTeacherV2 = getSessionsByTeacherV2;
exports.getSessionsByStudentV2 = getSessionsByStudentV2;
const crypto_1 = require("crypto");
const db_1 = require("../../config/db");
// Session status calculation
function calculateSessionStatus(scheduled_at, dbStatus, today = new Date()) {
    // LIVE has highest priority
    if (dbStatus === 'LIVE') {
        return 'LIVE';
    }
    // COMPLETED sessions stay completed
    if (dbStatus === 'COMPLETED') {
        return 'COMPLETED';
    }
    const sessionDate = new Date(scheduled_at);
    const todayDate = new Date(today);
    todayDate.setHours(0, 0, 0, 0);
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const sessionDateOnly = new Date(sessionDate);
    sessionDateOnly.setHours(0, 0, 0, 0);
    // Check if session time has passed
    if (sessionDate < today) {
        return 'COMPLETED';
    }
    // Check if session is today
    if (sessionDateOnly.getTime() === todayDate.getTime()) {
        return 'TODAY';
    }
    // Check if session is tomorrow
    if (sessionDateOnly.getTime() === tomorrowDate.getTime()) {
        return 'TOMORROW';
    }
    return 'SCHEDULED';
}
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
async function getMyClasses(userId, role) {
    if (role === 'TEACHER') {
        return getTeacherClassesV2(userId);
    }
    else if (role === 'STUDENT') {
        return getEnrolledClassesV2(userId);
    }
    return [];
}
async function getTeacherClassesV2(teacherId) {
    const rows = await (0, db_1.query)(`SELECT 
      c.id, c.title, c.subject, c.teacher_id, u.name as teacher_name, 
      c.start_date, c.end_date, c.created_at
     FROM classes c
     JOIN users u ON c.teacher_id = u.id
     WHERE c.teacher_id = $1
     ORDER BY c.start_date DESC`, [teacherId]);
    return rows.map(row => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        start_date: row.start_date,
        end_date: row.end_date,
        created_at: row.created_at,
    }));
}
async function getEnrolledClassesV2(studentId) {
    const rows = await (0, db_1.query)(`SELECT 
      c.id, c.title, c.subject, c.teacher_id, u.name as teacher_name,
      c.start_date, c.end_date, c.created_at
     FROM classes c
     JOIN users u ON c.teacher_id = u.id
     JOIN enrollments e ON c.id = e.class_id
     WHERE e.student_id = $1
     ORDER BY c.start_date DESC`, [studentId]);
    return rows.map(row => ({
        id: row.id,
        title: row.title,
        subject: row.subject,
        teacher_id: row.teacher_id,
        teacher_name: row.teacher_name,
        start_date: row.start_date,
        end_date: row.end_date,
        created_at: row.created_at,
    }));
}
async function getMySessionsV2(userId, role) {
    if (role === 'TEACHER') {
        return getSessionsByTeacherV2(userId);
    }
    else if (role === 'STUDENT') {
        return getSessionsByStudentV2(userId);
    }
    return [];
}
async function getSessionsByTeacherV2(teacherId) {
    const rows = await (0, db_1.query)(`SELECT 
      s.id, s.class_id, c.title as class_title, s.title, s.zoom_link, 
      s.scheduled_at, s.status
     FROM sessions s
     JOIN classes c ON s.class_id = c.id
     WHERE c.teacher_id = $1
     ORDER BY s.scheduled_at DESC`, [teacherId]);
    const today = new Date();
    return rows.map(row => ({
        id: row.id,
        class_id: row.class_id,
        class_title: row.class_title,
        title: row.title,
        zoom_link: row.zoom_link,
        scheduled_at: row.scheduled_at,
        status: calculateSessionStatus(row.scheduled_at, row.status, today),
    }));
}
async function getSessionsByStudentV2(studentId) {
    const rows = await (0, db_1.query)(`SELECT 
      s.id, s.class_id, c.title as class_title, s.title, s.zoom_link,
      s.scheduled_at, s.status
     FROM sessions s
     JOIN classes c ON s.class_id = c.id
     JOIN enrollments e ON c.id = e.class_id
     WHERE e.student_id = $1
     ORDER BY s.scheduled_at DESC`, [studentId]);
    const today = new Date();
    return rows.map(row => ({
        id: row.id,
        class_id: row.class_id,
        class_title: row.class_title,
        title: row.title,
        zoom_link: row.zoom_link,
        scheduled_at: row.scheduled_at,
        status: calculateSessionStatus(row.scheduled_at, row.status, today),
    }));
}
//# sourceMappingURL=classes.service.js.map