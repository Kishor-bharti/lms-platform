import { randomUUID } from 'crypto';
import { query } from '../../config/db';
import { Class, Session, Enrollment, StudentClass } from './classes.types';

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
