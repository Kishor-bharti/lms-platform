-- Migration: Student uploads — students can upload files to share with teachers

CREATE TABLE IF NOT EXISTS student_uploads (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID         NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  student_id  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
  topic_id    UUID         REFERENCES topics(id) ON DELETE SET NULL,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  file_url    TEXT         NOT NULL,
  file_name   VARCHAR(255),
  feedback_text TEXT,
  feedback_file_url TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_uploads_subject  ON student_uploads(subject_id);
CREATE INDEX IF NOT EXISTS idx_student_uploads_student  ON student_uploads(student_id);
CREATE INDEX IF NOT EXISTS idx_student_uploads_teacher  ON student_uploads(teacher_id);
CREATE INDEX IF NOT EXISTS idx_student_uploads_topic    ON student_uploads(topic_id);

-- If table already exists, add new columns
ALTER TABLE student_uploads ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES topics(id) ON DELETE SET NULL;
ALTER TABLE student_uploads ADD COLUMN IF NOT EXISTS feedback_text TEXT;
ALTER TABLE student_uploads ADD COLUMN IF NOT EXISTS feedback_file_url TEXT;
