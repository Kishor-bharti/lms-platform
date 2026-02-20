# 100xlearning LMS — Phased Execution Plan
# Based on: schema v2.1 · develop branch code · your feature requirements
# Current state: Auth working ✅ · DB seeded ✅ · UI shell exists ✅

---

## CRITICAL CONTEXT — READ BEFORE ANY PHASE

### What exists and works RIGHT NOW
- Login/auth for admin, teacher, student ✅
- JWT middleware + RBAC ✅
- Sidebar with role-filtered nav links ✅
- Sessions.js UI (fetches `/api/classes/my-sessions-v2`) ✅
- Classes.js UI (fetches `/api/classes/my-classes-v2`) ✅
- Dashboard with UpcomingClasses + CalendarWidget ✅
- Zoom start/end session (classes.service.ts) ✅

### What the develop branch already has (port these over)
- `classes.service.ts` — full session/class query logic using v2.1 schema
- `classes.controller.ts` — all handlers including startSessionById, completeSessionById
- `classes.routes.ts` — all routes including `/my-sessions-v2`, `/my-classes-v2`
- `zoom.service.ts` — working Zoom OAuth + meeting creation

### The core schema mismatch to be aware of
The develop branch `classes.service.ts` still references old table names (`classes`, `enrollments`).  
The v2.1 schema uses: `subjects`, `subject_enrollments`, `subject_teachers`, `sessions`.  
Every SQL query must be rewritten to use v2.1 tables. This is the #1 job of Phase 1.

### v2.1 Schema key relationships
```
courses → subjects (course_id)
subjects ← subject_teachers (subject_id, teacher_id)
subjects ← subject_enrollments (subject_id, student_id)
subjects ← sessions (subject_id, teacher_id)
sessions: status = 'scheduled' | 'live' | 'completed' | 'cancelled'
sessions: meeting_link (join URL) | zoom_start_url (host URL) | zoom_meeting_id
```

### localStorage keys (DO NOT CHANGE)
- `accessToken` — JWT
- `refreshToken`
- `role` — lowercase: 'admin' | 'teacher' | 'student'
- `user` — JSON object with { id, email, firstName, lastName, roles, activeRole }

### Role case convention
- Backend JWT payload: lowercase (`activeRole: 'teacher'`)
- `req.user.role`: lowercase (`'teacher'`)
- Frontend localStorage `role`: lowercase
- Route `roles[]` in routes.js: UPPERCASE (`['TEACHER']`) — Sidebar normalises both sides

---

## PHASE 1 — Wire Real Data: Sessions, Classes, Dashboard
**Estimated time: 3–4 hours**  
**Goal: Replace all mock/old-schema queries with real v2.1 queries. No UI changes.**

---

### [P1-T1] Rewrite classes.service.ts for v2.1 schema · Backend · 1.5 hrs

**Files to change:**
- `server/src/modules/classes/classes.service.ts` (full rewrite of SQL queries)
- `server/src/modules/classes/classes.types.ts` (update types to match)
- `server/src/config/db.ts` — add `queryWithClient` export (needed by startSessionById)

**Key functions to rewrite:**

```typescript
// Teachers see their assigned sessions (via subject_teachers join)
getSessionsByTeacherV2(teacherId: string): Promise<SessionWithDetails[]>
// SQL:
SELECT s.id, s.subject_id, sub.name as class_title, s.title,
       s.meeting_link as zoom_link, s.zoom_start_url as start_url,
       s.zoom_meeting_id, s.status,
       (s.session_date::text || 'T' || s.start_time::text) as scheduled_at
FROM   sessions s
JOIN   subjects sub ON sub.id = s.subject_id
JOIN   subject_teachers st ON st.subject_id = sub.id
WHERE  st.teacher_id = $1
ORDER  BY s.session_date DESC, s.start_time DESC

// Students see sessions from their enrolled subjects
getSessionsByStudentV2(studentId: string): Promise<SessionWithDetails[]>
// SQL:
SELECT s.id, s.subject_id, sub.name as class_title, s.title,
       s.meeting_link as zoom_link,
       s.status,
       (s.session_date::text || 'T' || s.start_time::text) as scheduled_at
FROM   sessions s
JOIN   subjects sub ON sub.id = s.subject_id
JOIN   subject_enrollments se ON se.subject_id = sub.id
WHERE  se.student_id = $1 AND se.enrollment_status = 'active'
ORDER  BY s.session_date DESC, s.start_time DESC

// Teachers see their assigned subjects/classes
getTeacherSubjectsV2(teacherId: string): Promise<ClassWithTeacher[]>
// SQL:
SELECT sub.id, sub.name as title, sub.code, sub.description,
       c.name as course_name, c.code as course_code,
       u.first_name || ' ' || u.last_name as teacher_name
FROM   subjects sub
JOIN   courses c ON c.id = sub.course_id
JOIN   subject_teachers st ON st.subject_id = sub.id
JOIN   users u ON u.id = st.teacher_id
WHERE  st.teacher_id = $1 AND sub.is_active = true

// Students see their enrolled subjects
getEnrolledSubjectsV2(studentId: string): Promise<ClassWithTeacher[]>
// SQL:
SELECT sub.id, sub.name as title, sub.code, sub.description,
       c.name as course_name, c.code as course_code,
       u.first_name || ' ' || u.last_name as teacher_name
FROM   subjects sub
JOIN   courses c ON c.id = sub.course_id
JOIN   subject_enrollments se ON se.subject_id = sub.id
JOIN   subject_teachers st ON st.subject_id = sub.id
JOIN   users u ON u.id = st.teacher_id
WHERE  se.student_id = $1 AND se.enrollment_status = 'active'
```

**startSessionById rewrite** — update column names:
- `zoom_link` → `meeting_link`
- `zoom_start_url` stays as is
- status values: lowercase `'live'` not `'LIVE'`
- `calculateSessionStatus()` must compare against lowercase `'live'`, `'completed'`

**SessionWithDetails interface update:**
```typescript
interface SessionWithDetails {
  id: string;
  subject_id: string;
  class_title: string;   // subject name
  title: string;
  zoom_link: string | null;    // meeting_link from DB
  start_url?: string;          // zoom_start_url from DB (teacher only)
  zoom_meeting_id?: string;
  scheduled_at: string;        // combined session_date + start_time
  status: string;              // LIVE | TODAY | TOMORROW | SCHEDULED | COMPLETED
}
```

**Acceptance:** 
- `GET /api/classes/my-sessions-v2` returns real sessions for Harman (teacher)
- `GET /api/classes/my-classes-v2` returns enrolled subjects for Kishor/Priya (students)

---

### [P1-T2] Add queryWithClient to db.ts · Backend · 15 min

`startSessionById` uses `queryWithClient` (client-bound query inside a transaction) but the current `db.ts` doesn't export it.

**Add to `server/src/config/db.ts`:**
```typescript
export async function queryWithClient<T extends Record<string, any> = any>(
  client: PoolClient,
  sql: string,
  params?: any[]
): Promise<T[]> {
  const res = await client.query<T>(sql, params);
  return res.rows;
}
```

---

### [P1-T3] Port classes module to current project · Backend · 30 min

Copy the full working `classes.service.ts`, `classes.controller.ts`, `classes.routes.ts`, `classes.types.ts` from develop branch into the current project's `/server/src/modules/classes/`.

Register the router in `app.ts`:
```typescript
import classesRouter from './modules/classes/classes.routes';
app.use('/api/classes', classesRouter);
```
(Already there — just verify it's present.)

Fix role check in `startSessionById` and `completeSessionById` controllers:
```typescript
// Change from:
if (userRole !== 'TEACHER') { ... }
// To (lowercase):
if (userRole !== 'teacher') { ... }
```

---

### [P1-T4] Dashboard real data · Frontend · 30 min

`UpcomingClasses.js` already fetches `/api/classes/my-sessions-v2` — it will work once backend is fixed.

**Only changes needed:**
1. Show "Upcoming Sessions" for teacher = sessions they teach
2. Show "Upcoming Classes" for student = sessions from their enrolled subjects
3. `CalendarWidget.js` — wire "View Sessions" button to `useNavigate('/admin/sessions')`

**No UI redesign** — just wire the data.

---

### [P1-T5] Seed data for sessions/subjects · SQL · 30 min

Create `server/sql/seed_sessions.sql` — idempotent, run after main seed.sql.

```sql
-- Seeds subjects under SAT/ACT/AP courses
-- Assigns Harman as teacher to SAT subjects  
-- Enrolls Kishor + Priya in SAT subjects
-- Creates 4-5 sessions with mixed statuses (live, completed, scheduled)
-- for Sessions page to show real data
```

Full SQL provided in Phase 1 deliverable.

**Acceptance for Phase 1:**
- [ ] Teacher (Harman) logs in → Sessions page shows real sessions with correct status badges
- [ ] Teacher clicks session → expands → Start/End buttons work with Zoom
- [ ] Student (Kishor) logs in → Classes page shows enrolled subjects
- [ ] Dashboard shows real upcoming sessions for both roles
- [ ] No console errors, no mock data

---

## PHASE 2 — Dynamic Sidebar Courses (Student + Teacher)
**Estimated time: 2–3 hours**  
**Goal: SAT/ACT/AP courses appear in sidebar dynamically per role**

---

### [P2-T1] API: Get my courses · Backend · 45 min

New endpoint: `GET /api/courses/my-courses`

- **Teacher:** Returns courses they have subjects assigned in (via `subject_teachers`)
- **Student:** Returns courses they are enrolled in subjects of (via `subject_enrollments`)
- **Admin:** Returns all active courses

```typescript
// server/src/modules/courses/courses.service.ts
// server/src/modules/courses/courses.controller.ts  
// server/src/modules/courses/courses.routes.ts
```

Response shape:
```json
[
  {
    "id": "uuid",
    "name": "SAT",
    "code": "SAT",
    "subjects": [
      { "id": "uuid", "name": "Math", "code": "SAT-MATH" }
    ]
  }
]
```

---

### [P2-T2] Dynamic sidebar — Student courses · Frontend · 1 hr

**How it works:**
- On login, fetch `/api/courses/my-courses` and store in localStorage as `courses`
- `routes.js` stays static — courses are injected dynamically into Sidebar
- `Sidebar.js` reads `courses` from localStorage and renders course nav sections below main nav

**Student sidebar course section:**
```
📘 SAT
   ├─ Math
   ├─ Reading
   └─ Writing

📗 AP  
   ├─ Chemistry
```
Each subject link → `/admin/course/SAT/subject/SAT-MATH` → shows subject page with:
- Quiz list (attempt quiz)
- Assignment list (submit assignment)
- Materials (download)
- Upcoming sessions for that subject

---

### [P2-T3] Dynamic sidebar — Teacher courses · Frontend · 1 hr

Same pattern but different subject page UI for teachers:
```
📘 SAT
   ├─ Math      → Subject page: [Sessions] [Create Quiz] [Upload Material] [Assignments]
   └─ Reading
```

Teacher subject page includes:
- List of their sessions for this subject
- Button: "Schedule New Session" (modal form)
- Button: "Create Quiz"
- Student list (enrolled students)

---

### [P2-T4] Subject detail pages · Frontend · 1 hr

**Student:** `views/courses/SubjectStudent.js`
- Shows subject info, teacher name
- Upcoming sessions with join button
- Quiz list with "Attempt" button
- Assignment list with "Submit" button
- Materials with "Download" button

**Teacher:** `views/courses/SubjectTeacher.js`
- Shows subject info
- Session list with Start/End
- "Schedule Session" modal
- Student enrollment list

**Acceptance for Phase 2:**
- [ ] SAT/ACT/AP courses appear in sidebar based on actual DB enrollment/assignment
- [ ] Clicking a course expands subjects
- [ ] Subject page loads correctly for student and teacher
- [ ] No hardcoded course names anywhere

---

## PHASE 3 — Admin Panel
**Estimated time: 4–5 hours**  
**Goal: Admin can manage everything — users, courses, subjects, enrollments, sessions**

---

### [P3-T1] User Management API · Backend · 1.5 hrs

```
GET    /api/users                   → list all users (filter by ?role=teacher)
POST   /api/users                   → create user + assign role
GET    /api/users/:id               → get user details
PATCH  /api/users/:id               → update name/email
PATCH  /api/users/:id/status        → activate/deactivate
POST   /api/users/:id/roles         → assign role
DELETE /api/users/:id/roles/:roleId → remove role
```

All protected by `authMiddleware + rbacMiddleware(['admin'])`.

---

### [P3-T2] Course/Subject Management API · Backend · 1 hr

```
POST   /api/courses                           → create course
PATCH  /api/courses/:id                       → update
POST   /api/courses/:courseId/subjects        → create subject
PATCH  /api/subjects/:id                      → update subject
POST   /api/subjects/:id/teachers             → assign teacher
DELETE /api/subjects/:id/teachers/:teacherId  → unassign teacher
POST   /api/subjects/:id/enrollments          → enroll student
DELETE /api/subjects/:id/enrollments/:userId  → unenroll student
```

---

### [P3-T3] Admin Dashboard UI · Frontend · 1 hr

New page: `views/admin/AdminDashboard.js`
- Stats cards: Total Students, Teachers, Active Sessions, Courses
- Recent activity table
- Quick actions: Create User, Create Subject, View Sessions

---

### [P3-T4] Admin User Management UI · Frontend · 1 hr

New page: `views/admin/Users.js`
- Table: Name, Email, Role badges, Status, Last login
- Filter by role
- Create user modal
- Toggle active/inactive
- Assign role

---

### [P3-T5] Admin Course/Subject UI · Frontend · 1 hr

New page: `views/admin/Courses.js`
- Course list with expand to show subjects
- Create course/subject modals
- Assign teacher to subject (dropdown)
- Enroll student in subject (multi-select)

**Acceptance for Phase 3:**
- [ ] Admin can create teacher → assign to subject → teacher sees it in sidebar
- [ ] Admin can enroll student → student sees subject in sidebar
- [ ] Admin can view all sessions across all teachers
- [ ] User activate/deactivate works

---

## PHASE 4 — Content: Quizzes & Assignments
**Estimated time: 3–4 hours**  
**Goal: Teachers create quizzes/assignments, students attempt them**

---

### [P4-T1] Quiz API · Backend · 1.5 hrs

Tables: `quizzes`, `quiz_sets`, `questions`, `options`, `quiz_attempts`, `attempt_answers`

```
POST /api/subjects/:id/quizzes           → create quiz (teacher)
GET  /api/subjects/:id/quizzes           → list quizzes (student/teacher)
GET  /api/quizzes/:id                    → quiz detail with questions
POST /api/quizzes/:id/attempts           → start attempt (student)
POST /api/attempts/:id/submit            → submit answers
GET  /api/attempts/:id/result            → get score/result
```

---

### [P4-T2] Quiz UI — Teacher (create) · Frontend · 1 hr

Modal/page: Create quiz → add sets → add questions → add options → mark correct answer

---

### [P4-T3] Quiz UI — Student (attempt) · Frontend · 1 hr

Quiz attempt page: show questions one by one, select answer, timer, submit, show score.

---

### [P4-T4] Assignments API + UI · Backend + Frontend · 1 hr

Tables: `assignments`, `assignment_submissions`

```
POST /api/subjects/:id/assignments        → create (teacher)
POST /api/assignments/:id/submit          → submit file/text (student)
GET  /api/assignments/:id/submissions     → view submissions (teacher)
```

**Acceptance for Phase 4:**
- [ ] Teacher creates quiz with 3 questions for SAT Math subject
- [ ] Student sees and attempts the quiz
- [ ] Score is recorded in quiz_attempts
- [ ] Teacher creates assignment, student submits

---

## PHASE 5 — Reports & Progress
**Estimated time: 2 hrs**  
**Goal: Student progress dashboard, teacher view of student performance**

Tables: `student_progress`

```
GET /api/progress/me              → student's own progress
GET /api/subjects/:id/progress    → all students in subject (teacher)
GET /api/admin/reports            → platform-wide stats (admin)
```

Wire to existing `Report.js` page.

---

## IMMEDIATE NEXT STEP → START PHASE 1

**Do Phase 1 first. Everything else depends on real data flowing.**

Order of work within Phase 1:
1. `queryWithClient` in db.ts [15 min]
2. Rewrite `classes.service.ts` SQL for v2.1 schema [1.5 hrs]  
3. Fix role case in controllers (`'teacher'` not `'TEACHER'`) [10 min]
4. Register classes router in app.ts [5 min]
5. Run `seed_sessions.sql` to get real data [30 min]
6. Verify dashboard + sessions + classes show real data [30 min]

---

## SEED DATA NEEDED (Phase 1 deliverable)

Run after main `seed.sql`. Creates:
- 3 subjects under SAT (Math, Reading, Writing)
- 2 subjects under AP (Chemistry, Physics)  
- Harman assigned as teacher to SAT Math + SAT Reading + AP Chemistry
- Kishor enrolled in SAT Math + SAT Reading
- Priya enrolled in SAT Math + AP Chemistry
- 5 sessions with statuses: 1 live, 2 completed, 2 scheduled

```sql
-- File: server/sql/seed_sessions.sql
-- Run: psql -U postgres -d 100xlearning -f sql/seed_sessions.sql
```
(Full SQL written during Phase 1 execution)
