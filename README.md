# 10xAccel LMS Platform

A full-stack Learning Management System built for structured online education, with multi-role access (Admin, Teacher, Student), a complete quiz engine, assignment management, Zoom-integrated live sessions, and AWS S3 file storage.

---

## Highlights

- **25 PostgreSQL tables** across 5 domains — Identity, Courses, Content, Activity, Delivery
- **13 API modules** — auth, admin, classes, courses, quiz, assignment, materials, topics, progress, profile, upload, content-assignments, student-uploads
- **201 tests (100% passing)** across 18 test suites (Jest + ts-jest, all mocked — no DB required)
- **3 user roles** — Admin, Teacher, Student — with 3-layer authorization (Frontend → API → Database triggers)
- **Zoom integration** — Server-to-Server OAuth for live session creation
- **AWS S3 file storage** — 3 private buckets (portal-assets, quiz-images, temp-uploads) with presigned URLs
- **KaTeX** — Full LaTeX math rendering in quiz questions and answers
- **Super Admin** — Single privileged admin with database-enforced uniqueness
- **Content Assignment System** — Per-student content targeting with individual due dates
- **Student Uploads** — Students upload files per subject/topic; teachers provide feedback

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, React Router 6, Axios, Reactstrap, Bootstrap 4, KaTeX, Recharts, SCSS |
| **Backend** | Node.js 18+, TypeScript 5, Express 4, Zod, JWT (access + refresh), bcrypt |
| **Database** | PostgreSQL 15+ (raw SQL via `pg`, no ORM) |
| **File Storage** | AWS S3 (3 private buckets + presigned URLs) |
| **Live Sessions** | Zoom REST API (Server-to-Server OAuth) |
| **Testing** | Jest 29, ts-jest, 100% mocked (no DB/network) |
| **Logging** | Winston + daily rotation (4 files: combined, error, warn, http) |
| **Security** | Helmet, express-rate-limit, Zod validation, DB-level triggers, CORS whitelist |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL 15+
- AWS account with S3 buckets created (see [AWS S3 Setup](#aws-s3-setup))
- Zoom Server-to-Server OAuth app credentials (optional — sessions work without Zoom link)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/lms-platform.git
cd lms-platform
```

### 2. Set Up the Database

```bash
# Create the database
createdb lmsdb

# Apply the full schema (creates all 25 tables, triggers, indexes, views)
psql lmsdb -f server/sql/schema.sql

# Seed the default admin account
psql lmsdb -f server/sql/seed.sql
```

> Default admin credentials after seeding:
> - Email: `admin@10xaccel.com`
> - Password: `Admin@#7684`
> - Change this immediately after first login.

### 3. Configure the Server

```bash
cd server
cp .env.development.example .env.development
```

Edit `.env.development` with your values:

```env
# Required
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://youruser:yourpass@localhost:5432/lmsdb
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<generate: same as above>

# AWS S3 (required for file uploads)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_PORTAL_BUCKET=portal-assets
S3_TEMP_BUCKET=temp-uploads
S3_QUIZ_BUCKET=quiz-images

# CORS
FRONTEND_ORIGINS=http://localhost:3000

# Zoom (optional — sessions work without Zoom)
ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_HOST_EMAIL=...
```

### 4. Configure the Client

```bash
cd client
cp .env.development.example .env.development
```

Edit `.env.development`:

```env
REACT_APP_API_URL=http://localhost:4000
```

### 5. Install Dependencies & Run

```bash
# Server
cd server
npm install
npm run dev       # starts on port 4000 with ts-node-dev

# Client (in a new terminal)
cd client
npm install
npm start         # starts on port 3000 (CRA dev server)
```

---

## AWS S3 Setup

The platform uses **3 private S3 buckets** for file storage. All files are accessed via presigned URLs (15-minute expiry).

| Bucket | Purpose | Size Limit |
|---|---|---|
| `portal-assets` | Published materials, assignment feedback files | No server limit |
| `temp-uploads` | Student assignment submissions (draft → moved on grade) | 100 MB per file |
| `quiz-images` | Quiz question and answer option images | 2 MB per image |

### Bucket Configuration

For each bucket:
1. **Block all public access: ON** (files are private; use presigned URLs)
2. **CORS policy** (required for browser uploads):

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

3. Add a **lifecycle rule** on `temp-uploads` to expire objects after 7 days (prevents orphaned draft files).

### IAM Policy

Create an IAM user or role with this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:CopyObject"],
    "Resource": [
      "arn:aws:s3:::portal-assets/*",
      "arn:aws:s3:::temp-uploads/*",
      "arn:aws:s3:::quiz-images/*",
      "arn:aws:s3:::portal-assets",
      "arn:aws:s3:::temp-uploads",
      "arn:aws:s3:::quiz-images"
    ]
  }]
}
```

---

## Commands Reference

### Server

```bash
npm run dev          # Start dev server with hot reload (ts-node-dev)
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled server (production)
npm test             # Run all 157 tests
npm run test:coverage # Run tests with coverage report
npm run type-check   # TypeScript type checking only
npm run lint         # ESLint
```

### Client

```bash
npm start            # Start dev server (port 3000)
npm run build        # Production build → build/
npm test             # Run client tests
```

---

## Architecture

### Backend — Module-Per-Feature Pattern

Each feature lives in its own module under `server/src/modules/`:

```
modules/
├── auth/               → Login (multi-role), token refresh
├── admin/              → User/course/subject/session CRUD, stats overview
├── classes/            → Session scheduling, Zoom creation, attendance
├── courses/            → My courses, subject listing
├── quiz/               → Quiz CRUD, questions, attempts, scoring
├── assignment/         → Assignment CRUD, submissions, grading
├── materials/          → Subject materials management
├── topics/             → Topic CRUD under subjects
├── progress/           → Student progress, weekly activity, reports
├── profile/            → Profile view/edit, password change
├── upload/             → File upload to S3 (quiz images + assignments)
├── content-assignments/ → Teacher→student content targeting
└── student-uploads/    → Student file uploads with teacher feedback
```

Each module follows: `routes.ts → controller.ts → service.ts` (+ `types.ts` where needed).

### Authentication — 3 Layers

```
1. Frontend:  ProtectedRoute.js      → checks user.activeRole in localStorage
2. API:       authMiddleware          → verifies JWT, extracts req.user
              rbacMiddleware(['role']) → enforces role requirement
3. Database:  fn_quiz_teacher_check   → teacher must be assigned to subject
              fn_session_teacher_check → same for sessions
```

**JWT tokens:**
- Access token: 15-minute expiry
- Refresh token: 7-day expiry (via `POST /api/auth/refresh`)
- Tokens carry: `userId`, `email`, `firstName`, `lastName`, `roles[]`, `activeRole`

**Multi-role login flow:**
1. User submits `email + password + loginAs` (selected role)
2. Server checks: existence → password → is_active → role membership
3. Returns `accessToken` + `refreshToken` + user object

### Database — 5 Domains, 25 Tables

```
Domain 1 — Identity:   roles, users, user_roles
Domain 2 — Courses:    courses, subjects, topics, subject_teachers,
                       subject_teacher_students, subject_enrollments
Domain 3 — Content:    quizzes, quiz_sets, questions, options,
                       quiz_write_permissions
Domain 4 — Activity:   quiz_attempts, attempt_answers, assignments,
                       assignment_submissions, student_progress
Domain 5 — Delivery:   session_recurrence, sessions, subject_materials,
                       session_students, student_content_assignments,
                       student_uploads
```

**Key design decisions:**
- UUID primary keys (`gen_random_uuid()`)
- No ORM — raw SQL via `query()` and `withTransaction()` helpers in `config/db.ts`
- 40+ indexes covering all major query patterns
- Database-level authorization triggers for quiz and session creation
- Unique index enforces exactly one correct answer per question
- Unique partial index enforces exactly one super admin
- 4 views: `v_session_dashboard`, `v_student_report`, `v_subject_resources`, `v_teacher_dashboard`
- `updated_at` triggers on all mutable tables

### File Storage — AWS S3

Storage references are stored in the database as `bucket-name/object-key` strings (e.g., `portal-assets/1234-abc.pdf`). At query time, `signFileFields()` converts these to presigned URLs before returning to the client.

```
server/src/utils/storage.ts
├── getS3Client()           → singleton S3 client
├── resolveStorageRef()     → parses stored ref → { bucket, path }
├── buildStorageRef()       → bucket + path → stored ref string
├── createSignedUrl()       → generates 15-min presigned URL
├── signFileFields()        → signs multiple URL fields in a result object
├── uploadToS3()            → used by upload controller
├── moveFileBetweenBuckets()→ temp → portal-assets on finalization
├── deleteFileByUrl()       → delete single file
└── deleteFilesByUrls()     → batch delete (grouped by bucket)
```

---

## API Modules

| Module | Prefix | Key Endpoints |
|---|---|---|
| **Auth** | `/api/auth` | `POST /login`, `POST /refresh` |
| **Admin** | `/api/admin` | User CRUD, Course CRUD, Subject CRUD, Enrollment mgmt, Allocation mgmt, Stats |
| **Classes** | `/api/classes` | My sessions, create/start/complete session, Zoom integration |
| **Courses** | `/api/courses` | My courses, topics per course |
| **Quiz** | `/api/quizzes` | Quiz CRUD, questions, attempts, results, write permissions |
| **Assignment** | `/api/assignments` | Create, submit, grade, feedback |
| **Materials** | `/api/materials` | Upload, update, publish, delete |
| **Topics** | `/api/subjects/:id/topics` | Topic CRUD |
| **Progress** | `/api/progress` | Student stats, weekly activity, quiz history, teacher reports |
| **Profile** | `/api/profile` | View/edit profile, change password |
| **Upload** | `/api/upload` | Quiz image upload (2MB), assignment file upload (100MB) |
| **Content Assignments** | `/api/content-assignments` | Assign quiz/assignment/material to student, list, delete |
| **Student Uploads** | `/api/student-uploads` | Student file upload, list, teacher feedback |

---

## User Roles & Permissions

### Admin
- Full system access; the only role that can manage users, courses, and subjects
- Creates and assigns teachers to subjects (with `read` or `write` permission)
- Enrolls students in subjects
- Manages all sessions (create, edit, delete any)
- Grants per-quiz write permissions to teachers
- One user can be designated **Super Admin** (database-enforced unique)

### Teacher
- Assigned to specific subjects via `subject_teachers` (with `read` | `write` permission level)
- `write` permission: can create quizzes, questions, assignments, materials, and sessions for their subjects
- Can be granted write access to specific quizzes (`quiz_write_permissions`)
- Can manage their own student roster within assigned subjects
- Can view student progress reports and grade submissions
- Can upload student feedback files

### Student
- Enrolled in subjects via `subject_enrollments` (status: active | suspended | completed)
- Can take quizzes (with attempt limits and time tracking)
- Can submit assignments (URL or file)
- Can upload files per subject/topic (`student_uploads`)
- Can view their own progress and quiz history

---

## Key Features

### Quiz Engine
- **Two types:** `test` (graded, attempt-limited) and `practice` (unlimited, self-paced)
- Multiple quiz sets per quiz; questions organized with difficulty levels (easy/medium/hard)
- Questions support LaTeX math (KaTeX), image attachments, and explanations with images
- Answer options (A/B/C/D) support both text and images
- Exactly one correct answer per question (enforced at DB level)
- Attempt resumption for practice quizzes; auto-scoring on submission
- Per-quiz write permissions allow teacher collaboration

### Assignment System
- Created at subject + topic level; optionally assigned to a specific student
- `duration_days` field: when a teacher assigns to a student via content-assignment, a per-student `due_date` is computed automatically
- Submissions: file URL + notes; late detection based on due date
- Grading: marks, text feedback, and feedback file upload

### Live Sessions (Zoom)
- Scheduled with date, start time, end time, timezone
- Optional Zoom meeting created automatically via Server-to-Server OAuth
- Status lifecycle: `scheduled` → `live` → `completed` / `cancelled` / `missed`
- Recurring sessions supported (daily/weekly/monthly with pattern config)
- Session-student roster for 1-on-1 session targeting
- Orphan recurrence records auto-cleaned on last session delete (DB trigger)

### Content Assignment System
- Teachers assign existing quiz/assignment/material directly to individual students
- Supports both subject-level and course-level content
- Per-student `due_date` overrides the content's original deadline
- Tracks who assigned (`assigned_by`) and when

### Student Uploads
- Students upload files (any format) per subject, optionally per topic
- Teachers review and provide: text feedback + feedback file
- Visible to the assigned teacher and admin

### Progress & Reporting
- `student_progress` table tracks per-student, per-subject aggregates
- `v_student_report` view joins progress with student and subject details
- `v_teacher_dashboard` view aggregates enrolled students, quizzes, and assignments per teacher
- Weekly activity endpoint for dashboard charts

---

## Testing

201 tests across 18 suites — all mocked (no database or network required).

```
Middlewares (4 suites): auth, rbac, validate, error
Utilities (2 suites): jwt, password
Services (12 suites): auth, admin, classes, courses, quiz, assignment, materials, progress,
                      profile, topics, content-assignments, student-uploads
```

```bash
cd server
npm test               # run all tests
npm run test:coverage  # with coverage report
```

All 201 tests pass. Coverage spans the complete auth, CRUD, and business-logic surface of the platform.

---

## Production Deployment (AWS)

The recommended production stack:

```
Internet
    ├── CloudFront CDN ──► S3 (React frontend build)
    └── EC2 (Node.js/Express API, port 4000, behind Nginx)
              ├── RDS PostgreSQL (private subnet)
              └── S3 Buckets: portal-assets, temp-uploads, quiz-images
```

**Key services:**
- **EC2 t3.micro** — API server (free tier eligible; handles 200–300 users)
- **RDS db.t3.micro PostgreSQL** — managed database (free tier eligible)
- **S3 + CloudFront** — React SPA with CDN
- **ACM** — free SSL certificates
- **PM2** — process manager for zero-downtime restarts
- **Nginx** — reverse proxy, handles large uploads (`client_max_body_size 100M`)

**Production logging** — 4 rotating log files in `logs/`:

| File | Level | Retention | Purpose |
|---|---|---|---|
| `combined-YYYY-MM-DD.log` | info+ | 14 days | General event stream |
| `error-YYYY-MM-DD.log` | error | 30 days | Critical failures only |
| `warn-YYYY-MM-DD.log` | warn | 14 days | Slow requests, auth denials, RBAC blocks |
| `http-YYYY-MM-DD.log` | http | 7 days | Every request with method, path, status, duration, user |

Startup logs include a full config verification summary (secrets shown as set/not set, never their values).

See [docs/AWS_DEPLOYMENT_GUIDE.md](docs/AWS_DEPLOYMENT_GUIDE.md) for the full step-by-step guide.

**Estimated monthly cost after free tier:** ~$30–35/month for 200–300 users.

---

## Project Structure

```
lms-platform/
├── client/                     # React 18 SPA (CRA)
│   └── src/
│       ├── views/              # Page components by role
│       │   ├── admin/          # Admin dashboard, users, courses, sessions...
│       │   ├── examples/       # Login, classes, sessions, profile, report...
│       │   ├── quiz/           # QuizBuilder, QuizTaker, CourseQuiz
│       │   └── subject/        # SubjectPage, SubjectTeacher, SubjectStudent
│       ├── components/         # Reusable: Sidebar, Navbars, Headers, LatexRenderer
│       ├── layouts/            # Admin.js (authenticated), Auth.js (public)
│       └── utils/              # http.js (Axios + interceptors), api.js
│
├── server/                     # TypeScript/Express API
│   ├── src/
│   │   ├── config/             # db.ts, env.ts, logger.ts
│   │   ├── middlewares/        # auth, rbac, validate, error, rateLimit, httpLogger
│   │   ├── modules/            # 13 feature modules (routes → controller → service)
│   │   ├── services/           # zoom.service.ts
│   │   └── utils/              # storage.ts, jwt.ts, password.ts, permissions.ts
│   ├── sql/
│   │   ├── schema.sql          # Complete DB schema (single-file setup)
│   │   ├── seed.sql            # Admin user seed (idempotent)
│   │   ├── drop.sql            # Tear-down script
│   │   ├── truncate.sql        # Reset data (keep schema)
│   │   └── migrations/         # Historical incremental migrations (for reference)
│   └── __tests__/              # 157 tests across 16 suites
│
└── docs/                       # Architecture docs, case studies, guides
```

---

## Documentation

| Document | Description |
|---|---|
| [AWS_DEPLOYMENT_GUIDE.md](docs/AWS_DEPLOYMENT_GUIDE.md) | Step-by-step production deployment on AWS |
| [PRODUCTION_DEPLOYMENT_GUIDE.md](docs/PRODUCTION_DEPLOYMENT_GUIDE.md) | Cloud provider comparison and cost analysis |
| [DATABASE_COMPLETE_ANALYSIS.md](docs/DATABASE_COMPLETE_ANALYSIS.md) | Full schema analysis with all 25 tables documented |
| [LMS_Database_Schema_v3.0.docx](docs/LMS_Database_Schema_v3.0.docx) | Database schema reference (Word document) |
| [LMS_Features_v1.0.docx](docs/LMS_Features_v1.0.docx) | User manual covering all features by role |
| [CASE_STUDY_CONCURRENT_QUIZ_EDITING.md](docs/CASE_STUDY_CONCURRENT_QUIZ_EDITING.md) | How quiz write permissions were designed |
| [CaseStudy_PrivateStorageMigration.md](docs/CaseStudy_PrivateStorageMigration.md) | Supabase → AWS S3 migration case study |
| [CI_GUIDE.md](docs/CI_GUIDE.md) | GitHub Actions CI setup |
| [SCALABILITY_AND_RELIABILITY_AUDIT.md](docs/SCALABILITY_AND_RELIABILITY_AUDIT.md) | Performance and reliability analysis |

---

## License

Proprietary. All rights reserved. See [LICENSE](LICENSE).
