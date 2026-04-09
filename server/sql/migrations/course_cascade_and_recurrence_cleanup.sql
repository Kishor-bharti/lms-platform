-- Add stronger cascade behavior for course/content delete paths
-- and clean orphan recurrence rows automatically.

BEGIN;

-- 1) Ensure deleting questions cascades attempt_answers rows
ALTER TABLE attempt_answers
  DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey;

ALTER TABLE attempt_answers
  ADD CONSTRAINT attempt_answers_question_id_fkey
  FOREIGN KEY (question_id)
  REFERENCES questions(id)
  ON DELETE CASCADE;

-- 2) Remove orphan recurrence rows when sessions are deleted
CREATE OR REPLACE FUNCTION fn_cleanup_orphan_session_recurrence()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.recurrence_id IS NOT NULL THEN
    DELETE FROM session_recurrence sr
    WHERE sr.id = OLD.recurrence_id
      AND NOT EXISTS (
        SELECT 1 FROM sessions s WHERE s.recurrence_id = OLD.recurrence_id
      );
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_orphan_session_recurrence ON sessions;
CREATE TRIGGER trg_cleanup_orphan_session_recurrence
  AFTER DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_cleanup_orphan_session_recurrence();

COMMIT;
