-- Fix fn_quiz_teacher_check to correctly bypass the subject assignment check
-- for course-level quizzes (where course_id IS NOT NULL and subject_id IS NULL).
-- Without this, teachers get "Teacher not assigned to this subject" when creating
-- course-level test sets, even though they are legitimately assigned to the course.

CREATE OR REPLACE FUNCTION fn_quiz_teacher_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip check if creator is admin (role_id = 1)
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.created_by AND role_id = 1) THEN
    RETURN NEW;
  END IF;

  -- Skip subject check for course-level quizzes
  IF NEW.course_id IS NOT NULL AND NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Teacher must be assigned to the subject
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.created_by) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
