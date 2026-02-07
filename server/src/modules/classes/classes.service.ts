import { randomUUID } from 'crypto';
import { query } from '../../config/db';
import { Class, Session, Enrollment, StudentClass } from './classes.types';

// Session status calculation
function calculateSessionStatus(
  scheduled_at: string,
  dbStatus: string,
  today: Date = new Date()
): string {
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

export async function createClass(title: string, subject: string, teacherId: number): Promise<Class> {
  const id = randomUUID();
  await query(
    'INSERT INTO classes (id, title, subject, teacher_id) VALUES (?, ?, ?, ?)',
    [id, title, subject, teacherId]
  );
  const classes = await query<Class>(
    'SELECT * FROM classes WHERE id = ?',
    [id]
  );
  
  if (!classes[0]) {
    throw new Error('Failed to create class');
  }
  
  return classes[0];
}

export async function createSession(classId: string, title: string, scheduledAt: Date): Promise<Session> {
  const id = randomUUID();
  await query(
    'INSERT INTO sessions (id, class_id, title, status, scheduled_at) VALUES (?, ?, ?, ?, ?)',
    [id, classId, title, 'SCHEDULED', scheduledAt]
  );
  const sessions = await query<Session>(
    'SELECT * FROM sessions WHERE id = ?',
    [id]
  );
  
  if (!sessions[0]) {
    throw new Error('Failed to create session');
  }
  
  return sessions[0];
}

export async function startSession(sessionId: string): Promise<Session> {
  const zoomLink = `https://zoom.mock/meeting/${sessionId}`;
  await query(
    'UPDATE sessions SET zoom_link = ?, status = ? WHERE id = ?',
    [zoomLink, 'LIVE', sessionId]
  );
  const sessions = await query<Session>(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId]
  );
  
  if (!sessions[0]) {
    throw new Error('Session not found');
  }
  
  return sessions[0];
}

export async function getTeacherClasses(teacherId: number): Promise<Class[]> {
  return await query<Class>(
    'SELECT * FROM classes WHERE teacher_id = ? ORDER BY created_at DESC',
    [teacherId]
  );
}

export async function getStudentEnrolledClasses(studentId: number): Promise<StudentClass[]> {
  const enrollments = await query<{
    id: string;
    title: string;
    subject: string | null;
    start_date: string | null;
    end_date: string | null;
    teacher_name: string;
  }>(
    `SELECT c.id, c.title, c.subject, c.start_date, c.end_date, u.name as teacher_name
     FROM classes c
     JOIN enrollments e ON c.id = e.class_id
     JOIN users u ON c.teacher_id = u.id
     WHERE e.student_id = ?
     ORDER BY c.created_at DESC`,
    [studentId]
  );

  const studentClasses: StudentClass[] = [];

  for (const enrollment of enrollments) {
    const sessions = await query<Session>(
      'SELECT id, title, status, zoom_link, scheduled_at FROM sessions WHERE class_id = ? ORDER BY scheduled_at DESC',
      [enrollment.id]
    );

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

export async function getSessionById(sessionId: string): Promise<Session | null> {
  const sessions = await query<Session>(
    'SELECT * FROM sessions WHERE id = ?',
    [sessionId]
  );
  return sessions[0] || null;
}

export async function enrollStudent(classId: string, studentId: number): Promise<Enrollment> {
  const id = randomUUID();
  await query(
    'INSERT INTO enrollments (id, class_id, student_id) VALUES (?, ?, ?)',
    [id, classId, studentId]
  );
  const enrollments = await query<Enrollment>(
    'SELECT * FROM enrollments WHERE id = ?',
    [id]
  );
  
  if (!enrollments[0]) {
    throw new Error('Failed to create enrollment');
  }
  
  return enrollments[0];
}

// New APIs for data-driven UI

export interface ClassWithTeacher {
  id: string;
  title: string;
  subject: string | null;
  teacher_id: string;
  teacher_name: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface SessionWithDetails {
  id: string;
  class_id: string;
  class_title: string;
  title: string | null;
  zoom_link: string | null;
  scheduled_at: string;
  status: string; // 'COMPLETED' | 'TODAY' | 'TOMORROW' | 'SCHEDULED' | 'LIVE'
}

export async function getMyClasses(userId: string, role: string): Promise<ClassWithTeacher[]> {
  if (role === 'TEACHER') {
    return getTeacherClassesV2(userId);
  } else if (role === 'STUDENT') {
    return getEnrolledClassesV2(userId);
  }
  return [];
}

export async function getTeacherClassesV2(teacherId: string): Promise<ClassWithTeacher[]> {
  const rows = await query<any>(
    `SELECT 
      c.id, c.title, c.subject, c.teacher_id, u.name as teacher_name, 
      c.start_date, c.end_date, c.created_at
     FROM classes c
     JOIN users u ON c.teacher_id = u.id
     WHERE c.teacher_id = $1
     ORDER BY c.start_date DESC`,
    [teacherId]
  );

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

export async function getEnrolledClassesV2(studentId: string): Promise<ClassWithTeacher[]> {
  const rows = await query<any>(
    `SELECT 
      c.id, c.title, c.subject, c.teacher_id, u.name as teacher_name,
      c.start_date, c.end_date, c.created_at
     FROM classes c
     JOIN users u ON c.teacher_id = u.id
     JOIN enrollments e ON c.id = e.class_id
     WHERE e.student_id = $1
     ORDER BY c.start_date DESC`,
    [studentId]
  );

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

export async function getMySessionsV2(userId: string, role: string): Promise<SessionWithDetails[]> {
  if (role === 'TEACHER') {
    return getSessionsByTeacherV2(userId);
  } else if (role === 'STUDENT') {
    return getSessionsByStudentV2(userId);
  }
  return [];
}

export async function getSessionsByTeacherV2(teacherId: string): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT 
      s.id, s.class_id, c.title as class_title, s.title, s.zoom_link, 
      s.scheduled_at, s.status
     FROM sessions s
     JOIN classes c ON s.class_id = c.id
     WHERE c.teacher_id = $1
     ORDER BY s.scheduled_at DESC`,
    [teacherId]
  );

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

export async function getSessionsByStudentV2(studentId: string): Promise<SessionWithDetails[]> {
  const rows = await query<any>(
    `SELECT 
      s.id, s.class_id, c.title as class_title, s.title, s.zoom_link,
      s.scheduled_at, s.status
     FROM sessions s
     JOIN classes c ON s.class_id = c.id
     JOIN enrollments e ON c.id = e.class_id
     WHERE e.student_id = $1
     ORDER BY s.scheduled_at DESC`,
    [studentId]
  );

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
