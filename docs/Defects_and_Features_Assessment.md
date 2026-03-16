# Defects & Feature Requests — Assessment & Implementation Plan

> Source: *LMS - Defects and Questions-3.pdf*
> Assessment Date: 2026-03-13

---

## Quick Summary

| # | Feature / Issue | Role | Status |
|---|-----------------|------|--------|
| T1 | Student list on teacher dashboard | Teacher | ✅ Exists |
| T2 | Assign assignments to individual students | Teacher | ⚠️ Partial |
| T3 | File upload for assignments (not URL) | Teacher & Student | ❌ Missing |
| T4 | Delete assignments — admin only | Admin | ✅ Exists |
| T5 | Session start not working ("Not your session") | Teacher | ⚠️ Bug |
| T6 | Session scheduling — student name + end time fields | Teacher | ⚠️ Partial |
| T7 | Teacher session history (taught count + student names) | Teacher | ⚠️ Partial |
| T8 | Teacher can assign assignment to particular student | Teacher | ❌ Missing |
| T9 | Teacher can add topics | Teacher | ❌ Missing |
| T10 | Quiz answer options — image upload support | Teacher | ❌ Missing |
| A1 | Attendance tracking (student + teacher) | Admin | ❌ Missing |
| A2 | Classes count per teacher/student (week/month/year) | Admin | ❌ Missing |
| A3 | Salary calculation based on sessions taught | Admin | ❌ Missing |
| A4 | Student billing based on sessions attended | Admin | ❌ Missing |
| A5 | Admin can join/attend any session | Admin | ❌ Missing |
| A6 | Schedule recurring sessions | Admin | ⚠️ Partial (schema only) |
| A7 | Admin schedules sessions (teacher + student + recurring) | Admin | ❌ Missing |
| A8 | Delete restricted to Admin only | Admin | ✅ Exists |
| A9 | Teacher progress report | Admin | ✅ Exists |

**Totals: 4 complete · 5 partial/bug · 10 missing**

---

## Teacher Issues

---

### T1 — Student list visible on teacher dashboard ✅ EXISTS

**Current state:** The `v_teacher_dashboard` DB view aggregates `enrolled_students` count per subject. The subject page shows enrolled student count.

**Gap:** A per-student list (names + emails) is not surfaced in the teacher's main Dashboard view — only in the Report page.

**Plan to improve (optional):**
- Add a "My Students" card to `client/src/views/Index.js` (teacher role only) that calls `GET /api/classes/subjects/:subjectId/students` and renders a small avatar list.

---

### T2 — Assign assignments to individual students ⚠️ PARTIAL

**Current state:** Assignments exist as subject-level items — all enrolled students see the same assignments. There is no per-student targeting.

**What's missing:**
- `assignments` table has no `assigned_to` (student UUID) column.
- The create-assignment form has no student selector.

**Implementation Plan:**

**Server — DB migration:**
```sql
ALTER TABLE assignments ADD COLUMN assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
-- NULL = all enrolled students (default), non-NULL = specific student
```

**Server — `assignments.service.ts`:**
- `createAssignment`: accept optional `assignedTo` param; insert into new column.
- `getAssignmentsBySubject`: add `WHERE (assigned_to IS NULL OR assigned_to = $userId)` for student queries.

**Client — `SubjectPage.js` / assignment modal:**
- Fetch enrolled students for the subject (`GET /api/subjects/:id/students`).
- Add a "Assign to" dropdown (default: "All students").

---

### T3 — File upload for assignments (replace URL) ❌ MISSING

**Current state:** `assignment_submissions.submission_url` is a plain TEXT field. Students paste a URL. No actual file storage exists.

**Implementation Plan:**

**Storage:** Use Supabase Storage (bucket already configured — see `SUPABASE_BUCKET_SETUP.md`) or a multer + local/S3 upload.

**Server — new upload endpoint:**
```
POST /api/uploads/assignment-submission   → returns { fileUrl }
POST /api/uploads/assignment-material     → returns { fileUrl }
```
Use `multer` middleware; store files to Supabase bucket `assignment-files`.

**DB — no change needed:** `submission_url` can store the Supabase file URL.

**Client — `SubjectPage.js`:**
- Replace URL `<input>` in submission modal with `<input type="file">`.
- On submit, call upload endpoint first, then submit the returned URL.

**Admin delete:**
- When admin deletes a submission, also call Supabase Storage `remove()` to clean up the file.

---

### T4 — Delete functionality — Admin only ✅ EXISTS

**Current state:** Delete is enforced at the service layer for assignments, sessions, materials, and topics. Pattern used:
```ts
WHERE id = $1 AND (created_by = $2 OR /* user is admin */)
```
Topics: admin-only via `rbacMiddleware(['admin'])` on the route.

**No action required.** Admin-only bulk delete (select all student work and delete) is not yet available — see A8 below.

---

### T5 — Session start fails ("Not your session") ⚠️ BUG

**Current state:** `POST /api/classes/sessions/:id/start` checks `session.teacher_id !== teacherId` and throws `FORBIDDEN`. However, the client Sessions view shows sessions that do not belong to the logged-in teacher (e.g., sessions for a subject the teacher is assigned to, but not the session creator).

**Root cause:** Sessions created by Admin (via the admin panel) may have `teacher_id` set to the admin's user ID, not the teacher's. When Harman (teacher) tries to start it, the ownership check fails.

**Implementation Plan:**

**Server — `classes.service.ts` `startSession()`:**
```ts
// Current (too strict):
if (existing.teacher_id !== teacherId) throw { statusCode: 403, message: 'Not your session' };

// Fix — also allow if user is an assigned teacher for the subject:
const isAssigned = await query(
  `SELECT 1 FROM subject_teachers WHERE subject_id = $1 AND teacher_id = $2`,
  [existing.subject_id, teacherId]
);
if (!isAssigned.length) throw { statusCode: 403, message: 'Not your session' };
```

**Client — `Sessions.js`:**
- Remove the "Not your session" warning badge — it is confusing. Instead, show "Start Session" to any assigned teacher for that subject.

---

### T6 — Session scheduling: add student name + end date/time fields ⚠️ PARTIAL

**Current state:** The "Schedule New Session" form has: Title, Date, Start Time, Topic. It does NOT have: student name selector, end date, end time (duration is fixed at 90 min).

**Implementation Plan:**

**DB — no change needed:** `sessions` table already has `scheduled_end` column.

**Client — `SubjectPage.js` session modal:**
- Add **End Time** `<input type="time">` field; calculate duration from start→end.
- Add **Student** multi-select (optional; fetched from subject enrollments) — sets context for the session.

**Server — `classes.service.ts` `createSession()`:**
- Accept `endTime` param and compute `scheduled_end` instead of always adding 90 min.
- Accept optional `studentIds[]` — store in a new join table `session_students` or just log in session notes.

---

### T7 — Teacher sees sessions taught + per-student breakdown ⚠️ PARTIAL

**Current state:** Teachers can see their session list via the Sessions page. The Report page shows student quiz/assignment stats. There is no "sessions taught" count or per-student session history.

**Implementation Plan:**

**Server — new query in `classes.service.ts`:**
```sql
SELECT
  u.first_name, u.last_name, u.email,
  COUNT(s.id) AS sessions_count,
  MAX(s.scheduled_at) AS last_session
FROM sessions s
JOIN subject_enrollments se ON se.subject_id = s.subject_id
JOIN users u ON u.id = se.student_id
WHERE s.teacher_id = $1 AND s.status = 'completed'
GROUP BY u.id
ORDER BY sessions_count DESC;
```
Expose as `GET /api/classes/my-session-stats`.

**Client — `Report.js` or new `Sessions.js` tab:**
- Add a "Session Summary" tab/card showing total sessions taught and a table of students with their attendance count.

---

### T8 — Teacher assigns assignment to particular student ❌ MISSING

> This is the same as **T2** — covered above. See T2 implementation plan.

---

### T9 — Teacher can add topics ❌ MISSING

**Current state:** `POST /api/topics/` is restricted to `rbacMiddleware(['admin'])`. Teachers cannot create topics.

**Implementation Plan:**

**Server — `topics.routes.ts`:**
```ts
// Change:
router.post('/', rbacMiddleware(['admin']), ctrl.createTopic);
// To:
router.post('/', rbacMiddleware(['admin', 'teacher']), ctrl.createTopic);
```

**Server — `topics.service.ts` `createTopic()`:**
- Add check: if role is `teacher`, verify the topic's `subject_id` maps to a subject the teacher is assigned to (`subject_teachers` table).
- Teachers should NOT be able to create global/unscoped topics.

**Client — `SubjectPage.js`:**
- Show "+ Add Topic" button when role is `teacher` or `admin`.
- Reuse the existing admin topic creation modal, scoped to the current subject.

---

### T10 — Quiz answer options: image upload support ❌ MISSING

**Current state:** `questions` table supports `image_url` and `explanation_image_url`. `options` table only has `option_text TEXT` — no image column.

**Implementation Plan:**

**DB migration:**
```sql
ALTER TABLE options ADD COLUMN option_image_url TEXT;
-- option_text becomes optional when option_image_url is provided
ALTER TABLE options ALTER COLUMN option_text DROP NOT NULL;
```

**Server — `quizzes.service.ts`:**
- Update option insert/update to accept `optionImageUrl`.
- Update option read query to return `option_image_url`.

**Server — upload endpoint (reuse from T3):**
```
POST /api/uploads/quiz-option-image → { fileUrl }
```

**Client — `QuizBuilder.js`:**
- In the option input row, add an image upload icon button next to the text field.
- When an image is uploaded, show thumbnail; text field becomes optional.
- Display image options in `QuizTaker.js` using `<img>` instead of text.

---

## Admin Issues

---

### A1 — Attendance tracking (student + teacher per session) ❌ MISSING

**Current state:** No attendance tables. `student_progress.sessions_attended` is an integer counter with no per-session detail.

**Implementation Plan:**

**DB migration:**
```sql
CREATE TABLE session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'teacher' | 'student'
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS
    (EXTRACT(EPOCH FROM (left_at - joined_at)) / 60) STORED,
  UNIQUE(session_id, user_id)
);
```

**Server — new module `server/src/modules/attendance/`:**
- `POST /api/classes/sessions/:id/join` — record join time (call when Zoom join link is opened).
- `POST /api/classes/sessions/:id/leave` — record leave time.
- `GET /api/admin/attendance?sessionId=&userId=&from=&to=` — admin query.

**Client:**
- Admin Sessions page: add an "Attendance" column showing joined/absent status per session.
- Session detail modal: list all attendees with join/leave times.

---

### A2 — Classes count per teacher/student (week/month/year view) ❌ MISSING

**Depends on:** A1 (attendance tracking) for accurate "attended" counts.

**Implementation Plan:**

**Server — `admin.service.ts`:**
```sql
-- Sessions per teacher by period
SELECT
  u.first_name, u.last_name,
  DATE_TRUNC($period, s.scheduled_at) AS period,
  COUNT(s.id) AS sessions_conducted
FROM sessions s
JOIN users u ON u.id = s.teacher_id
WHERE s.status = 'completed'
GROUP BY u.id, period
ORDER BY period DESC;
```
Expose as `GET /api/admin/reports/sessions?groupBy=week|month|year&userId=`.

**Client — `AdminDashboard.js` or new `AdminReports.js`:**
- Add a "Attendance Report" section with period toggle (Week / Month / Year).
- Bar chart per teacher showing sessions conducted.
- Similar chart per student showing sessions attended.

---

### A3 — Salary calculation based on sessions taught ❌ MISSING

**Implementation Plan:**

**DB migration:**
```sql
CREATE TABLE teacher_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id),
  rate_per_session NUMERIC(10,2) NOT NULL,
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sessions_count INTEGER NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending | paid
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Server — `server/src/modules/payroll/`:**
- `GET /api/admin/payroll/teachers` — list teachers with session count + calculated salary.
- `POST /api/admin/payroll/generate` — generate salary record for a period.
- `PATCH /api/admin/payroll/:id/mark-paid` — mark as paid.

**Client — `AdminDashboard.js`:**
- Add "Payroll" tab: table of teachers, sessions count, rate, total owed, paid status.

---

### A4 — Student billing based on sessions attended ❌ MISSING

**Implementation Plan:** Same pattern as A3 but for students.

**DB migration:**
```sql
CREATE TABLE student_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  rate_per_session NUMERIC(10,2) NOT NULL,
  effective_from DATE NOT NULL
);

CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sessions_attended INTEGER NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'unpaid', -- unpaid | paid
  paid_at TIMESTAMPTZ
);
```

**Server — `server/src/modules/billing/`:**
- `GET /api/admin/billing/students` — list students with attendance count + bill.
- `POST /api/admin/billing/generate` — generate billing record.
- `PATCH /api/admin/billing/:id/mark-paid`.

---

### A5 — Admin can join/attend any session ❌ MISSING

**Current state:** `startSession` requires teacher role + subject ownership. Admin cannot start or get a join link.

**Implementation Plan:**

**Server — `classes.service.ts` `startSession()`:**
```ts
// Skip ownership check for admin role
if (userRole !== 'admin' && existing.teacher_id !== teacherId) {
  const isAssigned = ...; // check subject_teachers
  if (!isAssigned.length) throw { statusCode: 403 };
}
```

**Server — new endpoint:**
```
GET /api/admin/sessions/:sessionId/join-link
```
Returns `meeting_link` (Zoom participant URL) for any live session.

**Client — `AdminSessions.js`:**
- Add "Join" button on live sessions that opens `meeting_link` in a new tab.

---

### A6 — Recurring session scheduling ⚠️ PARTIAL (schema exists, no logic)

**Current state:** `session_recurrence` table and `sessions.is_recurring` + `sessions.recurrence_id` columns exist. No creation logic implemented.

**Implementation Plan:**

**Server — `classes.service.ts` `createRecurringSession()`:**
```ts
// 1. Insert into session_recurrence (pattern, interval, days_of_week, recur_until)
// 2. Generate all session dates between startDate and recur_until
// 3. Bulk insert into sessions with recurrence_id set
```

**Server — route:**
```
POST /api/admin/sessions/recurring
Body: { teacherId, subjectId, title, startDate, endDate, startTime, durationMin, pattern: 'weekly', daysOfWeek: [1,3,5] }
```

**Client — `AdminSessions.js` schedule modal:**
- Add "Recurring" toggle.
- When enabled: show recurrence pattern (Daily / Weekly / Custom days), End Date.
- Preview generated dates before confirming.

---

### A7 — Admin schedules sessions with teacher + student selection ❌ MISSING

**Current state:** Sessions can only be created by teachers via `POST /api/classes/sessions/create` (requires teacher role). Admin has no session creation endpoint.

**Implementation Plan:**

**Server — `admin.routes.ts`:**
```ts
router.post('/sessions', adminController.createSession);
router.patch('/sessions/:id', adminController.updateSession);
```

**Server — `admin.service.ts` `createAdminSession()`:**
```ts
// Accept: teacherId, studentIds[], title, subjectId, startDate, endDate, startTime, durationMin, isRecurring
// Insert session with teacher_id = provided teacherId
// Optionally insert into session_students join table
```

**Client — `AdminSessions.js`:**
- Add "+ Schedule Session" button (admin view).
- Modal fields:
  - Teacher name (searchable dropdown from `/api/admin/users?role=teacher`)
  - Student name(s) (multi-select from `/api/admin/users?role=student`)
  - Title, Subject, Start Date, End Date, Start Time, Duration
  - Recurring toggle (see A6)
- Reschedule: clicking a session opens an edit modal with the same fields.

---

### A8 — Delete restricted to Admin only ✅ EXISTS

**Current state:** Delete is enforced across assignments, sessions, materials, and topics. The pattern `WHERE created_by = $userId OR role = 'admin'` is applied at the service layer. Topics are admin-only at the route level.

**Bulk delete (not yet available):**

**Implementation Plan (to add bulk delete):**

**Server — `admin.routes.ts`:**
```ts
router.delete('/submissions/bulk', adminController.bulkDeleteSubmissions);
// Body: { submissionIds: string[] }
```

**Client — `AdminUsers.js` or student detail view:**
- Add checkboxes next to submissions.
- "Delete Selected" button (admin only) calls bulk delete endpoint.
- On success, also remove associated files from Supabase Storage.

---

### A9 — Teacher progress report ✅ EXISTS

**Current state:** `GET /api/progress/teacher-report` returns per-student stats (quizzes, practices, assignments, scores, last activity). The Report page (`client/src/views/examples/Report.js`) renders this as a `TeacherReport` component.

**Gap (from PDF):** The report does not include session history or attendance. There is also no dedicated teacher-facing summary (e.g., total sessions taught, total students, average quiz scores across all students).

**Plan to extend:**
- Add `sessions_taught` count and `students_active` count to the teacher report API response.
- Add a sessions breakdown table to the `TeacherReport` UI component.

---

## Priority Order (Recommended)

### High priority — directly breaks core workflow:
1. **T5** — Fix session start bug (teacher can't start their own session)
2. **T6** — Add end time + student to session schedule form
3. **T3** — File upload for assignment submissions
4. **T2 / T8** — Per-student assignment targeting
5. **A7** — Admin session scheduling

### Medium priority — important but not blocking:
6. **A6** — Recurring sessions (schema already in place)
7. **T9** — Teacher topic management
8. **A5** — Admin can join sessions
9. **A1** — Attendance tracking
10. **A2** — Attendance reports (depends on A1)

### Lower priority — analytics / financial:
11. **T7** — Teacher session history view
12. **A9** extend — Add sessions to teacher report
13. **T10** — Quiz image options
14. **A3** — Salary calculation
15. **A4** — Student billing
