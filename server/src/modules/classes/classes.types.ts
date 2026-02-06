export interface Class {
  id: string;
  title: string;
  subject: string | null;
  teacher_id: number;
  start_date: string | null;
  end_date: string | null;
  created_at: Date;
}

export interface Session {
  id: string;
  class_id: string;
  title: string | null;
  zoom_link: string | null;
  recording_url: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
  scheduled_at: Date;
  created_at: Date;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: number;
  enrolled_at: Date;
}

export interface StudentClass {
  id: string;
  title: string;
  subject: string | null;
  teacher_name: string;
  start_date: string | null;
  end_date: string | null;
  sessions: SessionWithStatus[];
}

export interface SessionWithStatus {
  id: string;
  title: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED';
  zoom_link: string | null;
  scheduled_at: Date;
}
