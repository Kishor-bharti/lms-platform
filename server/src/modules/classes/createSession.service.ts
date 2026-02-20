// createSession.service.ts — ADD THIS FUNCTION to classes.service.ts
// (paste this function at the bottom of your existing classes.service.ts)

import { query } from '../../config/db';

export interface CreateSessionInput {
  subjectId:   string;
  teacherId:   string;
  title:       string;
  sessionDate: string;   // "YYYY-MM-DD"
  startTime:   string;   // "HH:MM:00+05:30"
}

export interface CreatedSession {
  id:          string;
  subject_id:  string;
  class_title: string;
  title:       string;
  scheduled_at: string;
  status:      string;
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const { subjectId, teacherId, title, sessionDate, startTime } = input;

  // End time = start time + 90 minutes (prevents CHECK constraint violation)
  const endTime = computeEndTime(startTime, 90);

  const rows = await query<any>(
    `INSERT INTO sessions (
       subject_id, teacher_id, title,
       session_date, start_time, end_time,
       timezone, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'Asia/Kolkata', 'scheduled')
     RETURNING
       id,
       subject_id,
       title,
       session_date::text  AS session_date,
       start_time::text    AS start_time,
       status`,
    [subjectId, teacherId, title, sessionDate, startTime, endTime]
  );

  if (!rows[0]) throw new Error('Failed to create session');

  const r = rows[0];

  // Fetch subject name for response
  const subjectRows = await query<any>(
    `SELECT name FROM subjects WHERE id = $1`,
    [subjectId]
  );

  const timeStr = r.start_time.replace(/[+-]\d{2}:\d{2}$/, '');

  return {
    id:          r.id,
    subject_id:  r.subject_id,
    class_title: subjectRows[0]?.name ?? '',
    title:       r.title,
    scheduled_at: `${r.session_date}T${timeStr}`,
    status:      'SCHEDULED',
  };
}

// Add 90 minutes to a TIMETZ string like "18:30:00+05:30"
function computeEndTime(startTime: string, addMinutes: number): string {
  // Strip timezone suffix to parse
  const tz      = startTime.match(/[+-]\d{2}:\d{2}$/)?.[0] ?? '+05:30';
  const timePart = startTime.replace(/[+-]\d{2}:\d{2}$/, '');
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map(Number);

  const totalMinutes = hh * 60 + mm + addMinutes;
  const newHH = Math.floor(totalMinutes / 60) % 24;
  const newMM = totalMinutes % 60;

  return `${String(newHH).padStart(2, '0')}:${String(newMM).padStart(2, '0')}:${String(ss ?? 0).padStart(2, '0')}${tz}`;
}
