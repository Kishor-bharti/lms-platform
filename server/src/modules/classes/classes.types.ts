// classes.types.ts — v2.1 schema aligned

// ─── DB row shapes ─────────────────────────────────────────────

export interface SubjectRow {
  id: string;
  name: string;
  code: string;
  description: string | null;
  course_name: string;
  course_code: string;
  teacher_name: string;
}

export interface SessionRow {
  id: string;
  subject_id: string;
  class_title: string;   // subject name
  title: string;
  meeting_link: string | null;
  zoom_start_url: string | null;
  zoom_meeting_id: string | null;
  session_date: string;  // DATE
  start_time: string;    // TIMETZ
  status: string;        // 'scheduled' | 'live' | 'completed' | 'cancelled'
}

// ─── API response shapes ───────────────────────────────────────

export interface ClassWithTeacher {
  id: string;
  title: string;         // subject name
  code: string;
  description: string | null;
  course_name: string;
  course_code: string;
  teacher_name: string;
}

export interface SessionWithDetails {
  id: string;
  subject_id: string;
  topic_id?: string;
  topic_name?: string;
  class_title: string;
  course_name?: string;
  title: string;
  zoom_link: string | null;     // meeting_link from DB
  start_url?: string;           // zoom_start_url (teachers only)
  zoom_meeting_id?: string | null;
  scheduled_at: string;         // ISO string: session_date + start_time
  session_date?: string;        // YYYY-MM-DD (local date the session is on)
  start_time?: string;          // TIMETZ e.g. "18:30:00+05:30"
  end_time?: string;            // raw TIMETZ e.g. "20:00:00+05:30"
  recurrence_id?: string;       // UUID of the session_recurrence row (recurring only)
  is_recurring?: boolean;
  recur_pattern?: string;       // 'daily' | 'weekly'
  recur_days?: number[];        // 0=Sun … 6=Sat (weekly only)
  recur_until?: string;         // YYYY-MM-DD
  teacher_name?: string;        // full name (admin + student views)
  target_students?: string;     // comma-separated names (null = all enrolled)
  target_count?: number;        // 0 = open to all enrolled
  status: string;               // LIVE | TODAY | TOMORROW | SCHEDULED | MISSED | COMPLETED
}

// ─── Legacy types (kept for backward compat) ──────────────────

export interface Enrollment {
  id: string;
  subject_id: string;
  student_id: string;
  enrolled_at: Date;
}
