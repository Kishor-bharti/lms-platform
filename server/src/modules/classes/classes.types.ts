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
  title: string;
  zoom_link: string | null;     // meeting_link from DB
  start_url?: string;           // zoom_start_url (teachers only)
  zoom_meeting_id?: string | null;
  scheduled_at: string;         // ISO string: session_date + start_time
  status: string;               // LIVE | TODAY | TOMORROW | SCHEDULED | COMPLETED
}

// ─── Legacy types (kept for backward compat) ──────────────────

export interface Enrollment {
  id: string;
  subject_id: string;
  student_id: string;
  enrolled_at: Date;
}
