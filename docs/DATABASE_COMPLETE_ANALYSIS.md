# 🗄️ Complete Database Schema & Operations Analysis

**Document Version**: 1.0  
**Date**: April 9, 2026  
**Database**: PostgreSQL 13+  
**Application**: 10xAccel LMS Platform

---

## Table of Contents

1. [Overview](#overview)
2. [Domain 1: Identity & Authentication](#domain-1-identity--authentication)
3. [Domain 2: Courses & Subjects](#domain-2-courses--subjects)
4. [Domain 3: Content Management](#domain-3-content-management)
5. [Domain 4: Activity & Progress Tracking](#domain-4-activity--progress-tracking)
6. [Domain 5: Delivery & Sessions](#domain-5-delivery--sessions)
7. [Functions & Triggers](#functions--triggers)
8. [Indexes & Performance](#indexes--performance)
9. [Data Lifecycle Scenarios](#data-lifecycle-scenarios)
10. [Views & Reporting](#views--reporting)

---

## Overview

The 10xAccel LMS database is organized into **5 core domains**:

| Domain | Purpose | Key Tables |
|--------|---------|-----------|
| **Identity** | User management & authorization | `users`, `roles`, `user_roles` |
| **Courses** | Course structure & hierarchy | `courses`, `subjects`, `topics` |
| **Content** | Educational materials | `quizzes`, `questions`, `options`, `assignments`, `subject_materials` |
| **Activity** | Learning progress & submissions | `quiz_attempts`, `attempt_answers`, `assignment_submissions`, `student_progress` |
| **Delivery** | Sessions & content assignments | `sessions`, `session_recurrence`, `session_students`, `student_content_assignments` |

**Total Tables**: 28  
**Total Indexes**: 40+  
**Total Triggers**: 12  
**Total Functions**: 3

---

## Domain 1: Identity & Authentication

### 📌 Table: `roles`

**Purpose**: Define system-wide user role types  
**Primary Key**: `id` (SMALLINT)

| Column | Type | Notes |
|--------|------|-------|
| `id` | SMALLINT | PK (1=admin, 2=teacher, 3=student) |
| `name` | VARCHAR(20) | UNIQUE role name |
| `created_at` | TIMESTAMPTZ | Timestamp when role was created |

**Seeded Values**:
```
1 → 'admin'    (super users, full platform control)
2 → 'teacher'  (content creators & student managers)
3 → 'student'  (learners, quiz takers)
```

**Scenarios**:

| Scenario | SQL Operation | Triggered By |
|----------|---------------|--------------|
| **System initialization** | INSERT | Initial schema setup (seed.sql) |
| New role needed | INSERT | Platform upgrade (rare) |
| Role disabled | Not used (roles are fixed) | N/A |

---

### 📌 Table: `users`

**Purpose**: Core user account storage with authentication & metadata  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Globally unique user identifier |
| `email` | VARCHAR(150) | UNIQUE, NOT NULL | Login credential |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt hash (cost=12) |
| `first_name` | VARCHAR(100) | NOT NULL | User's first name |
| `last_name` | VARCHAR(100) | NOT NULL | User's last name |
| `phone` | VARCHAR(20) | - | Contact number |
| `avatar_url` | TEXT | - | Profile picture from CDN/storage |
| `description` | TEXT | - | Bio or user description |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Account active status |
| `is_super_admin` | BOOLEAN | NOT NULL, DEFAULT FALSE | Single super-admin flag |
| `last_login_at` | TIMESTAMPTZ | - | Last successful login timestamp |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Account creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last profile update date |

**Indexes**:
```sql
CREATE INDEX idx_users_email     ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE UNIQUE INDEX idx_single_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;
```

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin creates new teacher** | INSERT | Admin fills form → `users` row created with `is_active=TRUE`, `is_super_admin=FALSE`, password hashed |
| **Admin creates new student** | INSERT | Similar to teacher; typically uploaded via CSV bulk import |
| **User logs in** | UPDATE | `last_login_at` timestamp updated on successful authentication |
| **User updates profile** | UPDATE | Email, name, avatar, phone, or description changed; `updated_at` auto-updated by trigger |
| **User account suspended** | UPDATE | `is_active` set to FALSE (soft delete, data preserved) |
| **User account deleted** | DELETE | Hard delete cascades to all dependent records via ON DELETE CASCADE |
| **Admin account replaced** | UPDATE + INSERT | Revoke `is_super_admin=TRUE` from old admin, grant to new admin (unique index ensures only 1) |

---

### 📌 Table: `user_roles`

**Purpose**: Junction table mapping users to roles (supports multi-role users)  
**Primary Key**: `(user_id, role_id)` (Composite)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `user_id` | UUID | FK → users(id) ON DELETE CASCADE | User reference |
| `role_id` | SMALLINT | FK → roles(id) ON DELETE CASCADE | Role reference |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When role assigned |
| `assigned_by` | UUID | NOT NULL, FK → users(id) | Admin who assigned the role |

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Create teacher account** | INSERT | After user created → `user_roles` row with `(user_id, 2, assigned_by=admin_id)` |
| **Create student account** | INSERT | After user created → `user_roles` row with `(user_id, 3, assigned_by=admin_id)` |
| **User becomes admin** | INSERT | Rare; new row added: `(user_id, 1, assigned_by=super_admin_id)` |
| **Revoke teacher role** | DELETE | Remove the `(user_id, 2)` row; user may still be admin or student |
| **User deleted** | DELETE (CASCADE) | All role assignments auto-deleted |

**Business Rule**: A user typically has ONE primary role (student OR teacher OR admin), but the schema allows multi-role support.

---

## Domain 2: Courses & Subjects

### 📌 Table: `courses`

**Purpose**: Top-level grouping of academic content  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique course ID |
| `name` | VARCHAR(100) | UNIQUE, NOT NULL | Course name (e.g., "Mathematics 101") |
| `code` | VARCHAR(20) | UNIQUE, NOT NULL | Course code (e.g., "MATH101") |
| `description` | TEXT | - | Course overview & objectives |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Enable/disable course |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator (usually admin) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_courses
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin creates course** | INSERT | Admin enters name, code, description → new `courses` row |
| **Course activated** | UPDATE | `is_active` set to TRUE |
| **Course deactivated** | UPDATE | `is_active` set to FALSE (hides from students but preserves data) |
| **Update course description** | UPDATE | Description changed; `updated_at` auto-set |
| **Delete course** | DELETE | Cascades to: `subjects` → `topics`, `quizzes`, `assignments`, `sessions`, etc. |

---

### 📌 Table: `subjects`

**Purpose**: Sub-division within a course (e.g., "Algebra" within Math 101)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique subject ID |
| `course_id` | UUID | NOT NULL, FK → courses(id) ON DELETE CASCADE | Parent course |
| `name` | VARCHAR(150) | NOT NULL | Subject name |
| `code` | VARCHAR(30) | NOT NULL | Subject code |
| `description` | TEXT | - | Subject description |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Enable/disable subject |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |
| **UNIQUE** | - | (course_id, code) | Prevent duplicate codes per course |

**Indexes**:
```sql
CREATE INDEX idx_subjects_course ON subjects(course_id);
```

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_subjects
  BEFORE UPDATE ON subjects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Teacher creates subject** | INSERT | Teacher (usually admin) creates subject under course → new `subjects` row |
| **Assign teacher to subject** | INSERT → `subject_teachers` | See below |
| **Enroll student in subject** | INSERT → `subject_enrollments` | See below |
| **Update subject details** | UPDATE | Name, code, description changed |
| **Deactivate subject** | UPDATE | `is_active=FALSE` (students still see it if enrolled) |
| **Delete subject** | DELETE | Cascades to topics, quizzes, assignments, enrollments, sessions, etc. |

---

### 📌 Table: `topics`

**Purpose**: Granular learning units within a subject (e.g., "Linear Equations" in Algebra)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique topic ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Parent subject |
| `name` | VARCHAR(150) | NOT NULL | Topic name |
| `description` | TEXT | - | Topic details |
| `order_index` | SMALLINT | NOT NULL, DEFAULT 0 | Display order within subject |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Enable/disable topic |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |
| **UNIQUE** | - | (subject_id, name) | No duplicate topic names per subject |

**Indexes**:
```sql
CREATE INDEX idx_topics_subject ON topics(subject_id);
```

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_topics
  BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Teacher creates topic** | INSERT | Under subject → new `topics` row; `order_index` set for sequencing |
| **Reorder topics** | UPDATE | `order_index` modified; UI sorts by this field |
| **Add quiz to topic** | INSERT → `quizzes` | Quiz references `topic_id`; students see quiz under topic |
| **Add session to topic** | INSERT → `sessions` | Session references `topic_id` |
| **Associate questions to topic** | INSERT → `questions` | For analytics (which topics students struggle with) |
| **Disable topic** | UPDATE | `is_active=FALSE`; content still accessible to enrolled students |
| **Delete topic** | DELETE | Cascades to quizzes, assignments, sessions, materials tagged with topic |

---

### 📌 Table: `subject_teachers`

**Purpose**: Map teachers to subjects with permission levels  
**Primary Key**: `(subject_id, teacher_id)` (Composite)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `subject_id` | UUID | FK → subjects(id) ON DELETE CASCADE | Subject reference |
| `teacher_id` | UUID | FK → users(id) ON DELETE CASCADE | Teacher reference |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Assignment date |
| `assigned_by` | UUID | NOT NULL, FK → users(id) | Admin who assigned |
| `permission_level` | VARCHAR(10) | NOT NULL, DEFAULT 'read', CHECK ('read'\|'write') | Access level |

**Indexes**:
```sql
CREATE INDEX idx_subject_teachers_teacher ON subject_teachers(teacher_id);
CREATE INDEX idx_subject_teachers_subject ON subject_teachers(subject_id);
```

**Permission Levels**:
- **'read'**: View subject, quiz results, but cannot create content
- **'write'**: Full content creation (quizzes, assignments, sessions, materials)

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin assigns teacher to subject** | INSERT | Admin → teacher assigned with `permission_level='write'` (default) |
| **Restrict teacher to read-only** | INSERT or UPDATE | `permission_level='read'` (teacher cannot create content) |
| **Teacher creates quiz for subject** | INSERT → `quizzes` | `fn_quiz_teacher_check()` trigger verifies teacher is assigned to subject |
| **Teacher creates session for subject** | INSERT → `sessions` | `fn_session_teacher_check()` trigger verifies assignment |
| **Unassign teacher from subject** | DELETE | `subject_teachers` row deleted; teacher no longer sees subject data |

---

### 📌 Table: `subject_teacher_students`

**Purpose**: Track which students a specific teacher oversees within a subject  
**Primary Key**: `(subject_id, teacher_id, student_id)` (Composite)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `subject_id` | UUID | FK → subjects(id) ON DELETE CASCADE | Subject reference |
| `teacher_id` | UUID | FK → users(id) ON DELETE CASCADE | Teacher reference |
| `student_id` | UUID | FK → users(id) ON DELETE CASCADE | Student reference |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Assignment date |
| `assigned_by` | UUID | NOT NULL, FK → users(id) | Admin who assigned |

**Indexes**:
```sql
CREATE INDEX idx_sts_subject_teacher ON subject_teacher_students(subject_id, teacher_id);
CREATE INDEX idx_sts_student         ON subject_teacher_students(student_id);
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin assigns teacher to student group** | INSERT | Typically bulk import; admin → teacher sees specific students' progress |
| **Student joins class with teacher** | INSERT | Part of enrollment workflow |
| **Teacher grades student assignment** | No direct change | Teacher fetches via this table; updates `assignment_submissions` |
| **Unassign teacher from student** | DELETE | Teacher no longer sees student's detailed progress in that subject |

---

### 📌 Table: `subject_enrollments`

**Purpose**: Track student enrollment in subjects  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique enrollment ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject enrolled in |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student |
| `enrollment_status` | VARCHAR(20) | NOT NULL, DEFAULT 'active', CHECK ('active'\|'suspended'\|'completed') | Status |
| `enrolled_by` | UUID | NOT NULL, FK → users(id) | Admin who enrolled |
| `enrolled_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Enrollment date |
| **UNIQUE** | - | (subject_id, student_id) | One enrollment per student per subject |

**Indexes**:
```sql
CREATE INDEX idx_enrollments_student ON subject_enrollments(student_id);
CREATE INDEX idx_enrollments_subject ON subject_enrollments(subject_id);
CREATE INDEX idx_enrollments_status  ON subject_enrollments(enrollment_status);
```

**Enrollment States**:
- **'active'**: Student currently enrolled, can access content & take quizzes
- **'suspended'**: Student temporarily inactive (can be reactivated)
- **'completed'**: Course completed; read-only access

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin enrolls student in subject** | INSERT | CSV upload or manual form → `subject_enrollments` row with `status='active'` |
| **Student self-enrolls (if allowed)** | INSERT | Student requests → `subject_enrollments` created |
| **Student suspended from subject** | UPDATE | `enrollment_status='suspended'` (student cannot access content until reactivated) |
| **Student completes course** | UPDATE | `enrollment_status='completed'` (triggers completion certificate) |
| **Unenroll student** | DELETE | `subject_enrollments` row deleted; student cannot see subject |

---

## Domain 3: Content Management

### 📌 Table: `quizzes`

**Purpose**: Main quiz container; can be practice or test  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique quiz ID |
| `subject_id` | UUID | FK → subjects(id) ON DELETE CASCADE | Quiz's subject (NULL for course-level quizzes) |
| `course_id` | UUID | FK → courses(id) ON DELETE CASCADE | Quiz's course (for course-level quizzes not tied to subject) |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Associated topic (optional) |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator (teacher or admin) |
| `title` | VARCHAR(255) | NOT NULL | Quiz title |
| `quiz_type` | VARCHAR(20) | NOT NULL, CHECK ('test'\|'practice') | Type of quiz |
| `description` | TEXT | - | Quiz description |
| `duration_minutes` | SMALLINT | NOT NULL | Time limit in minutes |
| `passing_score` | NUMERIC(5,2) | - | Percentage needed to pass (e.g., 75.00) |
| `is_published` | BOOLEAN | NOT NULL, DEFAULT FALSE | Published status |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `available_from` | TIMESTAMPTZ | - | Availability start date |
| `available_until` | TIMESTAMPTZ | - | Availability end date |
| `max_attempts` | SMALLINT | - | Maximum attempts allowed (NULL = unlimited) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Indexes**:
```sql
CREATE INDEX idx_quizzes_subject   ON quizzes(subject_id);
CREATE INDEX idx_quizzes_type      ON quizzes(quiz_type);
CREATE INDEX idx_quizzes_published ON quizzes(is_published, available_from, available_until);
CREATE INDEX idx_quizzes_is_active ON quizzes(is_active);
```

**Triggers**:
```sql
CREATE TRIGGER trg_quiz_teacher_check
  BEFORE INSERT ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_quiz_teacher_check();
-- Validates: teacher must be assigned to subject (or be admin)

CREATE TRIGGER trg_updated_at_quizzes
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Quiz Types**:
- **'test'**: Graded, counted toward progress
- **'practice'**: Ungraded, for self-study

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Teacher creates quiz** | INSERT | Trigger `fn_quiz_teacher_check()` verifies teacher assigned to subject; `quiz_sets` created if needed; `questions` added later |
| **Edit quiz settings** | UPDATE | Change duration, passing_score, availability; `updated_at` auto-set |
| **Publish quiz** | UPDATE | `is_published=TRUE`; now visible to enrolled students |
| **Hide quiz** | UPDATE | `is_published=FALSE`; hidden from students (previous attempts preserved) |
| **Set availability window** | UPDATE | `available_from` and `available_until` set; outside window → quiz unavailable |
| **Limit attempts** | UPDATE | `max_attempts=3` (e.g.); tracked in `quiz_attempts` |
| **Student takes quiz** | INSERT → `quiz_attempts` | New attempt created; student answers questions |
| **Delete quiz** | DELETE | Cascades: `quiz_sets` → `questions` → `options` AND `quiz_attempts` → `attempt_answers` |

---

### 📌 Table: `quiz_sets`

**Purpose**: Organize questions into numbered sets within a quiz (optional)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique set ID |
| `quiz_id` | UUID | NOT NULL, FK → quizzes(id) ON DELETE CASCADE | Parent quiz |
| `set_number` | SMALLINT | NOT NULL | Set number (1, 2, 3, ...) |
| `title` | VARCHAR(100) | - | Set title (e.g., "Section A: Theory") |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| **UNIQUE** | - | (quiz_id, set_number) | One set per number per quiz |

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Teacher organizes quiz into sets** | INSERT | Quiz may have set 1, 2, 3; each with title |
| **Add questions to set** | INSERT → `questions` | Questions reference `set_id` for grouping |
| **View quiz by set** | SELECT | UI fetches questions grouped by `set_id` |
| **Delete set** | DELETE | Cascades to `questions` in set |

---

### 📌 Table: `questions`

**Purpose**: Individual quiz questions  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique question ID |
| `quiz_id` | UUID | NOT NULL, FK → quizzes(id) ON DELETE CASCADE | Parent quiz |
| `set_id` | UUID | FK → quiz_sets(id) ON DELETE CASCADE | Set within quiz (optional) |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Topic for analytics |
| `question_text` | TEXT | NOT NULL | Question content |
| `image_url` | TEXT | - | Question image (e.g., diagram) |
| `explanation` | TEXT | - | Detailed answer explanation |
| `explanation_image_url` | TEXT | - | Explanation image |
| `difficulty` | VARCHAR(10) | NOT NULL, DEFAULT 'medium', CHECK ('easy'\|'medium'\|'hard') | Difficulty level |
| `order_index` | SMALLINT | NOT NULL, DEFAULT 0 | Display order |
| `marks` | NUMERIC(4,2) | NOT NULL, DEFAULT 1.00 | Points awarded for correct answer |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Indexes**:
```sql
CREATE INDEX idx_questions_quiz  ON questions(quiz_id);
CREATE INDEX idx_questions_set   ON questions(set_id);
CREATE INDEX idx_questions_topic ON questions(topic_id);
```

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_questions
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Teacher adds question to quiz** | INSERT | Question stored; `order_index` auto-assigned; `marks` defaults to 1.00 |
| **Edit question text/image** | UPDATE | `updated_at` auto-set; existing student answers remain |
| **Reorder questions** | UPDATE | `order_index` modified; affects student UI display order |
| **Add explanation** | UPDATE | After quiz closes, explanation shown to students |
| **Adjust question marks** | UPDATE | Only affects NEW attempts; past attempt scores don't recalculate |
| **Student answers question** | INSERT → `attempt_answers` | Student's selected option logged with timestamp |
| **Delete question** | DELETE | Cascades: `options` deleted AND `attempt_answers` removed from all past attempts |

---

### 📌 Table: `options`

**Purpose**: Multiple-choice answer options (A, B, C, D)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique option ID |
| `question_id` | UUID | NOT NULL, FK → questions(id) ON DELETE CASCADE | Parent question |
| `option_label` | CHAR(1) | NOT NULL, CHECK ('A'\|'B'\|'C'\|'D') | Option label |
| `option_text` | TEXT | - | Option text content |
| `option_image_url` | TEXT | - | Option image (e.g., graph, diagram) |
| `is_correct` | BOOLEAN | NOT NULL, DEFAULT FALSE | Correct answer flag |
| **UNIQUE** | - | (question_id, option_label) | One A, B, C, D per question |

**Indexes**:
```sql
CREATE INDEX idx_options_question ON options(question_id);

-- UNIQUE INDEX: Exactly one correct answer per question
CREATE UNIQUE INDEX idx_one_correct_per_question
  ON options(question_id) WHERE is_correct = TRUE;
```

**The `idx_one_correct_per_question` Index** ensures database-level integrity: **only 1 option per question can have `is_correct=TRUE`**.

**Scenarios**:

| Scenario | Operation | Validation |
|----------|-----------|-----------|
| **Teacher creates 4 options for question** | INSERT × 4 | One INSERT per option; labels must be A, B, C, D (can skip one) |
| **Mark correct answer** | INSERT or UPDATE `is_correct=TRUE` | Unique index prevents multiple correct answers |
| **Student selects option** | INSERT → `attempt_answers` | Selected option ID recorded |
| **Auto-grade attempt** | SELECT then UPDATE → `attempt_answers.is_correct` | Compare student's `selected_option_id` with `options.is_correct` |
| **Modify option text** | UPDATE | Existing student answers reference option ID, not text; text changes don't affect grading |
| **Delete option** | DELETE | Cascades to `attempt_answers`; student answers that selected this option removed |

---

### 📌 Table: `quiz_write_permissions`

**Purpose**: Per-quiz write access for teachers (separate from subject-level permissions)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique permission ID |
| `quiz_id` | UUID | NOT NULL, FK → quizzes(id) ON DELETE CASCADE | Quiz reference |
| `teacher_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Teacher reference |
| `granted_by` | UUID | NOT NULL, FK → users(id) | Admin who granted permission |
| `granted_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Grant date |
| **UNIQUE** | - | (quiz_id, teacher_id) | One grant per teacher per quiz |

**Indexes**:
```sql
CREATE INDEX idx_qwp_quiz_id    ON quiz_write_permissions(quiz_id);
CREATE INDEX idx_qwp_teacher_id ON quiz_write_permissions(teacher_id);
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Admin grants teacher write access to specific quiz** | INSERT | Admin → teacher can now add/edit questions even if not subject-assigned |
| **Teacher not assigned to subject, but granted quiz write** | INSERT | `quiz_write_permissions` created; teacher sees only this quiz (via permission) |
| **Revoke teacher's quiz write access** | DELETE | Teacher can no longer modify the quiz |

---

### 📌 Table: `assignments`

**Purpose**: Assignment tasks for students (essays, projects, etc.)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique assignment ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject assignment belongs to |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Related topic |
| `created_by` | UUID | NOT NULL, FK → users(id) | Creator (teacher) |
| `title` | VARCHAR(255) | NOT NULL | Assignment title |
| `description` | TEXT | - | Detailed instructions |
| `due_date` | TIMESTAMPTZ | - | Legacy field (use `duration_days` instead) |
| `duration_days` | INTEGER | - | Days from creation until due (e.g., 7 days) |
| `max_marks` | NUMERIC(6,2) | NOT NULL, DEFAULT 100 | Total points |
| `is_published` | BOOLEAN | NOT NULL, DEFAULT FALSE | Published status |
| `attachment_url` | TEXT | - | Resources/rubric file |
| `assigned_to` | UUID | FK → users(id) ON DELETE SET NULL | Specific student (NULL = all enrolled) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_assignments
  BEFORE UPDATE ON assignments
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Indexes**:
```sql
CREATE INDEX idx_assignments_subject ON assignments(subject_id);
```

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Teacher creates assignment** | INSERT | `is_published=FALSE` initially; deadline = `now() + duration_days` |
| **Teacher publishes assignment** | UPDATE | `is_published=TRUE`; students see it |
| **Target assignment to specific student** | UPDATE `assigned_to` | Only that student receives assignment |
| **Broadcast to all enrolled students** | UPDATE `assigned_to=NULL` | All students in `subject_enrollments` see it |
| **Student views assignment** | SELECT | Student sees via `subject_enrollments` + `assignments` |
| **Student submits assignment** | INSERT → `assignment_submissions` | New submission with status 'pending' |
| **Teacher grades submission** | UPDATE → `assignment_submissions` | Set `marks_awarded`, `feedback`, `graded_at`, `status='graded'` |
| **Check if late** | SELECT | Compare `submitted_at` vs assignment `due_date`; set `is_late=TRUE` if past |
| **Delete assignment** | DELETE | Cascades to `assignment_submissions` |

---

### 📌 Table: `subject_materials`

**Purpose**: Study materials (PDFs, videos, documents, links)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique material ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject reference |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Associated topic |
| `uploaded_by` | UUID | NOT NULL, FK → users(id) | Uploader (teacher) |
| `title` | VARCHAR(255) | NOT NULL | Material title |
| `description` | TEXT | - | Description |
| `material_type` | VARCHAR(20) | NOT NULL, CHECK ('pdf'\|'video'\|'link'\|'doc'\|'image') | Type of material |
| `file_url` | TEXT | NOT NULL | CDN/storage URL |
| `file_size_kb` | INTEGER | - | File size in KB |
| `order_index` | SMALLINT | NOT NULL, DEFAULT 0 | Display order within subject/topic |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `is_published` | BOOLEAN | NOT NULL, DEFAULT FALSE | Published status |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |

**Indexes**:
```sql
CREATE INDEX idx_materials_subject ON subject_materials(subject_id, order_index);
```

**Triggers**:
```sql
CREATE TRIGGER trg_updated_at_subject_materials
  BEFORE UPDATE ON subject_materials
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Teacher uploads PDF** | INSERT | `material_type='pdf'`, `is_published=FALSE` initially |
| **Publish material** | UPDATE | `is_published=TRUE`; students in subject see it |
| **Hide material** | UPDATE | `is_published=FALSE` |
| **Reorder materials** | UPDATE | `order_index` changed; UI sorts by this |
| **Student views material list** | SELECT | Filter by `is_published=TRUE` and `is_active=TRUE` |
| **Delete material** | DELETE | File should be deleted from CDN separately (not auto-deleted) |

---

## Domain 4: Activity & Progress Tracking

### 📌 Table: `quiz_attempts`

**Purpose**: Student quiz attempt tracking  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique attempt ID |
| `quiz_id` | UUID | NOT NULL, FK → quizzes(id) ON DELETE CASCADE | Quiz reference |
| `set_id` | UUID | FK → quiz_sets(id) | Current set (optional) |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student reference |
| `attempt_number` | SMALLINT | NOT NULL, DEFAULT 1 | Attempt count (1st, 2nd, etc.) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'in_progress', CHECK ('in_progress'\|'partial'\|'submitted'\|'timed_out'\|'abandoned') | Status |
| `started_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Start timestamp |
| `submitted_at` | TIMESTAMPTZ | - | Submission timestamp (NULL = not submitted) |
| `time_taken_seconds` | INTEGER | - | Total time taken |
| `marks_obtained` | NUMERIC(7,2) | - | Score earned (only when submitted) |
| `total_marks` | NUMERIC(7,2) | - | Total possible marks |
| `score_pct` | NUMERIC(5,2) | - | Percentage score |
| `is_passed` | BOOLEAN | - | Pass/fail based on `passing_score` |
| `ip_address` | INET | - | Student's IP address (for proctoring) |
| `last_question_index` | INTEGER | NOT NULL, DEFAULT 0 | Last answered question (for resume) |
| **UNIQUE** | - | (quiz_id, student_id, attempt_number) | Only one attempt per student per attempt number |

**Indexes**:
```sql
CREATE INDEX idx_attempts_student    ON quiz_attempts(student_id);
CREATE INDEX idx_attempts_quiz       ON quiz_attempts(quiz_id);
CREATE INDEX idx_attempts_status     ON quiz_attempts(status);
CREATE INDEX idx_attempts_started    ON quiz_attempts(started_at);
```

**Attempt Statuses**:
- **'in_progress'**: Student is actively taking quiz
- **'partial'**: Student saved progress but hasn't submitted
- **'submitted'**: Quiz completed and submitted for grading
- **'timed_out'**: Time limit exceeded; auto-submitted
- **'abandoned'**: Student left without submitting

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Student starts quiz** | INSERT | New row: `status='in_progress'`, `started_at=now()`, `last_question_index=0` |
| **Student pauses & resumes** | UPDATE `last_question_index` | Student's current position saved |
| **Student answers questions** | INSERT → `attempt_answers` | Each answer logged separately |
| **Student submits quiz** | UPDATE | `status='submitted'`, `submitted_at=now()`, scores calculated |
| **Auto-grade quiz** | UPDATE | `marks_obtained`, `total_marks`, `score_pct`, `is_passed` computed from `attempt_answers` |
| **Time limit exceeded** | UPDATE | `status='timed_out'`, auto-submit and grade |
| **Student abandons quiz** | UPDATE | `status='abandoned'`, partial progress preserved |
| **Student retakes quiz** | INSERT | New row with `attempt_number=2` (if allowed by `max_attempts`) |
| **View attempt history** | SELECT all rows | Student/teacher sees all attempts sorted by `attempt_number` |
| **Delete quiz** | DELETE (CASCADE) | All related `quiz_attempts` deleted |

---

### 📌 Table: `attempt_answers`

**Purpose**: Individual question answers within an attempt  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique answer ID |
| `attempt_id` | UUID | NOT NULL, FK → quiz_attempts(id) ON DELETE CASCADE | Parent attempt |
| `question_id` | UUID | NOT NULL, FK → questions(id) ON DELETE CASCADE | Question reference |
| `selected_option_id` | UUID | FK → options(id) | Selected answer (NULL = unanswered) |
| `is_correct` | BOOLEAN | - | Correct/incorrect flag (NULL = unanswered) |
| `marks_awarded` | NUMERIC(4,2) | - | Points given (0 if wrong, full if correct) |
| `time_spent_seconds` | INTEGER | - | Time spent on this question |
| `answered_at` | TIMESTAMPTZ | - | Timestamp of answer |
| **UNIQUE** | - | (attempt_id, question_id) | One answer per question per attempt |

**Indexes**:
```sql
CREATE INDEX idx_answers_attempt ON attempt_answers(attempt_id);
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Student selects an option** | INSERT | `selected_option_id` set, `answered_at=now()`, `time_spent_seconds` calculated |
| **Student changes answer** | UPDATE | `selected_option_id` updated to new option |
| **Auto-grade answer** | UPDATE | `is_correct` set by comparing `selected_option_id` with correct option; `marks_awarded` calculated |
| **Student skips question** | No INSERT | `attempt_answers` row doesn't exist for skipped Q |
| **View quiz results** | SELECT with JOIN to `options` | Show student's answers + correct answers + explanations |
| **Analytics: question difficulty** | SELECT COUNT | How many students got this question right/wrong |
| **Delete question** | DELETE (CASCADE) | All answer records for this question deleted |

---

### 📌 Table: `assignment_submissions`

**Purpose**: Student assignment submission tracking & grading  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique submission ID |
| `assignment_id` | UUID | NOT NULL, FK → assignments(id) ON DELETE CASCADE | Assignment reference |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student reference |
| `submission_url` | TEXT | - | Link to submitted work (document, project, etc.) |
| `notes` | TEXT | - | Student's notes on submission |
| `submitted_at` | TIMESTAMPTZ | - | Submission timestamp (NULL = not submitted) |
| `is_late` | BOOLEAN | NOT NULL, DEFAULT FALSE | Late submission flag |
| `marks_awarded` | NUMERIC(6,2) | - | Grade given by teacher (NULL = not graded) |
| `feedback` | TEXT | - | Teacher feedback text |
| `feedback_file_url` | TEXT | - | Teacher feedback file (e.g., marked PDF) |
| `graded_by` | UUID | FK → users(id) | Teacher who graded |
| `graded_at` | TIMESTAMPTZ | - | Grading timestamp |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'pending', CHECK ('pending'\|'submitted'\|'graded'\|'returned') | Status |
| **UNIQUE** | - | (assignment_id, student_id) | One submission per student per assignment |

**Indexes**:
```sql
CREATE INDEX idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX idx_submissions_student    ON assignment_submissions(student_id);
```

**Submission Statuses**:
- **'pending'**: Assignment created, not yet submitted by student
- **'submitted'**: Student submitted; waiting for teacher feedback
- **'graded'**: Teacher graded and provided score
- **'returned'**: Returned for revision with feedback

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Assignment published** | INSERT → `student_content_assignments` (or visible via enrollment) | All enrolled students see it |
| **Student submits assignment** | INSERT or UPDATE → `assignment_submissions` | `submission_url` set, `submitted_at=now()`, `status='submitted'` |
| **Check if late** | Business logic | Compare `submitted_at` vs assignment `due_date` → set `is_late=TRUE` |
| **Teacher views submissions** | SELECT | Filter by `assignment_id`, sort by `submitted_at` |
| **Teacher grades submission** | UPDATE | Set `marks_awarded`, `feedback`, `feedback_file_url`, `graded_by`, `graded_at`, `status='graded'` |
| **Return for revision** | UPDATE | `status='returned'`, feedback provided; student may re-submit |
| **Student sees grade** | SELECT | Fetch by `assignment_id` + `student_id` |
| **Delete assignment** | DELETE (CASCADE) | All submissions deleted |

---

### 📌 Table: `student_progress`

**Purpose**: Aggregated learning metrics per student per subject (denormalized for performance)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique progress record ID |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student reference |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject reference |
| `quizzes_attempted` | INTEGER | NOT NULL, DEFAULT 0 | Total quizzes taken |
| `quizzes_passed` | INTEGER | NOT NULL, DEFAULT 0 | Quizzes passed |
| `avg_score_pct` | NUMERIC(5,2) | - | Average quiz score percentage |
| `best_score_pct` | NUMERIC(5,2) | - | Highest quiz score |
| `total_time_spent_mins` | INTEGER | NOT NULL, DEFAULT 0 | Total study time in minutes |
| `assignments_submitted` | INTEGER | NOT NULL, DEFAULT 0 | Assignments submitted |
| `assignments_graded` | INTEGER | NOT NULL, DEFAULT 0 | Assignments graded |
| `avg_assignment_marks` | NUMERIC(6,2) | - | Average assignment score |
| `sessions_attended` | INTEGER | NOT NULL, DEFAULT 0 | Live sessions attended |
| `last_activity_at` | TIMESTAMPTZ | - | Timestamp of last activity |
| `computed_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When metrics were computed |
| **UNIQUE** | - | (student_id, subject_id) | One progress record per student per subject |

**Indexes**:
```sql
CREATE INDEX idx_progress_student ON student_progress(student_id);
CREATE INDEX idx_progress_subject ON student_progress(subject_id);
```

**Data Computation**:

This table is **denormalized** for fast dashboard queries. Values are computed via application logic or periodic jobs:

```sql
-- Conceptual computation (from schema comments):
SELECT
  qa.student_id,
  q.subject_id,
  COUNT(*)                             AS quizzes_attempted,
  COUNT(*) FILTER (WHERE qa.is_passed) AS quizzes_passed,
  AVG(qa.score_pct)                    AS avg_score_pct,
  MAX(qa.score_pct)                    AS best_score_pct,
  COALESCE(SUM(qa.time_taken_seconds)/60, 0) AS total_time_spent_mins,
  now()                                AS computed_at
FROM quiz_attempts qa
JOIN quizzes q ON q.id = qa.quiz_id
WHERE qa.status = 'submitted'
GROUP BY qa.student_id, q.subject_id;
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Student submits quiz** | UPDATE or INSERT | Application code recomputes progress metrics for this student/subject |
| **Student submits assignment** | UPDATE or INSERT | `assignments_submitted` incremented; `avg_assignment_marks` recalculated |
| **Teacher grades assignment** | UPDATE | `assignments_graded` incremented; `avg_assignment_marks` updated |
| **View student dashboard** | SELECT | Dashboard fetches `student_progress` for fast display (no JOIN to 100s of attempts) |
| **Analytics query** | SELECT | Generate reports from this denormalized view for performance |
| **Periodic refresh** | Scheduled job (pg_cron) | Run every 15 mins to sync with source tables |

**⚠️ WARNING**: This is a denormalized table. Keep it in sync with source tables (`quiz_attempts`, `assignment_submissions`). A scheduled job (commented in schema.sql) should refresh this periodically.

---

## Domain 5: Delivery & Sessions

### 📌 Table: `session_recurrence`

**Purpose**: Store recurrence patterns for recurring sessions  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique recurrence pattern ID |
| `pattern` | VARCHAR(20) | NOT NULL, CHECK ('daily'\|'weekly'\|'monthly') | Recurrence pattern |
| `interval_value` | SMALLINT | NOT NULL, DEFAULT 1 | Repeat every N intervals (1=every day, 2=every 2 days) |
| `days_of_week` | SMALLINT[] | - | Days for weekly pattern (0=Sun, 1=Mon, ..., 6=Sat) |
| `recur_until` | DATE | - | Last day of recurrence (NULL = no end date) |
| `max_occurrences` | SMALLINT | - | Max number of occurrences (NULL = unlimited) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Create weekly session (every Monday, Wednesday, Friday)** | INSERT | `pattern='weekly'`, `interval_value=1`, `days_of_week=ARRAY[1,3,5]` |
| **Create daily session for 2 weeks** | INSERT | `pattern='daily'`, `recur_until='2026-04-23'` |
| **Create monthly session** | INSERT | `pattern='monthly'`, `interval_value=1` |
| **No recurrence** | No row created | Session has `is_recurring=FALSE`, `recurrence_id=NULL` |

---

### 📌 Table: `sessions`

**Purpose**: Live or recorded class sessions  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique session ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject reference |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Associated topic |
| `teacher_id` | UUID | NOT NULL, FK → users(id) | Session conductor |
| `title` | VARCHAR(255) | NOT NULL | Session title |
| `description` | TEXT | - | Session description |
| `session_date` | DATE | NOT NULL | Date of session |
| `start_time` | TIMETZ | NOT NULL | Start time (timezone-aware) |
| `end_time` | TIMETZ | NOT NULL | End time |
| `timezone` | VARCHAR(50) | NOT NULL, DEFAULT 'Asia/Kolkata' | Timezone for time conversion |
| `meeting_link` | TEXT | - | Generic meeting URL (Zoom, Teams, etc.) |
| `meeting_password` | VARCHAR(100) | - | Meeting password if required |
| `zoom_meeting_id` | VARCHAR(100) | - | Zoom-specific meeting ID |
| `zoom_start_url` | TEXT | - | Zoom instant-start URL (for teacher) |
| `zoom_host_email` | VARCHAR(255) | - | Zoom host email |
| `recording_url` | TEXT | - | Recording link (set after session) |
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'scheduled', CHECK ('scheduled'\|'live'\|'completed'\|'cancelled'\|'missed') | Status |
| `is_recurring` | BOOLEAN | NOT NULL, DEFAULT FALSE | Recurring session flag |
| `recurrence_id` | UUID | FK → session_recurrence(id) | Recurrence pattern reference |
| `notes` | TEXT | - | Session notes |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation date |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update |
| **CONSTRAINT** | - | end_time > start_time | Logical validation |

**Indexes**:
```sql
CREATE INDEX idx_sessions_subject  ON sessions(subject_id);
CREATE INDEX idx_sessions_date     ON sessions(session_date);
CREATE INDEX idx_sessions_teacher  ON sessions(teacher_id, session_date, status);
CREATE INDEX idx_sessions_status   ON sessions(status);
CREATE INDEX idx_sessions_zoom_id  ON sessions(zoom_meeting_id);
```

**Triggers**:
```sql
CREATE TRIGGER trg_session_teacher_check
  BEFORE INSERT ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_session_teacher_check();
-- Validates: teacher must be assigned to subject

CREATE TRIGGER trg_cleanup_orphan_session_recurrence
  AFTER DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_cleanup_orphan_session_recurrence();
-- Cleans up orphan recurrence rows when last session deleted

CREATE TRIGGER trg_updated_at_sessions
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Session Statuses**:
- **'scheduled'**: Upcoming session
- **'live'**: Currently ongoing
- **'completed'**: Session finished successfully
- **'cancelled'**: Cancelled by teacher
- **'missed'**: Session time passed but not marked completed

**Scenarios**:

| Scenario | Operation | Cascading Effects |
|----------|-----------|-------------------|
| **Teacher schedules session** | INSERT | Trigger validates teacher is assigned to subject; `status='scheduled'` |
| **Set up recurring session** | INSERT + INSERT → `session_recurrence` | `is_recurring=TRUE`, `recurrence_id` points to pattern; application generates multiple `sessions` rows (one per date) |
| **Zoom integration** | INSERT/UPDATE | `zoom_meeting_id`, `zoom_start_url`, `zoom_host_email` populated |
| **Add generic meeting link** | INSERT/UPDATE | `meeting_link` set; students access via this link |
| **Target session to specific students** | INSERT → `session_students` | Session visible only to these students (not all enrolled) |
| **Session goes live** | UPDATE | `status='live'` (triggered by time gate or manual) |
| **Session ends** | UPDATE | `status='completed'`, optionally `recording_url` set |
| **Teacher cancels session** | UPDATE | `status='cancelled'`; students notified |
| **Session time passes (not marked completed)** | Scheduled job | `status='missed'` |
| **Delete session** | DELETE | Cascades: `session_students` deleted, orphan `session_recurrence` row cleaned |

---

### 📌 Table: `session_students`

**Purpose**: Track specific students assigned to a session (for 1-on-1 or small group sessions)  
**Primary Key**: `(session_id, student_id)` (Composite)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `session_id` | UUID | FK → sessions(id) ON DELETE CASCADE | Session reference |
| `student_id` | UUID | FK → users(id) ON DELETE CASCADE | Student reference |

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Teacher schedules 1-on-1 session with student** | INSERT → `session_students` | Only this student sees the session |
| **Teacher schedules small group session** | INSERT × N | Multiple rows for multiple students |
| **Open session (no specific students)** | No rows | All enrolled students see it |
| **Student dropped from session** | DELETE | Student no longer sees session |

---

### 📌 Table: `student_content_assignments`

**Purpose**: Teacher-to-student delegated content assignments (quiz, assignment, or material)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique assignment ID |
| `subject_id` | UUID | FK → subjects(id) ON DELETE CASCADE | Subject (nullable for course-level content) |
| `course_id` | UUID | FK → courses(id) ON DELETE CASCADE | Course (for course-level assignments) |
| `content_type` | VARCHAR(20) | NOT NULL, CHECK ('quiz'\|'assignment'\|'material') | Type of content |
| `content_id` | UUID | NOT NULL | ID of actual content (quiz_id, assignment_id, or material_id) |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student assigned to |
| `assigned_by` | UUID | NOT NULL, FK → users(id) | Teacher/admin who assigned |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Assignment date |
| `due_date` | TIMESTAMPTZ | - | Per-student deadline (auto-calculated from assignment duration) |
| **UNIQUE** | - | (content_type, content_id, student_id) | One assignment per student per content |

**Indexes**:
```sql
CREATE INDEX idx_sca_student  ON student_content_assignments(student_id);
CREATE INDEX idx_sca_content  ON student_content_assignments(content_type, content_id);
CREATE INDEX idx_sca_subject  ON student_content_assignments(subject_id);
CREATE INDEX idx_sca_course   ON student_content_assignments(course_id);
CREATE INDEX idx_sca_assigner ON student_content_assignments(assigned_by);
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Teacher assigns specific quiz to student** | INSERT | `content_type='quiz'`, `content_id=<quiz_id>`, `student_id=<target>`, `due_date=<calculated>` |
| **Teacher assigns assignment to student** | INSERT | `content_type='assignment'`, `due_date` calculated from assignment `duration_days` |
| **Teacher assigns material to student** | INSERT | `content_type='material'` |
| **Student views assigned content** | SELECT | Fetch all `student_content_assignments` where `student_id=<user>` and due_date not passed |
| **Multiple students assigned same content** | INSERT × N | One row per student |
| **Broadcast content (no specific assignment)** | No row in this table | Content visible via `subject_enrollments` + `is_published=TRUE` |
| **Revoke assignment** | DELETE | Remove student's access to that specific content |

---

### 📌 Table: `student_uploads`

**Purpose**: Student-created file uploads (projects, reports, portfolios)  
**Primary Key**: `id` (UUID)

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | UUID | PK | Unique upload ID |
| `subject_id` | UUID | NOT NULL, FK → subjects(id) ON DELETE CASCADE | Subject for upload |
| `student_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | Student uploader |
| `teacher_id` | UUID | FK → users(id) ON DELETE SET NULL | Assigned teacher (optional) |
| `topic_id` | UUID | FK → topics(id) ON DELETE SET NULL | Related topic |
| `title` | VARCHAR(255) | NOT NULL | Upload title |
| `description` | TEXT | - | Description |
| `file_url` | TEXT | NOT NULL | CDN/storage URL |
| `file_name` | VARCHAR(255) | - | Original filename |
| `feedback_text` | TEXT | - | Teacher feedback |
| `feedback_file_url` | TEXT | - | Teacher's marked/annotated file |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Upload date |

**Indexes**:
```sql
CREATE INDEX idx_student_uploads_subject ON student_uploads(subject_id);
CREATE INDEX idx_student_uploads_student ON student_uploads(student_id);
CREATE INDEX idx_student_uploads_teacher ON student_uploads(teacher_id);
CREATE INDEX idx_student_uploads_topic   ON student_uploads(topic_id);
```

**Scenarios**:

| Scenario | Operation | Details |
|----------|-----------|---------|
| **Student uploads project/assignment** | INSERT | `title`, `file_url`, `description` set; `feedback_text=NULL` initially |
| **Teacher views student uploads** | SELECT | Filter by `subject_id` + `teacher_id` |
| **Teacher provides feedback** | UPDATE | Set `feedback_text` and/or `feedback_file_url` |
| **Student views feedback** | SELECT | Fetch own uploads with teacher's feedback |

---

## Functions & Triggers

### 🔧 Function: `fn_set_updated_at()`

```sql
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Purpose**: Auto-update `updated_at` timestamp on any table modification.

**Used By**: 12 triggers across tables: `users`, `courses`, `subjects`, `topics`, `quizzes`, `questions`, `sessions`, `assignments`, `subject_materials`

**Behavior**: Before any UPDATE, set `updated_at = NOW()` automatically.

---

### 🔧 Function: `fn_quiz_teacher_check()`

```sql
CREATE OR REPLACE FUNCTION fn_quiz_teacher_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Admins bypass all checks
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.created_by AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  -- Course-level quizzes don't belong to a subject — skip subject check
  IF NEW.course_id IS NOT NULL AND NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- Subject-level: teacher must be assigned to the subject
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.created_by) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Purpose**: Enforce authorization: only teachers assigned to a subject (or admins) can create quizzes for that subject.

**Trigger**: `trg_quiz_teacher_check` (BEFORE INSERT on quizzes)

**Logic**:
1. If creator is admin → allow
2. If quiz is course-level (subject_id IS NULL) → allow
3. If quiz is subject-level → check `subject_teachers` record exists; if not, raise exception

---

### 🔧 Function: `fn_session_teacher_check()`

```sql
CREATE OR REPLACE FUNCTION fn_session_teacher_check()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles
             WHERE user_id = NEW.teacher_id AND role_id = 1) THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subject_teachers
                 WHERE subject_id = NEW.subject_id
                 AND teacher_id = NEW.teacher_id) THEN
    RAISE EXCEPTION 'Teacher not assigned to this subject';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Purpose**: Similar to `fn_quiz_teacher_check()` but for sessions.

**Trigger**: `trg_session_teacher_check` (BEFORE INSERT on sessions)

**Logic**: Ensure teacher scheduling a session is assigned to the subject (admins bypass).

---

### 🔧 Function: `fn_cleanup_orphan_session_recurrence()`

```sql
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
```

**Purpose**: Clean up orphan `session_recurrence` rows when the last session using that pattern is deleted.

**Trigger**: `trg_cleanup_orphan_session_recurrence` (AFTER DELETE on sessions)

**Logic**: After deleting a session, if it had a `recurrence_id`, check if any other sessions still use that pattern. If not, delete the orphan pattern row.

---

### 📌 Summary of All Triggers

| Trigger | Table | Event | Function | Purpose |
|---------|-------|-------|----------|---------|
| `trg_updated_at_users` | users | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_courses` | courses | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_subjects` | subjects | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_topics` | topics | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_quizzes` | quizzes | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_questions` | questions | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_sessions` | sessions | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_assignments` | assignments | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_updated_at_subject_materials` | subject_materials | BEFORE UPDATE | `fn_set_updated_at()` | Auto-set `updated_at` |
| `trg_quiz_teacher_check` | quizzes | BEFORE INSERT | `fn_quiz_teacher_check()` | Enforce subject assignment |
| `trg_session_teacher_check` | sessions | BEFORE INSERT | `fn_session_teacher_check()` | Enforce subject assignment |
| `trg_cleanup_orphan_session_recurrence` | sessions | AFTER DELETE | `fn_cleanup_orphan_session_recurrence()` | Clean orphan patterns |

---

## Indexes & Performance

### Primary Key Indexes (Auto-Created)

Every table with a UUID PK automatically has a B-tree index on `id`.

### Critical Business Indexes

| Index | Table | Columns | Use Case |
|-------|-------|---------|----------|
| `idx_users_email` | users | email | Login lookups (WHERE email = ...) |
| `idx_users_is_active` | users | is_active | Filter active accounts |
| `idx_single_super_admin` | users | is_super_admin (PARTIAL) | Enforce exactly 1 super admin |
| `idx_enrollments_student` | subject_enrollments | student_id | Find all subjects a student is in |
| `idx_enrollments_subject` | subject_enrollments | subject_id | Find all students in a subject |
| `idx_attempts_student` | quiz_attempts | student_id | Student's quiz history |
| `idx_attempts_quiz` | quiz_attempts | quiz_id | All attempts on a quiz |
| `idx_attempts_status` | quiz_attempts | status | Find in-progress quizzes |
| `idx_submissions_student` | assignment_submissions | student_id | Student's submissions |
| `idx_sessions_date` | sessions | session_date | List sessions by date |
| `idx_sessions_teacher` | sessions | (teacher_id, session_date, status) | Teacher's sessions today |
| `idx_sessions_status` | sessions | status | Find live/scheduled sessions |
| `idx_quizzes_published` | quizzes | (is_published, available_from, available_until) | Student-facing quiz list |
| `idx_materials_subject` | subject_materials | (subject_id, order_index) | Ordered material list |
| `idx_one_correct_per_question` | options | (question_id) WHERE is_correct=TRUE | Enforce 1 correct answer |

### Partial Indexes

**`idx_single_super_admin`** and **`idx_one_correct_per_question`** are **partial indexes** (with WHERE clause):

- Only index rows matching the condition
- Smaller index size
- Faster inserts (only index matching rows)
- Database enforces constraint at index creation time

---

## Data Lifecycle Scenarios

### Scenario 1: Admin Creates a New Student Account

**Sequence**:

```
1. Admin clicks "Add Student"
2. Admin fills form:
   - Email: student@example.com
   - Password: SecurePass123
   - Name: John Doe
   - Phone: 9876543210
3. Backend hashes password with bcrypt (cost=12)
4. INSERT INTO users (email, password_hash, first_name, last_name, phone, ...)
5. GET user.id (UUID)
6. INSERT INTO user_roles (user_id, role_id=3, assigned_by=admin_id)
7. Response: "Student created successfully"
```

**Affected Tables**: `users`, `user_roles`

**Affected Rows**:
- 1 new row in `users`
- 1 new row in `user_roles`

---

### Scenario 2: Teacher Creates a Quiz & Adds Questions

**Sequence**:

```
1. Teacher navigates to Subject > Create Quiz
2. Fills form:
   - Title: "Quadratic Equations Quiz"
   - Duration: 30 minutes
   - Passing Score: 75%
   - Quiz Type: test
3. Backend checks: fn_quiz_teacher_check()
   - Is teacher assigned to this subject? (in subject_teachers) ✓
4. INSERT INTO quizzes (subject_id, created_by, title, duration_minutes, ...)
5. GET quiz.id (UUID)
6. Teacher adds Question 1:
   - Text: "What is x in x²=4?"
   - Image: [diagram_url]
   - Marks: 2
7. INSERT INTO questions (quiz_id, question_text, image_url, marks, ...)
8. GET question.id (UUID)
9. Add 4 options:
   - Option A: "x = 2"          (is_correct=FALSE)
   - Option B: "x = ±2"         (is_correct=TRUE) ← idx_one_correct_per_question ensures only 1
   - Option C: "x = -2"         (is_correct=FALSE)
   - Option D: "No solution"    (is_correct=FALSE)
10. INSERT INTO options (question_id, option_label, option_text, is_correct) × 4
11. Repeat for Question 2, 3, ... N
12. Teacher publishes quiz:
    - UPDATE quizzes SET is_published=TRUE
    - Trigger: updated_at auto-set
13. Quiz now visible to students
```

**Affected Tables**: `quizzes`, `questions`, `options`, triggers update `updated_at`

**Affected Rows**:
- 1 new row in `quizzes`
- N new rows in `questions`
- 4×N new rows in `options`
- 1 update to `quizzes` (publish)

---

### Scenario 3: Student Takes a Quiz

**Sequence**:

```
1. Student sees quiz in "Assigned Quizzes" (via subject_enrollments + quizzes.is_published)
2. Student clicks "Start Quiz"
3. Backend checks:
   - Is available_from <= now() <= available_until? ✓
   - Has student exceeded max_attempts? ✓
4. INSERT INTO quiz_attempts (quiz_id, student_id, status='in_progress', started_at=now())
5. GET attempt.id (UUID)
6. Frontend: load questions for this quiz
   - SELECT questions WHERE quiz_id = ?
7. Student answers Question 1:
   - Selects Option B (correct)
   - Spends 45 seconds
8. Frontend records answer (client-side or periodic sync)
9. Student submits quiz
10. Backend: INSERT into attempt_answers
    - attempt_id, question_id, selected_option_id, answered_at, time_spent_seconds
    - For each Q answered
11. Backend: Auto-grade
    - For each attempt_answer:
      - COMPARE selected_option_id with options.is_correct
      - SET is_correct = (selected_option.is_correct == TRUE)
      - SET marks_awarded = (is_correct ? marks : 0)
12. Backend: Aggregate scores
    - total_marks = SUM(questions.marks)
    - marks_obtained = SUM(attempt_answers.marks_awarded)
    - score_pct = (marks_obtained / total_marks) * 100
    - is_passed = (score_pct >= quizzes.passing_score)
13. UPDATE quiz_attempts SET (status='submitted', submitted_at=now(), 
    marks_obtained, total_marks, score_pct, is_passed, time_taken_seconds)
14. Trigger: updated_at auto-set (if exists)
15. Backend: Update student_progress
    - SELECT COUNT(*) FROM quiz_attempts WHERE student_id=? AND quiz_id IN (subject)
    - Aggregate: quizzes_attempted, quizzes_passed, avg_score_pct, best_score_pct
    - INSERT or UPDATE student_progress
16. Frontend: Show results
    - Display score, passed/failed, comparison to class average
    - Show explanation for each question (if available)
```

**Affected Tables**: `quiz_attempts`, `attempt_answers`, `student_progress`

**Affected Rows**:
- 1 new row in `quiz_attempts`
- 1-N new rows in `attempt_answers` (one per answered question)
- 1 new or updated row in `student_progress`

---

### Scenario 4: Admin Enrolls Student in Subject

**Sequence**:

```
1. Admin navigates to Subject > Manage Enrollment
2. Admin uploads CSV or selects students:
   - student@example.com
   - alice@example.com
   - bob@example.com
3. For each student:
   - SELECT users WHERE email = ?
   - INSERT INTO subject_enrollments (subject_id, student_id, enrollment_status='active', enrolled_by=admin_id)
4. Trigger: (none specific)
5. Students now see subject in their dashboard
6. Students can now:
   - View published quizzes
   - View sessions
   - View materials
   - Take quizzes
7. If teacher views class:
   - SELECT students from subject_enrollments WHERE subject_id = ?
   - Can now see all students' progress in student_progress table
```

**Affected Tables**: `subject_enrollments`

**Affected Rows**:
- 1-N new rows in `subject_enrollments` (one per student)

---

### Scenario 5: Teacher Schedules a Recurring Session

**Sequence**:

```
1. Teacher clicks "Schedule Session"
2. Fills form:
   - Title: "Weekly Math Concepts"
   - Date: 2026-04-15 (Tuesday)
   - Time: 10:00 AM - 11:00 AM (IST)
   - Make it recurring: YES
   - Pattern: Weekly
   - Days: Monday, Wednesday, Friday
   - Until: 2026-06-30
3. Backend:
   a) fn_session_teacher_check() verifies teacher is assigned to subject ✓
   b) INSERT INTO session_recurrence 
      (pattern='weekly', interval_value=1, days_of_week=ARRAY[1,3,5], 
       recur_until='2026-06-30')
   c) GET recurrence.id (UUID)
   d) FOR each occurrence date (2026-04-16 Wed, 2026-04-18 Fri, 2026-04-21 Mon, ...):
      INSERT INTO sessions
        (subject_id, topic_id, teacher_id, title, session_date, start_time, end_time,
         timezone, is_recurring=TRUE, recurrence_id, status='scheduled')
   e) Trigger trg_updated_at_sessions: updated_at auto-set
4. Zoom integration (optional):
   - If Zoom API enabled:
     - Call Zoom API: POST /users/{userId}/meetings
     - Get back zoom_meeting_id, zoom_start_url
     - UPDATE sessions SET zoom_meeting_id, zoom_start_url, zoom_host_email
5. Students see sessions in their calendar
6. When session date arrives:
   - Status may update to 'live' (manual or automated)
   - Students join via meeting_link or zoom_start_url
7. After session:
   - Teacher may upload recording_url
   - UPDATE sessions SET status='completed', recording_url
8. If teacher deletes one occurrence:
   - DELETE FROM sessions WHERE id = ?
   - Trigger trg_cleanup_orphan_session_recurrence:
     - Check if session_recurrence row is still referenced by other sessions
     - If not, DELETE FROM session_recurrence
```

**Affected Tables**: `session_recurrence`, `sessions`

**Affected Rows**:
- 1 new row in `session_recurrence`
- N new rows in `sessions` (one per occurrence until end date/max_occurrences)

---

### Scenario 6: Teacher Assigns Quiz to Specific Student

**Sequence**:

```
1. Teacher views assignment form
2. Selects quiz from subject
3. Clicks "Assign to students"
4. Checks boxes for students: [Alice], [Bob], [Charlie]
5. Sets deadline: 7 days from now
6. Backend:
   FOR each selected student:
     INSERT INTO student_content_assignments
       (subject_id, content_type='quiz', content_id=<quiz_id>, 
        student_id=<student_id>, assigned_by=<teacher_id>, 
        due_date=<7 days from now>)
7. Trigger: (none specific)
8. Students see:
   - Quiz in "Assigned to You" section (query: student_content_assignments)
   - Deadline: <due_date>
9. Student takes quiz
   - Same as Scenario 3, but uses assigned due_date for deadline
10. If student doesn't submit by due_date:
    - Display warning: "Assignment overdue"
```

**Affected Tables**: `student_content_assignments`

**Affected Rows**:
- 1-N new rows in `student_content_assignments` (one per student)

---

### Scenario 7: Teacher Grades an Assignment

**Sequence**:

```
1. Teacher navigates to Assignment > View Submissions
2. Sees list of submissions:
   - SELECT assignment_submissions WHERE assignment_id = ?
   - Shows: student_name, submitted_at, is_late, status='submitted'
3. Teacher clicks on student's submission
4. Views: submission_url (the uploaded work)
5. Teacher grades:
   - Marks awarded: 85 / 100
   - Feedback: "Great work! Minor typos in paragraph 3."
   - Uploads marked file: feedback_file_url
6. Backend:
   UPDATE assignment_submissions
   SET (marks_awarded=85, feedback='Great work!...', 
        feedback_file_url='s3://...', graded_by=<teacher_id>, 
        graded_at=now(), status='graded')
   WHERE id = ?
7. Trigger: (none on assignment_submissions; but could update student_progress)
8. Backend: Update student_progress
   - SELECT assignment_submissions WHERE student_id = ? AND status = 'graded'
   - Recalculate: assignments_graded, avg_assignment_marks
   - UPDATE student_progress
9. Student sees:
   - Assignment status: "Graded"
   - Marks: 85/100
   - Feedback: "Great work!..."
   - Can download feedback file
```

**Affected Tables**: `assignment_submissions`, `student_progress`

**Affected Rows**:
- 1 updated row in `assignment_submissions`
- 1 updated row in `student_progress`

---

### Scenario 8: Student Suspends from Subject

**Sequence**:

```
1. Admin navigates to Subject > Enrollment Management
2. Finds student: Alice
3. Clicks "Suspend"
4. Confirmation: "Are you sure?"
5. Backend:
   UPDATE subject_enrollments
   SET enrollment_status='suspended'
   WHERE student_id = <alice_id> AND subject_id = ?
6. Result:
   - Alice's access to subject contents is REVOKED
   - Existing progress preserved (in student_progress)
   - Alice cannot take new quizzes in this subject
   - Alice cannot view assignments, materials, sessions
7. If admin later clicks "Reactivate":
   UPDATE subject_enrollments
   SET enrollment_status='active'
   - Alice regains access
```

**Affected Tables**: `subject_enrollments`

**Affected Rows**:
- 1 updated row in `subject_enrollments`

---

## Views & Reporting

### View: `v_session_dashboard`

```sql
CREATE VIEW v_session_dashboard AS
SELECT
  s.id, s.title, s.session_date, s.start_time, s.end_time,
  s.meeting_link, s.meeting_password, s.recording_url, s.status,
  s.zoom_meeting_id, s.timezone, s.is_recurring,
  CASE
    WHEN s.status = 'live'                                  THEN 'live'
    WHEN s.session_date = CURRENT_DATE AND s.status = 'scheduled' THEN 'today'
    WHEN s.session_date = CURRENT_DATE + 1 AND s.status = 'scheduled' THEN 'tomorrow'
    WHEN s.session_date > CURRENT_DATE + 1                  THEN 'scheduled'
    ELSE s.status
  END AS display_status,
  sub.name  AS subject_name,
  sub.code  AS subject_code,
  c.name    AS course_name,
  c.code    AS course_code,
  t.first_name || ' ' || t.last_name AS teacher_name,
  t.email   AS teacher_email,
  sr.pattern, sr.days_of_week, sr.recur_until
FROM sessions s
JOIN subjects sub ON sub.id = s.subject_id
JOIN courses c ON c.id = sub.course_id
JOIN users t ON t.id = s.teacher_id
LEFT JOIN session_recurrence sr ON sr.id = s.recurrence_id;
```

**Purpose**: Provide dashboard-ready session data with computed `display_status` and all related info.

**Use Case**: Student calendar, teacher session list, admin oversight.

---

### View: `v_student_report`

```sql
CREATE VIEW v_student_report AS
SELECT
  sp.*,
  u.first_name || ' ' || u.last_name AS student_name,
  u.email AS student_email,
  sub.name AS subject_name,
  sub.code AS subject_code,
  c.name AS course_name,
  c.code AS course_code
FROM student_progress sp
JOIN users u ON u.id = sp.student_id
JOIN subjects sub ON sub.id = sp.subject_id
JOIN courses c ON c.id = sub.course_id;
```

**Purpose**: Combine student progress metrics with student and course info for reporting.

**Use Case**: Admin analytics, progress reports, identify struggling students.

---

### View: `v_subject_resources`

```sql
CREATE VIEW v_subject_resources AS
SELECT
  sub.id AS subject_id,
  sub.name AS subject_name,
  c.name AS course_name,
  COUNT(DISTINCT CASE WHEN q.quiz_type='test'     THEN q.id END) AS test_quizzes,
  COUNT(DISTINCT CASE WHEN q.quiz_type='practice' THEN q.id END) AS practice_quizzes,
  COUNT(DISTINCT a.id)  AS total_assignments,
  COUNT(DISTINCT sm.id) AS total_materials
FROM subjects sub
JOIN courses c ON c.id = sub.course_id
LEFT JOIN quizzes q ON q.subject_id = sub.id AND q.is_published = TRUE
LEFT JOIN assignments a ON a.subject_id = sub.id AND a.is_published = TRUE
LEFT JOIN subject_materials sm ON sm.subject_id = sub.id AND sm.is_active = TRUE
GROUP BY sub.id, sub.name, c.name;
```

**Purpose**: Summarize content availability per subject.

**Use Case**: Monitor content coverage, identify under-resourced subjects.

---

### View: `v_teacher_dashboard`

```sql
CREATE VIEW v_teacher_dashboard AS
SELECT
  st.teacher_id,
  t.first_name || ' ' || t.last_name AS teacher_name,
  sub.id AS subject_id,
  sub.name AS subject_name,
  c.name AS course_name,
  COUNT(DISTINCT se.student_id) FILTER (WHERE se.enrollment_status='active') AS enrolled_students,
  COUNT(DISTINCT q.id) AS total_quizzes,
  COUNT(DISTINCT a.id) AS total_assignments
FROM subject_teachers st
JOIN users t ON t.id = st.teacher_id
JOIN subjects sub ON sub.id = st.subject_id
JOIN courses c ON c.id = sub.course_id
LEFT JOIN subject_enrollments se ON se.subject_id = sub.id
LEFT JOIN quizzes q ON q.subject_id = sub.id
LEFT JOIN assignments a ON a.subject_id = sub.id
GROUP BY st.teacher_id, t.first_name, t.last_name, sub.id, sub.name, c.name;
```

**Purpose**: Teacher overview of their assigned subjects, enrollments, and content.

**Use Case**: Teacher dashboard, identify which subject needs more content.

---

## Entity Relationship Diagram (Conceptual)

```
┌─────────────┐
│   COURSES   │
│   (1)       │
└──────┬──────┘
       │
       │ contains
       ▼
┌─────────────────┐
│   SUBJECTS      │
│   (N)           │
└────────┬────────┘
         │
         ├─ enrolled via ─────────→ ┌──────────────────┐
         │                           │ SUBJECT_          │
         │                           │ ENROLLMENTS       │
         │                           └────────┬──────────┘
         │                                    │
         │                                    │ refers to
         │                                    ▼
         │                              ┌───────────┐
         │                              │   USERS   │
         │                              │ (Students)│
         │                              └───────────┘
         │
         ├─ taught by ────────────→ ┌──────────────────┐
         │                           │ SUBJECT_          │
         │                           │ TEACHERS          │
         │                           └────────┬──────────┘
         │                                    │
         │                                    │ refers to
         │                                    ▼
         │                              ┌───────────┐
         │                              │   USERS   │
         │                              │(Teachers) │
         │                              └───────────┘
         │
         ├─ contains ──────→ ┌─────────────┐
         │                   │   TOPICS    │
         │                   └─────┬───────┘
         │                         │
         │                         │ organizes
         │                         ▼
         │                   ┌────────────┐
         │                   │ QUESTIONS  │
         │                   │ MATERIALS  │
         │                   │ SESSIONS   │
         │                   └────────────┘
         │
         └─ contains ──────→ ┌──────────────────────┐
                             │ QUIZZES              │
                             │ (TEST / PRACTICE)    │
                             └──────────┬───────────┘
                                        │
                                        ├─ contains ──→ ┌────────┐
                                        │                │ QUIZ   │
                                        │                │ SETS   │
                                        │                └────────┘
                                        │
                                        ├─ has ──────→ ┌────────────┐
                                        │               │ QUESTIONS │
                                        │               └─────┬──────┘
                                        │                     │
                                        │                     ├─→ OPTIONS
                                        │                     │
                                        │                     └─→ ATTEMPT_
                                        │                        ANSWERS
                                        │
                                        └─ taken by ──→ ┌──────────────┐
                                                        │ QUIZ_        │
                                                        │ ATTEMPTS     │
                                                        └──────────────┘
```

---

## Cascade Rules Summary

| Parent Table | Child Table | Constraint | Behavior |
|--------------|------------|-----------|----------|
| courses | subjects | subject_id FK | ON DELETE CASCADE |
| courses | student_content_assignments | course_id FK | ON DELETE CASCADE |
| subjects | topics | subject_id FK | ON DELETE CASCADE |
| subjects | quizzes | subject_id FK | ON DELETE CASCADE |
| subjects | assignments | subject_id FK | ON DELETE CASCADE |
| subjects | sessions | subject_id FK | ON DELETE CASCADE |
| subjects | subject_materials | subject_id FK | ON DELETE CASCADE |
| subjects | subject_enrollments | subject_id FK | ON DELETE CASCADE |
| subjects | subject_teachers | subject_id FK | ON DELETE CASCADE |
| subjects | subject_teacher_students | subject_id FK | ON DELETE CASCADE |
| topics | questions | topic_id FK | ON DELETE SET NULL |
| topics | quizzes | topic_id FK | ON DELETE SET NULL |
| users (teacher) | subject_teachers | teacher_id FK | ON DELETE CASCADE |
| users (student) | subject_enrollments | student_id FK | ON DELETE CASCADE |
| quizzes | questions | quiz_id FK | ON DELETE CASCADE |
| quizzes | quiz_sets | quiz_id FK | ON DELETE CASCADE |
| quizzes | quiz_attempts | quiz_id FK | ON DELETE CASCADE |
| quizzes | quiz_write_permissions | quiz_id FK | ON DELETE CASCADE |
| quiz_sets | questions | set_id FK | ON DELETE CASCADE |
| questions | options | question_id FK | ON DELETE CASCADE |
| questions | attempt_answers | question_id FK | ON DELETE CASCADE |
| options | attempt_answers | selected_option_id FK | Soft reference (no constraint) |
| quiz_attempts | attempt_answers | attempt_id FK | ON DELETE CASCADE |
| assignments | assignment_submissions | assignment_id FK | ON DELETE CASCADE |
| users | student_progress | student_id FK | ON DELETE CASCADE |

**Key Insight**: Deleting a course cascades to all its subjects, quizzes, assignments, sessions, and ultimately student progress. This ensures data integrity: no orphaned records.

---

## Performance Considerations

### Query Optimization Tips

1. **Always filter by `is_published` or `is_active` in student queries**:
   ```sql
   SELECT q.* FROM quizzes q
   WHERE q.subject_id = ? AND q.is_published = TRUE
   ```
   This uses `idx_quizzes_published` index.

2. **Use `student_progress` for dashboards** instead of aggregating from `quiz_attempts`:
   ```sql
   -- ❌ SLOW (scans all quiz_attempts)
   SELECT AVG(score_pct) FROM quiz_attempts WHERE student_id = ?;
   
   -- ✅ FAST (O(1) lookup via student_progress)
   SELECT avg_score_pct FROM student_progress WHERE student_id = ?;
   ```

3. **Index sessions by teacher + date for class schedules**:
   ```sql
   -- Uses idx_sessions_teacher
   SELECT s.* FROM sessions s
   WHERE s.teacher_id = ? AND s.session_date = CURRENT_DATE;
   ```

4. **Partial indexes for rare conditions** (e.g., `idx_single_super_admin`):
   - Keeps index size small
   - Database enforces uniqueness within the partial set

### Denormalization Trade-off

**`student_progress`** is intentionally denormalized:

| Approach | Pros | Cons |
|----------|------|------|
| **Fully Normalized** | Accurate always, no redundancy | Slow aggregation queries (JOIN 4+ tables) |
| **Denormalized** (current) | Fast dashboard queries (1 table lookup) | Must keep in sync with source tables |

**Solution**: Scheduled job (pg_cron) refreshes `student_progress` every 15 minutes.

---

## Migration History

| Date | Migration | Purpose |
|------|-----------|---------|
| 2026-03-25 | schema.sql (canonical) | Initial schema |
| 2026-04-01 | add_content_assignment_system.sql | Add `student_content_assignments` table |
| 2026-04-01 | add_quiz_write_permissions.sql | Per-quiz write permissions for teachers |
| 2026-04-05 | assignment_duration_system.sql | Replace due_date with duration_days |
| 2026-04-08 | course_cascade_and_recurrence_cleanup.sql | Strengthen cascade rules, cleanup orphans |
| 2026-04-10 | course_level_content_assignments.sql | Allow course-level assignments |
| 2026-04-10 | student_uploads.sql | Add student file uploads |
| 2026-04-15 | super_admin_and_description.sql | Add super admin flag + user description |
| 2026-04-20 | latest_migration.sql | Session 'missed' status + teacher UX |

---

## Frequently Asked Questions

### Q: Why is `student_progress` denormalized?

**A**: Dashboard performance. Recalculating metrics on every query (JOINing 100+ quiz attempts) would be slow. Denormalization trades writes for fast reads. A periodic job keeps it in sync.

### Q: Can a user have multiple roles?

**A**: Yes, the schema supports it via `user_roles` junction table. A user can be both teacher and admin. In practice, it's typically one role per user.

### Q: What happens if I delete a course?

**A**: ON DELETE CASCADE ensures:
1. All subjects deleted
2. All quizzes, assignments, sessions, materials deleted
3. All student enrollments deleted
4. All student progress records deleted
5. All quiz attempts and answers deleted

No orphaned data remains.

### Q: How do I enforce "only 1 super admin"?

**A**: `idx_single_super_admin` is a unique partial index:
```sql
CREATE UNIQUE INDEX idx_single_super_admin 
  ON users(is_super_admin) WHERE is_super_admin = TRUE;
```

Attempting to set a second user as super admin will fail at the database level.

### Q: Can a teacher create a quiz for a subject they're not assigned to?

**A**: No, `fn_quiz_teacher_check()` trigger prevents it:
- Admins bypass the check
- Teachers must exist in `subject_teachers` for their subject
- Raises exception if not assigned

### Q: How do recurring sessions work?

**A**: 
1. Admin creates a recurrence pattern in `session_recurrence` (e.g., "weekly, Mon/Wed/Fri until 2026-06-30")
2. Application generates individual `sessions` rows for each occurrence
3. Each session is independent (can be cancelled, recorded, etc.)
4. Deleting the last session triggers automatic cleanup of the orphan pattern row

### Q: How do I calculate a student's grade in a subject?

**A**: Use `student_progress`:
```sql
SELECT avg_score_pct FROM student_progress
WHERE student_id = ? AND subject_id = ?;
```

Or custom formula combining:
- Quizzes: `avg_score_pct` (weighted)
- Assignments: `avg_assignment_marks` (weighted)

---

## Backend Join & GROUP BY Audit

This section captures the backend SQL that actually uses joins and/or grouping in `server/src`. I’m treating repeated query shapes as distinct if they serve different features or authorization paths.

### Auth, Profile, and Identity

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `auth.service.login()` | `users` ↔ `user_roles` ↔ `roles`, grouped by user columns | Loads one login row with all roles in a single query so login can validate password, active status, and active role without extra round-trips. |
| `profile.service.getProfile()` | `users` LEFT JOIN `user_roles` LEFT JOIN `roles`, grouped by user columns | Returns the current user plus all assigned roles for profile rendering. |
| `admin.service.getUsers()` | `users` LEFT JOIN `user_roles` LEFT JOIN `roles`, grouped by user columns | Powers the admin user directory with role chips and total row counting. |
| `admin.service.getStats()` | `user_roles` JOIN `roles` in subqueries | Counts how many users hold the student/teacher roles. |

### Courses, Subjects, and Topics

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `courses.service.getMyCourses()` | `courses` JOIN `subjects` plus `subject_teachers` or `subject_enrollments` depending on role | Builds the “my courses” view for teachers, students, and admins without separate queries per subject. |
| `topics.service.getTopicsByCourse()` | `topics` JOIN `subjects` | Returns topics grouped by course so the UI can list topic trees under a course filter. |
| `admin.service.getCourses()` | `courses` LEFT JOIN `subjects`, grouped by course columns | Shows subject counts per course in the admin course list. |
| `admin.service.getSubjects()` | `subjects` JOIN `courses` LEFT JOIN `subject_teachers` LEFT JOIN `users` LEFT JOIN `subject_enrollments`, grouped by subject columns | Builds the admin subject dashboard with teacher allocation, enrollment counts, and course labels. |
| `admin.service.getEnrolledStudents()` | `subject_enrollments` JOIN `users` | Returns the roster for a subject. |
| `admin.service.getSubjectAllocations()` | `subject_teachers` JOIN `users`, LEFT JOIN `subject_teacher_students` LEFT JOIN `users`, grouped by teacher | Produces one row per teacher with nested student allocations for the subject. |
| `classes.service.getTeacherSubjects()` | `subjects` JOIN `courses` JOIN `subject_teachers`, plus a nested teacher-name subquery | Shows only subjects the teacher is assigned to. |
| `classes.service.getEnrolledSubjects()` | `subjects` JOIN `courses` JOIN `subject_enrollments`, plus a nested teacher-name subquery | Shows only subjects the student is actively enrolled in. |
| `classes.service.getAllSubjects()` | `subjects` JOIN `courses`, plus a nested teacher-name subquery | Admin sees all active subjects regardless of assignment. |

### Quiz Queries

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `quiz.service.getQuizzesBySubject()` for student | `quizzes` LEFT JOIN `questions` LEFT JOIN `topics` LEFT JOIN `users`, grouped by quiz/topic/creator fields | Returns only quizzes explicitly assigned to the student and shows question counts without exposing answers. |
| `quiz.service.getQuizzesBySubject()` for teacher | Same joins as student plus `EXISTS` permission checks | Returns published quizzes plus unpublished ones the teacher can edit. |
| `quiz.service.getQuizzesBySubject()` for admin | Same joins plus `write_teacher_count` subquery | Gives admin the full quiz inventory and per-quiz write-access summary. |
| `quiz.service.getQuizWritePermissions()` | `quiz_write_permissions` JOIN `users` twice | Shows who can edit a specific quiz and who granted that access. |
| `quiz.service.getQuizWithQuestions()` | Quiz row uses `quizzes` LEFT JOIN `questions`; questions use `questions` LEFT JOIN `topics`; options use `options` JOIN `questions` | Builds the quiz authoring / review payload in one request. |
| `quiz.service.partialSubmitPractice()` | `quiz_attempts` JOIN `quizzes`; correct-answer lookup uses `questions` JOIN `options` and a `LEFT JOIN topics` | Scores practice attempts and prepares review data with topic context. |
| `quiz.service.resumePractice()` | `quiz_attempts` JOIN `quizzes` | Confirms the saved attempt is a practice attempt before resuming. |
| `quiz.service.submitAttempt()` | `quiz_attempts` JOIN `quizzes`; correct-answer lookup uses `questions` JOIN `options` | Grades a submission against correct options and the quiz passing score. |
| `quiz.service.getAttemptResult()` | `quiz_attempts` JOIN `quizzes`; answers use `attempt_answers` JOIN `questions` LEFT JOIN `topics` LEFT JOIN `options` twice | Renders a student’s review page with selected and correct answers side by side. |
| `quiz.service.updateQuiz()` | No joins in the write path; replaces quiz questions and options via inserts | Update is write-only, so no join is needed. |
| `quiz.service.appendQuestionsToQuiz()` | No joins in the write path; appends questions/options and flips quiz published state off | Keeps the quiz safely draft until reviewed. |
| `quiz.service.deleteQuiz()` | No joins; soft-deletes quiz and its questions | Avoids cascading deletes in the service layer. |
| `quiz.service.getStudentQuizStatuses()` | `quizzes` LEFT JOIN `quiz_attempts`, grouped by quiz | Reports whether a student has submitted or partially saved each quiz. |
| `quiz.service.getMyAttempts()` | `quiz_attempts` LEFT JOIN `attempt_answers`, grouped by attempt | Shows the student’s attempt history with answer counts. |
| `quiz.service.getQuizzesByCourse()` | `quizzes` LEFT JOIN `questions` LEFT JOIN `quiz_attempts` LEFT JOIN `topics` LEFT JOIN `users`, grouped by quiz + attempt + creator fields | Builds the course-level quiz list and attaches the student’s submitted attempt, if any. |

### Assignment and Materials Queries

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `assignment.service.getAssignmentsBySubject()` | `assignments` LEFT JOIN `assignment_submissions` LEFT JOIN `topics` LEFT JOIN `users`, grouped by assignment/topic/creator fields | Displays assignment cards with submission counts for a teacher view. |
| `assignment.service.getStudentAssignments()` | `assignments` LEFT JOIN `assignment_submissions` LEFT JOIN `topics`; `EXISTS` over `student_content_assignments` | Shows only assignments visible to the student, along with their own submission state. |
| `assignment.service.getSubmissions()` | `assignment_submissions` JOIN `users` | Returns per-student submission metadata for a teacher grading view. |
| `assignment.service.deleteAssignment()` | `user_roles` JOIN `roles` in an authorization subquery | Lets only the creator or an admin delete an assignment. |
| `materials.service.getMaterials()` | `subject_materials` JOIN `users` LEFT JOIN `topics` | Builds the material library with uploader and topic labels. |
| `materials.service.deleteMaterial()` | `user_roles` JOIN `roles` in an authorization subquery | Restricts deletion to the uploader’s draft or an admin. |

### Progress and Reporting Queries

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `progress.service.getActivityForRange()` | `quiz_attempts` JOIN `quizzes`, LEFT JOIN `attempt_answers`, grouped by day | Produces daily activity charts with quiz/practice counts and correct/incorrect totals. |
| `progress.service.getQuizHistory()` | `quiz_attempts` JOIN `quizzes` LEFT JOIN `subjects` LEFT JOIN `courses` LEFT JOIN `attempt_answers`, grouped by attempt | Returns the student’s last attempts with subject/course context and answer accuracy. |
| `progress.service.getStudentProgress()` | `subject_enrollments` JOIN `subjects` JOIN `courses`; LEFT JOIN `quizzes` LEFT JOIN `quiz_attempts` LEFT JOIN `assignments` LEFT JOIN `assignment_submissions`, grouped by subject | Powers the student dashboard summary across tests, practices, assignments, and activity timestamps. |
| `progress.service.getTopicAnalysis()` | `topics` JOIN `questions` JOIN `quizzes` LEFT JOIN `attempt_answers`, grouped by topic | Shows topic-level accuracy so the UI can highlight weak areas. |
| `progress.service.getTeacherReport()` | `subject_teachers` JOIN `subjects` JOIN `courses` JOIN `subject_enrollments` JOIN `users`; LEFT JOIN `quizzes` LEFT JOIN `quiz_attempts` LEFT JOIN `assignments` LEFT JOIN `assignment_submissions`, grouped by subject and student | Builds the teacher’s per-student progress report for every active subject they teach. |
| `progress.service.getAttemptReview()` | `quiz_attempts` JOIN `quizzes`; answers use `attempt_answers` JOIN `questions` LEFT JOIN `topics` LEFT JOIN `options` twice | Renders the detailed attempt review page for a student. |
| `progress.service.isStudentOfTeacher()` | `subject_teachers` JOIN `subject_enrollments` | Verifies a teacher-student relationship before exposing progress data. |

### Admin Dashboard and Session Queries

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `admin.service.getAdminDashboardOverview()` student branch | `users` JOIN `user_roles` JOIN `roles`, LEFT JOIN `subject_enrollments` LEFT JOIN `subjects` LEFT JOIN `courses`, plus nested JOINs to `subject_teacher_students` and `users` | Builds the student-side admin overview with enrolled subjects and assigned teachers. |
| `admin.service.getAdminDashboardOverview()` teacher branch | `users` JOIN `user_roles` JOIN `roles`, LEFT JOIN `subject_teachers` LEFT JOIN `subjects` LEFT JOIN `courses` LEFT JOIN `subject_teacher_students`, plus nested JOINs to `subject_teacher_students` and `users` | Builds the teacher-side admin overview with subjects, total students, and nested student lists. |
| `admin.service.getAllSessionsAdmin()` | `sessions` JOIN `subjects` JOIN `courses` JOIN `users` LEFT JOIN `topics`, plus nested JOIN `session_students` ↔ `users` | Returns all sessions with course/subject/teacher labels and targeted student lists. |
| `admin.service.deleteSubject()` | `questions` JOIN `quizzes` in a subquery | Clears dependent attempt answers before subject deletion so the quiz/question cascade can proceed cleanly. |

### Classes and Session Scheduling Queries

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `classes.service.getSessionsByTeacher()` | `sessions` JOIN `subjects` JOIN `courses` LEFT JOIN `topics` LEFT JOIN `session_recurrence`, plus nested `session_students` ↔ `users` | Returns a teacher’s own sessions with targeting metadata and recurrence details. |
| `classes.service.getSessionsByStudent()` | `sessions` JOIN `subjects` JOIN `courses` JOIN `users` JOIN `subject_enrollments` LEFT JOIN `topics` LEFT JOIN `session_recurrence`, with `EXISTS` checks against `subject_teacher_students` and `session_students` | Enforces both subject enrollment and targeted-session visibility for students. |
| `classes.service.getAllSessions()` | `sessions` JOIN `subjects` JOIN `courses` JOIN `users` LEFT JOIN `topics` LEFT JOIN `session_recurrence`, plus nested `session_students` ↔ `users` | Gives admins the full session timetable and target lists. |
| `classes.service.startSessionById()` | `sessions` JOIN `subjects` | Locks the session row, validates ownership, and derives the class title before creating the Zoom meeting. |
| `classes.service.completeSessionById()` | `sessions` JOIN `subjects` | Verifies the session owner before marking it complete. |
| `classes.service.createSession()` | `subjects` lookup; inserts session rows and optional `session_students` rows | Uses one subject lookup to derive the class title, then writes the session graph. |
| `classes.service.getSubjectTeachers()` | `subject_teachers` JOIN `users` | Returns the teacher roster for a subject. |
| `classes.service.getSubjectStudents()` teacher branch | `subject_teacher_students` JOIN `users` | Returns only the students explicitly allocated to that teacher for the subject. |
| `classes.service.getSubjectStudents()` admin branch | `subject_enrollments` JOIN `users` | Returns all active enrolled students for admin-wide targeting. |
| `classes.service.getMySessionStats()` | `subject_teacher_students` JOIN `users` LEFT JOIN `sessions`, grouped by student | Summarizes completed sessions per allocated student. |
| `classes.service.deleteSession()` admin branch | `sessions` lookup plus delete of `session_students` before delete of `sessions` | Removes the targeted-roster rows before the parent session row. |

### Content Assignment and Permission Helpers

| Function | Join / Grouping Pattern | Why it exists |
|---|---|---|
| `content-assignments.service.getCourseStudents()` teacher branch | `subject_teacher_students` JOIN `subjects` JOIN `users` | Returns only teacher-allocated students within the requested course. |
| `content-assignments.service.getCourseStudents()` admin branch | `subject_enrollments` JOIN `subjects` JOIN `users` | Returns all active enrolled students for course-wide actions. |
| `content-assignments.service.getAssignmentsForCourse()` | `student_content_assignments` JOIN `users` twice | Shows student and assigner names for all course-scoped assignments. |
| `content-assignments.service.getAssignmentsForContent()` | `student_content_assignments` JOIN `users` twice | Shows which students have a specific content item assigned. |
| `content-assignments.service.getAssignmentsForSubject()` | `student_content_assignments` JOIN `users` twice | Shows all assignments attached to a subject. |
| `permissions.ts.getTeacherPermissionLevel()` | No join; single-table lookup | Reads the subject-level permission level directly. |
| `permissions.ts.hasQuizWritePermission()` | No join if subject-level permission exists; otherwise checks `quiz_write_permissions` | Applies subject-level and per-quiz authorization logic without extra joins. |

### What this audit means

- The backend uses joins primarily for **role resolution**, **subject/course navigation**, **student/teacher scoping**, and **dashboard aggregation**.
- `GROUP BY` appears whenever the backend needs one row per user, course, subject, quiz, attempt, or day while still returning aggregates like counts, averages, JSON arrays, or role lists.
- The most join-heavy paths are the dashboard/reporting endpoints, not the write endpoints; writes are usually single-table inserts/updates guarded by authorization checks.
- I did not find a separate SQL backend service for `student_uploads`; that table exists in schema/migrations, but the current backend codebase does not expose a query layer for it yet.

## Conclusion

The 10xAccel LMS database is a well-structured, normalized schema with strategic denormalization (`student_progress`) for performance. It enforces authorization at the database level (triggers), ensures data integrity (cascade rules, constraints), and provides rich reporting views.

**Key Strengths**:
- ✅ ACID compliance via PostgreSQL
- ✅ Referential integrity (foreign keys + cascades)
- ✅ Authorization checks (triggers)
- ✅ Denormalized metrics for fast queries
- ✅ Comprehensive indexing for common filters

**Key Considerations**:
- ⚠️ Keep `student_progress` in sync via periodic jobs
- ⚠️ Monitor index usage; remove unused indexes
- ⚠️ Archive old quiz attempts/submissions for long-term storage
- ⚠️ Backup frequently; test restore procedures

---

**Document Version**: 1.0  
**Last Updated**: April 9, 2026  
**Author**: Database Analysis System  
**Reviewed By**: Kishor Bharti
