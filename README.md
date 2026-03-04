# 10xAccel — Learning Management System

An enterprise-grade LMS platform designed and built for an EdTech startup in 2026. Delivers a secure, scalable, and role-based digital learning ecosystem for **Administrators**, **Teachers**, and **Students**.

---

## Highlights

| Metric | Value |
|--------|-------|
| Database tables | 20 (UUID PKs, triggers, partial indexes) |
| API modules | 11 feature-based modules |
| Test suite | 157 tests across 16 suites — 100 % pass |
| User roles | Admin · Teacher · Student |
| Live classes | Zoom-integrated scheduling |
| Quiz engine | Test + Practice modes with LaTeX support |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Router 6, Axios, Reactstrap, Bootstrap 4, KaTeX, SCSS |
| **Backend** | Node.js ≥ 18, TypeScript 5, Express 4, Zod, JWT, bcrypt |
| **Database** | PostgreSQL 15+ (raw SQL, no ORM) — `pg` driver |
| **Storage** | Supabase Storage (materials & images) |
| **Integrations** | Zoom REST API (Server-to-Server OAuth) |
| **Testing** | Jest 29, ts-jest |
| **Deployment** | Vercel (frontend + API) |

---

## Project Structure

```
lms-platform/
│
├── client/                              # React 18 SPA (Create React App)
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── assets/                      # SCSS, fonts, images (Argon Dashboard)
│   │   ├── components/
│   │   │   ├── LatexRenderer.js         # KaTeX math rendering
│   │   │   ├── ProtectedRoute.js        # Auth guard
│   │   │   ├── SessionExpiryBanner.js   # Token expiry warning
│   │   │   ├── Dashboard/               # CalendarWidget, UpcomingClasses
│   │   │   ├── Headers/                 # Header, UserHeader
│   │   │   ├── Navbars/                 # AdminNavbar, AuthNavbar
│   │   │   ├── Sidebar/                 # Dynamic role-based sidebar
│   │   │   └── Footers/                 # AdminFooter, AuthFooter
│   │   ├── layouts/
│   │   │   ├── Admin.js                 # Authenticated layout (sidebar + navbar)
│   │   │   └── Auth.js                  # Public layout (login / register)
│   │   ├── views/
│   │   │   ├── admin/                   # AdminDashboard, AdminUsers, AdminCourses,
│   │   │   │                            # AdminSubjects, AdminSessions
│   │   │   ├── examples/               # Login, Classes, Sessions, Profile, Report,
│   │   │   │                            # Resources, Register, AdminLogin
│   │   │   ├── quiz/                    # QuizBuilder, QuizTaker, CourseQuiz
│   │   │   └── subject/                # SubjectPage, SubjectStudent, SubjectTeacher
│   │   ├── utils/
│   │   │   ├── api.js                   # apiUrl() helper
│   │   │   └── http.js                  # Axios instance + interceptors
│   │   ├── routes.js                    # All route definitions with role guards
│   │   └── index.js                     # App entry point
│   └── package.json
│
├── server/                              # TypeScript / Express REST API
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts                    # pg Pool — query(), withTransaction()
│   │   │   └── env.ts                   # Env-file loader + validation
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts        # JWT verification → req.user
│   │   │   ├── rbac.middleware.ts        # Role-based access control
│   │   │   ├── validate.middleware.ts    # Zod body validation
│   │   │   ├── error.middleware.ts       # Global error handler
│   │   │   └── rateLimit.middleware.ts   # Express rate limiter
│   │   ├── modules/                     # Feature-based modules
│   │   │   ├── admin/                   # Users, courses, subjects, enrollments
│   │   │   ├── auth/                    # Login (multi-role), token refresh
│   │   │   ├── classes/                 # Sessions, Zoom meetings, subject lists
│   │   │   ├── courses/                 # Course + subject grouping
│   │   │   ├── quiz/                    # Quiz CRUD, attempts, scoring
│   │   │   ├── assignment/              # Assignments, submissions, grading
│   │   │   ├── topics/                  # Topic CRUD under subjects
│   │   │   ├── materials/               # Subject materials / resources
│   │   │   ├── progress/                # Student progress + teacher reports
│   │   │   ├── profile/                 # Profile view/edit, password change
│   │   │   └── upload/                  # File upload → Supabase Storage
│   │   ├── services/
│   │   │   └── zoom.service.ts          # Zoom OAuth + meeting creation
│   │   ├── utils/
│   │   │   ├── jwt.ts                   # Access/refresh token sign & verify
│   │   │   └── password.ts              # bcrypt hash & compare
│   │   ├── __tests__/                   # Jest test suite (16 files, 157 tests)
│   │   │   ├── setup.ts                 # Env vars for test runner
│   │   │   ├── tsconfig.json            # IDE type resolution for tests
│   │   │   ├── middlewares/             # auth, rbac, validate, error tests
│   │   │   ├── utils/                   # jwt, password tests
│   │   │   └── modules/                 # Service-layer unit tests (10 modules)
│   │   ├── app.ts                       # Express app + route mounting
│   │   └── server.ts                    # Server entry point (port 4000)
│   ├── sql/
│   │   ├── schema.sql                   # Source-of-truth schema (20 tables)
│   │   ├── seed.sql                     # Sample data
│   │   ├── drop.sql                     # Teardown script
│   │   └── truncate.sql                 # Data-only reset
│   ├── jest.config.js                   # Jest + ts-jest configuration
│   ├── tsconfig.json                    # Production TypeScript config
│   ├── tsconfig.test.json               # Test TypeScript config (adds Jest types)
│   └── package.json
│
├── docs/
│   ├── CaseStudy_10xAccel_LMS.md       # Full engineering case study
│   ├── CaseStudy_Testing_Config.md      # Testing infra case study
│   ├── 10xAccel_Feature_Roadmap_CopilotPrompts.md
│   └── SUPABASE_BUCKET_SETUP.md
│
├── CLAUDE.md                            # AI pair-programming guidance
├── vercel.json                          # Root Vercel deployment config
├── LICENSE
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 and **npm** ≥ 9
- **PostgreSQL** 15+
- (Optional) Zoom Server-to-Server OAuth credentials
- (Optional) Supabase project for file storage

### 1. Clone the repository

```bash
git clone https://github.com/Kishor-bharti/lms-platform.git
cd lms-platform
```

### 2. Set up the database

```bash
psql $DATABASE_URL -f server/sql/schema.sql
psql $DATABASE_URL -f server/sql/seed.sql      # optional sample data
```

### 3. Configure the server

Create `server/.env.development`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/lms_dev
JWT_SECRET=your-jwt-secret-at-least-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-at-least-32-chars
PORT=4000
```

### 4. Install dependencies & run

```bash
# Terminal 1 — Server
cd server
npm install
npm run dev              # Express API on http://localhost:4000

# Terminal 2 — Client
cd client
npm install --legacy-peer-deps
npm start                # React app on http://localhost:3000
```

### 5. Run tests

```bash
cd server
npm test                 # 157 tests, 16 suites
npm run test:coverage    # With coverage report
```

---

## Commands Reference

### Client (`cd client`)

| Command | Description |
|---------|-------------|
| `npm start` | Dev server on `:3000` |
| `npm run build` | Production build |
| `npm test` | Run tests |
| `npm run lint` | ESLint |

### Server (`cd server`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server with hot reload on `:4000` |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled `dist/server.js` |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Tests with coverage report |
| `npm run type-check` | `tsc --noEmit` — type-check only |
| `npm run seed` | Seed the database |
| `npm run migrate` | Run schema migrations |
| `npm run lint` | ESLint for `.ts` files |

---

## Architecture

### Backend — Module-per-Feature

Each domain is a self-contained module:

```
server/src/modules/<feature>/
├── <feature>.routes.ts        # Express Router + middleware chain
├── <feature>.controller.ts    # Request/response parsing
├── <feature>.service.ts       # Business logic + DB queries
└── <feature>.types.ts         # TypeScript interfaces (optional)
```

### Request Pipeline

```
Client → Helmet → CORS → Rate Limiter → Router
  → authMiddleware (JWT verify → req.user)
  → rbacMiddleware (role check)
  → validateBody (Zod schema)
  → Controller → Service → query() → PostgreSQL
```

### Authentication

- **Dual JWT tokens:** access (15 min) + refresh (7 days)
- **Multi-role login:** `POST /api/auth/login` with `loginAs` field for role selection
- **3-layer authorization:** Frontend guards → API middleware → DB triggers

### Database

- **20 tables** across 5 domains (Identity, Courses, Content, Activity, Delivery)
- **UUID primary keys** via `gen_random_uuid()`
- **Authorization triggers** on quiz and session creation
- **Partial unique index** ensuring one correct option per question
- **30+ indexes** covering all major query patterns

---

## API Modules

| Module | Prefix | Description |
|--------|--------|-------------|
| Auth | `/api/auth` | Login with role selection, token refresh |
| Classes | `/api/classes` | Subject lists, session CRUD, Zoom integration |
| Courses | `/api/courses` | Course listing with subject grouping |
| Admin | `/api/admin` | User CRUD, enrollments, course/subject management |
| Quiz | `/api/quizzes` | Quiz CRUD, questions, attempts, auto-scoring |
| Assignment | `/api/assignments` | Assignment CRUD, submissions, grading |
| Progress | `/api/progress` | Weekly activity, quiz history, reports |
| Topics | `/api/subjects/:id/topics` | Topic CRUD nested under subjects |
| Materials | `/api/materials` | Subject material management |
| Profile | `/api/profile` | Profile view/update, password change |
| Upload | `/api/upload` | File upload to Supabase Storage |

---

## Testing

The server has **157 unit tests** across **16 test suites**, covering:

- **4 middleware tests** — auth, RBAC, validation, error handling
- **2 utility tests** — JWT sign/verify, password hash/compare
- **10 service tests** — all backend modules (auth, classes, quiz, admin, courses, topics, assignments, materials, progress, profile)

All service tests use **mocked DB calls** (`jest.mock`) for fast, deterministic, database-free execution.

```bash
cd server && npm test
# Test Suites: 16 passed, 16 total
# Tests:       157 passed, 157 total
```

---

## Documentation

| Document | Path |
|----------|------|
| Full Engineering Case Study | `docs/CaseStudy_10xAccel_LMS.md` |
| Testing Infrastructure Case Study | `docs/CaseStudy_Testing_Config.md` |
| Feature Roadmap & Prompts | `docs/10xAccel_Feature_Roadmap_CopilotPrompts.md` |
| Supabase Bucket Setup | `docs/SUPABASE_BUCKET_SETUP.md` |
| AI Pair-Programming Guide | `CLAUDE.md` |

---

## License

This is a **proprietary software product**.
All rights are reserved © 2026.