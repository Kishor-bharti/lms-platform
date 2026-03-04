# 10xAccel LMS — Engineering Case Study

> **Author:** Kishor Bharti
> **Date:** March 2026
> **Version:** 1.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [Architecture & System Design](#4-architecture--system-design)
5. [Technology Stack](#5-technology-stack)
6. [Database Design](#6-database-design)
7. [Backend Engineering](#7-backend-engineering)
8. [Frontend Engineering](#8-frontend-engineering)
9. [Authentication & Authorization](#9-authentication--authorization)
10. [Key Feature Deep Dives](#10-key-feature-deep-dives)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment & DevOps](#12-deployment--devops)
13. [Metrics & Scale](#13-metrics--scale)
14. [Challenges & Solutions](#14-challenges--solutions)
15. [Lessons Learned](#15-lessons-learned)

---

## 1. Executive Summary

**10xAccel** is an enterprise-grade Learning Management System (LMS) designed and built for an EdTech startup in 2026. It powers a fully digital learning ecosystem supporting three distinct user roles — **Administrators**, **Teachers**, and **Students** — with features spanning live Zoom-integrated classes, quiz & assignment management with LaTeX support, student progress tracking, and granular role-based access control.

The platform is built as a decoupled system with a **React 18 SPA** frontend and a **TypeScript/Express REST API** backend, backed by **PostgreSQL**. It follows a raw-SQL-first philosophy (no ORM), uses JWT-based stateless authentication with multi-role context switching, and is deployed on **Vercel** for both tiers.

### Headline Numbers

| Metric | Value |
|--------|-------|
| Database tables | 20 |
| API route modules | 11 |
| Service modules | 10 + 1 standalone |
| Client views/pages | 20 |
| Client routes | 18 |
| Unit tests | 157 across 16 test suites |
| User roles | 3 (Admin, Teacher, Student) |

---

## 2. Problem Statement

The client — an EdTech startup operating in the competitive test-prep market (SAT, ACT, and similar standardized exams) — faced the following challenges:

1. **Fragmented tooling:** Teachers used a patchwork of Google Classroom, Zoom, WhatsApp, and spreadsheets. No single system provided class scheduling, quiz management, and progress tracking under one roof.

2. **No role isolation:** Existing off-the-shelf LMS solutions treated all users identically. The client needed strict separation between what an admin, teacher, and student can see and do — at both the UI and API level.

3. **Math-heavy content:** Test-prep content for standardized exams is heavily mathematical. Existing platforms either lacked LaTeX rendering entirely or required external plugins that broke the user experience.

4. **Live class management:** The startup ran daily live classes via Zoom. Instructors had to manually create meetings, share links via chat, and there was no centralized dashboard to track schedules or completion.

5. **No actionable analytics:** Student progress was tracked manually in spreadsheets. There was no automated way to measure quiz performance, assignment completion rates, or weekly activity trends.

### Business Requirements

- Multi-role platform (Admin, Teacher, Student) with strict access control
- Course → Subject → Topic hierarchical content organization
- Quiz system supporting both timed tests and untimed practice mode with LaTeX
- Assignment workflow with submission, late detection, and grading
- Zoom-integrated live class scheduling with auto-meeting creation
- Student progress dashboard with weekly activity and quiz history
- Teacher reporting dashboard showing per-student performance
- Admin panel for user management, course/subject CRUD, and enrollment management
- File upload for materials and quiz images (cloud storage)
- Mobile-responsive UI

---

## 3. Solution Overview

10xAccel was architected as a **two-tier decoupled system**:

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React 18 SPA)                │
│  Argon Dashboard React  •  React Router v6  •  Axios    │
│  KaTeX  •  Reactstrap  •  Bootstrap 4  •  SCSS          │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / JSON
                         ▼
┌─────────────────────────────────────────────────────────┐
│               SERVER (TypeScript + Express)              │
│  Raw SQL (pg)  •  JWT  •  Zod  •  Bcrypt  •  Multer     │
│  Helmet  •  CORS  •  Rate Limiter  •  Zoom OAuth        │
└────────────────────────┬────────────────────────────────┘
                         │ SQL over TCP
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                     │
│  20 Tables  •  UUID PKs  •  Triggers  •  Views          │
│  pgcrypto  •  Authorization triggers  •  30+ Indexes    │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────┐  ┌────────────────────────┐
│   Supabase Storage (Files)   │  │    Zoom REST API       │
│   Materials, quiz images     │  │    OAuth + Meetings    │
└──────────────────────────────┘  └────────────────────────┘
```

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Separation of concerns** | Client and server are independently deployable sub-projects |
| **Raw SQL over ORM** | Direct pg pool queries for full control, performance, and transparency |
| **Module-per-feature** | Each backend domain is a self-contained module (routes → controller → service) |
| **Defense in depth** | Middleware chain: Helmet → CORS → Rate limiter → Auth → RBAC → Validation → Handler |
| **Database as enforcement layer** | Authorization triggers, unique constraints, and check constraints at the DB level |
| **Stateless authentication** | JWT access + refresh tokens; no server-side session storage |

---

## 4. Architecture & System Design

### 4.1 High-Level Architecture

The system follows a **layered architecture** pattern:

```
Request Flow:
─────────────────────────────────────────────────────────────
Client (Browser)
  → Axios HTTP client (auto-attaches Bearer token)
    → Express Server
      → Helmet (security headers)
      → CORS (origin whitelist)
      → Rate Limiter
      → Router
        → Auth Middleware (JWT verify → req.user)
        → RBAC Middleware (role check)
        → Validate Middleware (Zod schema)
        → Controller (parse req/res)
          → Service (business logic)
            → DB helpers (query / withTransaction)
              → PostgreSQL
─────────────────────────────────────────────────────────────
```

### 4.2 Module Structure

Each backend feature is organized as:

```
server/src/modules/<feature>/
├── <feature>.routes.ts       # Express Router + middleware chain
├── <feature>.controller.ts   # Request parsing, response shaping
├── <feature>.service.ts      # Business logic, DB queries
└── <feature>.types.ts        # TypeScript interfaces (optional)
```

This ensures **no business logic leaks into controllers** and **no HTTP concerns leak into services** — enabling services to be unit-tested in isolation with mocked DB calls.

### 4.3 API Module Map

| Module | Route Prefix | Key Operations |
|--------|-------------|----------------|
| **Auth** | `/api/auth` | Login with role selection, token refresh |
| **Classes** | `/api/classes` | Subject lists, session CRUD, Zoom integration |
| **Courses** | `/api/courses` | Course listing with subject grouping |
| **Admin** | `/api/admin` | User CRUD, course/subject management, enrollments |
| **Quiz** | `/api/quizzes` | Quiz CRUD, question management, attempts, grading |
| **Assignment** | `/api/assignments` | Assignment CRUD, submissions, grading |
| **Progress** | `/api/progress` | Weekly activity, quiz history, student/teacher reports |
| **Topics** | `/api/subjects/:id/topics` | Topic CRUD nested under subjects |
| **Materials** | `/api/materials` | File/resource management per subject |
| **Profile** | `/api/profile` | User profile view/update, password change |
| **Upload** | `/api/upload` | File upload to Supabase Storage |

---

## 5. Technology Stack

### 5.1 Backend

| Technology | Version | Rationale |
|------------|---------|-----------|
| **Node.js** | ≥ 18.0.0 | LTS with native ESM, fetch, and crypto |
| **TypeScript** | ^5.9.3 | Type safety across the entire backend; strict mode enabled |
| **Express** | ^4.19.2 | Lightweight, flexible HTTP framework; minimal overhead |
| **PostgreSQL** | 15+ | Robust RDBMS with UUID support, triggers, partial indexes, CTEs |
| **pg** | ^8.11.3 | Low-level PostgreSQL driver; full control over connection pooling |
| **Zod** | ^3.24.1 | Runtime request validation with TypeScript type inference |
| **jsonwebtoken** | ^9.0.2 | JWT signing/verification for stateless auth |
| **bcrypt** | ^5.1.1 | Industry-standard password hashing with salt rounds |
| **Helmet** | ^7.2.0 | HTTP security headers (CSP, XSS protection, HSTS) |
| **Multer** | ^2.0.2 | Multipart form-data parsing for file uploads |
| **Supabase JS** | ^2.97.0 | Cloud file storage for materials and quiz images |

### 5.2 Frontend

| Technology | Version | Rationale |
|------------|---------|-----------|
| **React** | 18.2.0 | Component-based UI with hooks and concurrent rendering |
| **React Router** | 6.21.1 | Declarative client-side routing with nested layouts |
| **Axios** | ^1.7.9 | HTTP client with interceptors for auto-auth and 401 handling |
| **Reactstrap** | 8.10.0 | Bootstrap 4 components as React components |
| **KaTeX** | ^0.16.33 | Fast, server-side-renderable LaTeX math typesetting |
| **Sass/SCSS** | 1.69.5 | CSS preprocessor for Argon Dashboard theme customization |

### 5.3 Testing & DevOps

| Technology | Version | Purpose |
|------------|---------|---------|
| **Jest** | ^29.7.0 | Test runner with mocking, assertions, coverage |
| **ts-jest** | ^29.3.0 | TypeScript preprocessor for Jest |
| **Vercel** | — | Serverless deployment for both frontend and API |
| **ts-node-dev** | ^2.0.0 | Hot-reload dev server for TypeScript |

---

## 6. Database Design

### 6.1 Schema Overview

The database consists of **20 tables** organized across **5 domains**, plus **1 materialized view**, **10 triggers**, and **30+ indexes**.

```
┌──────────────────────────────────────────────────────┐
│                   IDENTITY DOMAIN                    │
│  roles ← user_roles → users                         │
└────────────┬─────────────────────────────────────────┘
             │ user_id references
             ▼
┌──────────────────────────────────────────────────────┐
│                   COURSES DOMAIN                     │
│  courses → subjects → topics                         │
│            ↕              ↕                           │
│  subject_teachers    subject_enrollments              │
└────────────┬─────────────────────────────────────────┘
             │ subject_id / topic_id references
             ▼
┌──────────────────────────────────────────────────────┐
│                   CONTENT DOMAIN                     │
│  quizzes → quiz_sets → questions → options           │
│  assignments    subject_materials                     │
└────────────┬─────────────────────────────────────────┘
             │ quiz_id / assignment_id references
             ▼
┌──────────────────────────────────────────────────────┐
│                   ACTIVITY DOMAIN                    │
│  quiz_attempts → attempt_answers                     │
│  assignment_submissions    student_progress           │
└──────────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────────────────────────────────┐
│                   DELIVERY DOMAIN                    │
│  sessions → session_recurrence                       │
└──────────────────────────────────────────────────────┘
```

### 6.2 Key Design Decisions

**UUID Primary Keys:**
All tables use `UUID` primary keys generated via `gen_random_uuid()` (from the `pgcrypto` extension). This enables:
- Safe client-side ID generation for optimistic UI
- No sequential ID enumeration attacks
- Distributed insert capability without coordination

**Database-Level Authorization:**
Two custom trigger functions enforce that only assigned teachers (or admins) can create quizzes or sessions for a subject:
- `fn_quiz_teacher_check` — Fires before INSERT on `quizzes`
- `fn_session_teacher_check` — Fires before INSERT on `sessions`

This provides a **defense-in-depth** layer: even if application-level RBAC is bypassed, the database rejects unauthorized inserts.

**Unique Partial Index for Answer Correctness:**
```sql
CREATE UNIQUE INDEX idx_one_correct_per_question
  ON options (question_id) WHERE is_correct = true;
```
This PostgreSQL partial unique index guarantees at the database level that **exactly one option per question** can be marked as correct — eliminating an entire class of data integrity bugs.

**Automatic Timestamp Management:**
A shared trigger function `fn_set_updated_at()` is applied to all mutable tables, auto-updating the `updated_at` column on every UPDATE without application code involvement.

### 6.3 Database View

**`v_session_dashboard`** — A complex view joining sessions, subjects, courses, users, and recurrence data. It computes a derived `display_status` field:
- `'live'` — Session is currently in progress
- `'today'` — Scheduled for today
- `'tomorrow'` — Scheduled for tomorrow
- `'scheduled'` — Scheduled for a future date

This offloads display logic to SQL, keeping the API layer thin.

---

## 7. Backend Engineering

### 7.1 Raw SQL Philosophy

A deliberate decision was made to use **raw SQL with parameterized queries** instead of an ORM (e.g., Prisma, TypeORM, Drizzle). The rationale:

| Factor | Raw SQL Advantage |
|--------|-------------------|
| **Transparency** | Every query is visible and auditable; no hidden N+1 problems |
| **Performance** | Hand-tuned queries with JOINs, CTEs, window functions as needed |
| **PostgreSQL features** | Full access to triggers, partial indexes, custom functions, array aggregations |
| **Type safety** | Generic `query<T>()` helper returns typed results without ORM overhead |
| **Debugging** | Errors map directly to SQL; no ORM abstraction layer to debug through |

The DB access layer (`config/db.ts`) exposes three helpers:

```typescript
query<T>(sql, params)                // Standard query → T[]
queryWithClient<T>(client, sql, params)  // Use inside transactions
withTransaction<T>(fn)               // BEGIN → fn(client) → COMMIT/ROLLBACK
```

Connection pooling is configured with **5 max connections**, **40s idle timeout**, and **20s connection timeout**, with SSL enforced in production via `rejectUnauthorized: false`.

### 7.2 Error Handling Pattern

The application uses a **structured error object** pattern:

```typescript
throw { statusCode: 401, message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' };
```

The global `errorHandler` middleware catches all errors and shapes them into a consistent response format:

```json
{
  "error": {
    "message": "Invalid credentials",
    "code": "INVALID_CREDENTIALS"
  }
}
```

In production, **all 5xx error messages are masked** to `"Internal server error"` to prevent information leakage.

### 7.3 Request Validation

All incoming request bodies are validated using **Zod schemas** through a reusable `validateBody(schema)` middleware:

```typescript
// In route file:
router.post('/login', validateBody(loginSchema), authController.login);
```

This ensures:
- Invalid requests are rejected before reaching business logic
- Request bodies are automatically **stripped of unknown fields**
- Type-safe parsed data is available to controllers
- Field-level error details are returned in the 400 response

### 7.4 Service Layer Patterns

Services contain all business logic and follow these patterns:

**Transaction wrapping** for multi-step operations:
```typescript
// Example: createQuiz inserts quiz + questions + options atomically
const result = await withTransaction(async (client) => {
  const quiz = await queryWithClient(client, insertQuizSQL, params);
  for (const q of questions) {
    const question = await queryWithClient(client, insertQuestionSQL, qParams);
    for (const opt of q.options) {
      await queryWithClient(client, insertOptionSQL, optParams);
    }
  }
  return quiz;
});
```

**Typed error codes** for client-side error handling:
```
INVALID_CREDENTIALS, ACCOUNT_DISABLED, ROLE_DENIED,
INVALID_REFRESH_TOKEN, NOT_ENROLLED, QUIZ_NOT_PUBLISHED,
MAX_ATTEMPTS_REACHED, HAS_PARTIAL_ATTEMPT, FORBIDDEN,
WRONG_PASSWORD, TOO_SHORT
```

---

## 8. Frontend Engineering

### 8.1 Application Layout

The frontend uses a **dual-layout** architecture:

| Layout | Route Prefix | Purpose |
|--------|-------------|---------|
| **AuthLayout** | `/auth/*` | Public pages (Login, Register) |
| **AdminLayout** | `/admin/*` | All authenticated pages (dashboard, classes, quizzes, etc.) |

The `AdminLayout` includes:
- **Sidebar** — Dynamic navigation based on user role; courses expand to show subjects
- **AdminNavbar** — Top bar with user info and session expiry banner
- **Content area** — Renders matched route component

### 8.2 Auth State Management

Authentication state is stored in **localStorage** (not React Context) for persistence across page reloads:

| Key | Value |
|-----|-------|
| `accessToken` | JWT access token (15 min TTL) |
| `refreshToken` | JWT refresh token (7 day TTL) |
| `role` | Active role (admin/teacher/student) |
| `user` | Serialized user object |

The `ProtectedRoute` component checks for `accessToken` presence and redirects to `/auth/login` if absent. A `SessionExpiryBanner` component warns users when their token is about to expire.

### 8.3 HTTP Client

An Axios instance (`utils/http.js`) is configured with:
- **Base URL** from `REACT_APP_API_URL` environment variable
- **Request interceptor** that auto-attaches `Authorization: Bearer <token>` headers
- **Response interceptor** that redirects to login on 401 responses (except for auth endpoints)

### 8.4 Role-Based UI Rendering

Routes define a `roles` array specifying which roles can access them:

```javascript
{ path: '/admin-users', component: AdminUsers, roles: ['ADMIN'] }
{ path: '/sessions',    component: Sessions,   roles: ['TEACHER', 'ADMIN'] }
{ path: '/classes',     component: Classes,    roles: ['STUDENT'] }
```

The `RoleBasedRoute` component normalizes role strings to lowercase for comparison against the backend's lowercase token values, preventing case-sensitivity bugs.

### 8.5 LaTeX Rendering

Quiz questions and options support mathematical notation via a custom `LatexRenderer` component built on **KaTeX**. This enables:
- Inline math expressions: `$x^2 + y^2 = z^2$`
- Display-mode equations for complex formulas
- Mixed text and math content in quiz questions

---

## 9. Authentication & Authorization

### 9.1 JWT Token Architecture

The system uses a **dual-token strategy**:

| Token | TTL | Secret | Purpose |
|-------|-----|--------|---------|
| **Access Token** | 15 minutes | `JWT_SECRET` | API request authorization |
| **Refresh Token** | 7 days | `JWT_REFRESH_SECRET` | Silent token renewal |

**Token Payload:**
```typescript
{
  userId:     string,
  email:      string,
  firstName:  string,
  lastName:   string,
  roles:      string[],   // all assigned roles
  activeRole: string      // currently selected role
}
```

### 9.2 Multi-Role Login Flow

Users can have **multiple roles** (e.g., a user who is both a teacher and an admin). The login flow allows **role selection at login time**:

```
POST /api/auth/login
{
  "email":    "user@example.com",
  "password": "SecurePass@123",
  "loginAs":  "teacher"        ← selects active role
}
```

**Security checks (in order):**
1. ✅ User exists (by email + JOIN to fetch roles)
2. ✅ Password matches (bcrypt compare)
3. ✅ Account is active (`is_active = true`)
4. ✅ Requested role is assigned to the user

**Critical: password verification happens BEFORE the `is_active` check.** This prevents timing-based user enumeration — an inactive account with a wrong password returns `INVALID_CREDENTIALS`, not `ACCOUNT_DISABLED`.

### 9.3 Middleware Chain

Every protected route passes through:

```typescript
router.use(authMiddleware);           // 1. Verify JWT → set req.user
router.use(rbacMiddleware(['admin'])); // 2. Check role is allowed
```

The `authMiddleware` extracts the Bearer token, verifies it against `JWT_SECRET`, and sets:
```typescript
req.user = { id: payload.userId, role: payload.activeRole }
```

The `rbacMiddleware` factory returns a middleware that checks `req.user.role` against the provided allowed-roles array and returns 403 if unauthorized.

### 9.4 Defense in Depth

Authorization is enforced at **three levels**:

| Level | Mechanism |
|-------|-----------|
| **Frontend** | `ProtectedRoute` + `RoleBasedRoute` hide unauthorized pages |
| **API** | `authMiddleware` + `rbacMiddleware` reject unauthorized requests |
| **Database** | Trigger functions reject unauthorized quiz/session inserts |

---

## 10. Key Feature Deep Dives

### 10.1 Quiz System

The quiz system is the most complex module (**702 lines** of service code) supporting two distinct modes:

**Test Mode:**
- Timed quizzes with `duration_minutes`
- Maximum attempt limits (`max_attempts`)
- Auto-scoring on submission
- Pass/fail determination based on `passing_score`
- Availability windows (`available_from` / `available_until`)

**Practice Mode:**
- Untimed, no pass/fail
- Resume capability — students can save progress and resume later
- Partial attempt tracking with `last_question_index`
- Saved answers preserved across sessions

**Quiz Lifecycle:**
```
[Draft] → publish → [Published] → student starts → [In Progress]
  → student saves (practice only) → [Partial] → resume → [In Progress]
  → student submits → [Submitted] (auto-scored)
```

**Question Features:**
- Multiple choice (A/B/C/D options)
- LaTeX support in both questions and options
- Image attachments for questions and explanations
- Difficulty levels (easy/medium/hard) with visual indicators
- Per-question marks and order indexing
- Topic tagging for granular content organization

**Scoring Algorithm:**
```
For each submitted answer:
  1. Look up correct option for the question
  2. Compare selected_option_id with correct_option_id
  3. Award marks if correct, 0 if incorrect
  4. Calculate: score_pct = (marks_obtained / total_marks) × 100
  5. Determine: is_passed = score_pct >= passing_score
```

### 10.2 Live Class / Session System

Sessions represent **live classes** conducted via Zoom:

**Session Creation Flow:**
1. Teacher selects a subject and provides title, date, start time
2. Backend auto-calculates `end_time` as `start_time + 90 minutes`
3. If Zoom credentials are configured, a Zoom meeting is auto-created via OAuth
4. Session is stored with `zoom_meeting_id`, `zoom_start_url`, and `meeting_link`

**Status Derivation:**
The service layer computes display status from raw DB values:

| DB Status | Date Logic | Display Status |
|-----------|-----------|----------------|
| `live` | — | **LIVE** |
| `completed` | — | **COMPLETED** |
| `scheduled` | Past date | **COMPLETED** |
| `scheduled` | Today | **SCHEDULED** (or **TODAY**) |
| `scheduled` | Future | **SCHEDULED** |

**Zoom Integration:**
- Server-to-Server OAuth with Account Credentials grant type
- Access token cached and refreshed automatically
- Meeting creation: Type 2 (scheduled), 60-minute default, waiting room enabled
- Zoom credentials validated at server startup; mandatory in production

### 10.3 Assignment Workflow

```
Teacher creates assignment
  → [Draft / Published]
    → Student submits (with optional file attachment)
      → Late detection: is_late = (now > due_date)
        → Teacher grades: marks_awarded + feedback
          → Status: submitted → graded → returned
```

**Key features:**
- Auto-detection of late submissions by comparing submission time to due date
- Upsert semantics: students can resubmit before grading
- Per-assignment submission count tracked for teachers
- File attachments stored in Supabase Storage

### 10.4 Progress & Reporting

**Student Progress Dashboard:**
- Weekly activity chart (7-day rolling window)
- Per-day breakdown: quizzes taken, correct/incorrect answers, time spent
- Quiz history with score percentages and pass/fail status
- Per-subject progress: quizzes attempted, average score, assignments submitted

**Teacher Report Dashboard:**
- Per-subject student list with performance metrics
- Individual student: quizzes attempted/passed, average score, best score
- Assignment submission and grading metrics
- Last activity timestamp for engagement monitoring

### 10.5 Content Hierarchy

```
Course (e.g., "SAT Prep")
  └── Subject (e.g., "Mathematics")
        ├── Topics (e.g., "Algebra", "Geometry")
        │     ├── Questions (tagged by topic)
        │     └── Materials (organized by topic)
        ├── Quizzes
        ├── Assignments
        └── Sessions (live classes)
```

This hierarchical model supports:
- Admin manages courses and subjects
- Teachers are **assigned to subjects** (many-to-many)
- Students are **enrolled in subjects** (with status tracking)
- Content (quizzes, assignments, materials) belongs to subjects
- Topics provide fine-grained content tagging within subjects

---

## 11. Testing Strategy

### 11.1 Test Architecture

The project uses **Jest** with **ts-jest** for TypeScript support. Tests follow a **unit testing** strategy focused on the service layer:

```
server/src/__tests__/
├── setup.ts                          # Env vars set before tests
├── middlewares/
│   ├── auth.middleware.test.ts        # JWT verification
│   ├── rbac.middleware.test.ts        # Role-based access
│   ├── validate.middleware.test.ts    # Zod validation
│   └── error.middleware.test.ts       # Error response shaping
├── utils/
│   ├── jwt.test.ts                   # Token sign/verify
│   └── password.test.ts              # Hash/compare
└── modules/
    ├── auth.service.test.ts          # Login + refresh flows
    ├── classes.service.test.ts       # Session management
    ├── quiz.service.test.ts          # Quiz lifecycle
    ├── admin.service.test.ts         # Admin operations
    ├── courses.service.test.ts       # Course listing
    ├── topics.service.test.ts        # Topic CRUD
    ├── assignment.service.test.ts    # Assignment workflow
    ├── materials.service.test.ts     # Material management
    ├── progress.service.test.ts      # Progress tracking
    └── profile.service.test.ts       # Profile operations
```

### 11.2 Testing Approach

**Database mocking:** All service tests mock the `query` and `withTransaction` functions from `config/db.ts` using `jest.mock()`. This enables:
- Fast test execution (no database required)
- Deterministic results (no test data setup/teardown)
- Isolated unit testing of business logic

**Example pattern:**
```typescript
jest.mock('../../config/db');
const mockQuery = query as jest.MockedFunction<typeof query>;

it('returns active topics for the subject', async () => {
  mockQuery.mockResolvedValueOnce([topicRow]);
  const result = await getTopicsBySubject('sub-uuid');
  expect(result).toHaveLength(1);
});
```

**Middleware testing:** Middleware functions are tested with mock `req`, `res`, and `next` objects, verifying:
- Correct status codes for various error conditions
- Proper `req.user` population for valid tokens
- Response body structure

### 11.3 Test Coverage

| Category | Test Files | Tests | What's Covered |
|----------|-----------|-------|----------------|
| Middleware | 4 | ~25 | Auth, RBAC, validation, error handling |
| Utilities | 2 | ~12 | JWT sign/verify, password hash/compare |
| Services | 10 | ~120 | All service functions, happy + error paths |
| **Total** | **16** | **157** | — |

### 11.4 Configuration

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src/__tests__'],
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
```

A dedicated `tsconfig.test.json` extends the base config and adds Jest + Node type definitions, while a nested `src/__tests__/tsconfig.json` ensures the IDE (VS Code) properly resolves Jest globals like `describe`, `it`, `expect`, and `jest.fn()`.

---

## 12. Deployment & DevOps

### 12.1 Deployment Architecture

Both tiers are deployed on **Vercel**:

| Tier | Deployment | Configuration |
|------|-----------|---------------|
| **Frontend** | Vercel Static | SPA rewrite: all routes → `index.html` |
| **Backend** | Vercel (separate) | Express app as serverless function |

### 12.2 Environment Management

The server supports three environments with automatic env file selection:

| Environment | Env File | Trigger |
|-------------|----------|---------|
| Development | `.env.development` | `NODE_ENV=development` |
| Test | `.env.test` | `NODE_ENV=test` |
| Production | `.env.production` | `NODE_ENV=production` |

**Required variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — Token signing secrets
- Zoom credentials (mandatory in production): `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_EMAIL`
- `ALLOWED_ORIGINS` — Comma-separated CORS whitelist for production

### 12.3 Security Hardening

| Measure | Implementation |
|---------|---------------|
| **Helmet** | CSP headers, XSS protection, HSTS, frame options |
| **CORS** | Strict origin whitelist in production; localhost only in development |
| **Rate limiting** | Express rate limiter on all API routes |
| **SSL** | Enforced on PostgreSQL connections in production |
| **Password hashing** | bcrypt with default salt rounds |
| **Input validation** | Zod schemas on all write endpoints |
| **Token separation** | Different secrets for access vs. refresh tokens |
| **Error masking** | 5xx messages hidden in production |
| **DB authorization** | Trigger-level enforcement for quiz/session creation |

---

## 13. Metrics & Scale

### 13.1 Codebase Metrics

| Metric | Count |
|--------|-------|
| Total database tables | 20 |
| Database indexes | 30+ |
| Database triggers | 10 |
| API route modules | 11 |
| Backend service files | 11 |
| Backend middleware files | 5 |
| Frontend views/pages | 20 |
| Frontend components | 12+ |
| Frontend routes | 18 |
| Unit test files | 16 |
| Unit test cases | 157 |
| Server dependencies (prod) | 11 |
| Client dependencies (prod) | 10 |

### 13.2 Performance Characteristics

| Aspect | Design |
|--------|--------|
| **DB connection pool** | Max 5 connections, 40s idle, 20s connect timeout |
| **JWT verification** | Synchronous; sub-millisecond per request |
| **Password hashing** | bcrypt default rounds (~10); 100-200ms per hash |
| **Query efficiency** | 30+ indexes covering all major access patterns |
| **Token TTL** | 15 min access / 7 day refresh — balances security and UX |

---

## 14. Challenges & Solutions

### Challenge 1: Multi-Role User Identity
**Problem:** Users could be both teachers and admins. How to handle a single user who needs different views and permissions depending on context?

**Solution:** Introduced the `loginAs` field in the login payload. The JWT encodes both `roles[]` (all assigned roles) and `activeRole` (the role selected at login). The middleware chain checks `activeRole` for authorization, while the frontend adapts the UI based on this value.

### Challenge 2: Quiz Answer Integrity
**Problem:** Ensuring exactly one correct answer per question across all code paths — creation, editing, and direct DB manipulation.

**Solution:** A PostgreSQL **partial unique index** (`WHERE is_correct = true`) on the `options` table enforces this constraint at the database level. Even if application logic has a bug, the database rejects any insert/update that would create a second correct answer.

### Challenge 3: Late Submission Detection
**Problem:** Determining whether an assignment submission is late when students may be in different timezones.

**Solution:** The server performs late detection at submission time by comparing `now()` against the assignment's `due_date`. Since `due_date` is stored as `TIMESTAMPTZ`, PostgreSQL handles timezone conversion automatically. The `is_late` boolean is computed server-side and stored with the submission.

### Challenge 4: Practice Quiz Resume
**Problem:** Students need to save progress in practice quizzes and resume later — but the attempt state must be consistent.

**Solution:** Introduced a `partial` status for quiz attempts, with `last_question_index` tracking progress. The `resumePractice` service validates the attempt is in `partial` status and belongs to a `practice`-type quiz before reactivating it. Saved answers are fetched from `attempt_answers` and returned as a map.

### Challenge 5: Zoom Meeting Lifecycle
**Problem:** Auto-creating Zoom meetings for every session without manual intervention, while handling OAuth token management.

**Solution:** The `zoom.service.ts` handles the full OAuth flow with server-to-server Account Credentials. Access tokens are cached and refreshed automatically. Meeting creation happens inside the session creation flow — if Zoom is configured, a meeting is created and its IDs/URLs are stored with the session record.

---

## 15. Lessons Learned

### 15.1 Architectural Decisions That Paid Off

1. **Raw SQL:** Having full visibility into every query prevented N+1 problems and made performance optimization straightforward. The trade-off of writing more boilerplate was worth the transparency.

2. **Module-per-feature structure:** Made the codebase navigable even at 11 modules. New developers can understand a feature by reading just three files (routes → controller → service).

3. **Database triggers for authorization:** Caught edge cases that application-level RBAC might miss. When a new API endpoint was added, the DB triggers still enforced the correct constraints.

4. **Separate tsconfig for tests:** Having `tsconfig.test.json` that extends the base config but includes Jest types, plus a nested `__tests__/tsconfig.json` for IDE support, eliminated the common "cannot find name 'describe'" problem without polluting production type definitions.

### 15.2 What Could Be Improved

1. **Integration tests:** The current suite is purely unit tests with mocked DB calls. Adding integration tests with a test database would catch SQL syntax errors and schema mismatches earlier.

2. **API documentation:** No OpenAPI/Swagger documentation exists. Adding auto-generated API docs from Zod schemas would improve developer onboarding.

3. **Frontend testing:** The React client has no test coverage. Adding React Testing Library tests for critical flows (login, quiz taking) would improve confidence in deployments.

4. **Caching layer:** Frequently accessed data (course lists, quiz metadata) could benefit from a Redis caching layer to reduce database load at scale.

5. **WebSocket for live features:** Session status updates and real-time notifications currently require polling. WebSocket support would enable true real-time functionality.

---

*© 2026 10xAccel. All rights reserved. This document is proprietary and confidential.*
