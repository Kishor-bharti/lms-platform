# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Enterprise LMS platform with two independently runnable sub-projects:
- `client/` — React 18 SPA (Create React App)
- `server/` — TypeScript/Express REST API backed by PostgreSQL

## Commands

### Client (`cd client`)
```bash
npm start          # Dev server on :3000
npm run build      # Production build
npm test           # Run tests
npm run lint       # ESLint
npm run build:scss # Compile + minify SCSS
```

### Server (`cd server`)
```bash
npm run dev        # Dev server with ts-node-dev hot reload (port 4000)
npm run build      # Compile TypeScript to dist/
npm start          # Run compiled dist/server.js
npm run type-check # tsc --noEmit (type-check without building)
npm run lint       # ESLint for .ts files
npm run seed       # Seed database (ts-node scripts/seed.ts)
npm run migrate    # Run migrations (ts-node src/scripts/migrations.ts)
```

## Architecture

### Server

**No ORM — raw SQL only.** All DB access goes through helpers in `server/src/config/db.ts`:
- `query<T>(sql, params)` — standard query, returns `T[]`
- `queryWithClient<T>(client, sql, params)` — use inside `withTransaction`
- `withTransaction<T>(fn)` — wraps `fn` in BEGIN/COMMIT/ROLLBACK

**Module structure** (`server/src/modules/<feature>/`): each module has `.routes.ts`, `.controller.ts`, `.service.ts`, and optionally `.types.ts`. Business logic lives in services; controllers only parse req/res and call services.

**Middleware chain for protected routes:**
```ts
router.use(authMiddleware);               // verifies JWT, sets req.user = { id, role }
router.use(rbacMiddleware(['admin']));    // role check — roles are lowercase
```

**Request validation** uses Zod + `validateBody(schema)` middleware (defined in `middlewares/validate.middleware.ts`). Add validation in the route file before the controller handler.

**Error handling:** throw an object with `statusCode`, `message`, and optional `code` / `details`. The global `errorHandler` in `middlewares/error.middleware.ts` shapes the response as `{ error: { message, code } }`. In production, 5xx messages are always `"Internal server error"`.

**JWT tokens:** access token (15 min), refresh token (7 days). Payload shape defined in `utils/jwt.ts`:
```ts
{ userId, email, firstName, lastName, roles: string[], activeRole: string }
```
`req.user.role` is the `activeRole` from the token (lowercase: `'admin'` | `'teacher'` | `'student'`).

**Login flow:** client sends `{ email, password, loginAs }` to `POST /api/auth/login`. The `loginAs` field selects the `activeRole` encoded in the JWT, allowing multi-role users to choose their context.

**Zoom integration:** `server/src/services/zoom.service.ts` handles OAuth token + meeting creation. Requires `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_EMAIL` env vars (mandatory in production, validated at startup).

**Environment files** (server): `.env.development`, `.env.test`, `.env.production` — selected automatically by `NODE_ENV`. Minimum required: `DATABASE_URL`, `JWT_SECRET`.

### Client

**Auth state** is stored in `localStorage` — not React Context. Keys: `accessToken`, `refreshToken`, `role`, `user`. The `ProtectedRoute` component checks for `accessToken` and redirects to `/auth/login` if absent.

**HTTP client** (`client/src/utils/http.js`): Axios instance pre-configured with `API_BASE` (from `REACT_APP_API_URL` env var). Interceptors auto-attach `Authorization: Bearer <accessToken>` and redirect to login on 401 (except for login routes themselves).

**Routing** (`client/src/routes.js`): All routes render inside either `/admin/*` (authenticated, `AdminLayout`) or `/auth/*` (public, `AuthLayout`). Route entries have an optional `roles` array (uppercase: `'ADMIN'`, `'TEACHER'`, `'STUDENT'`) and `hidden: true` to hide from the sidebar. `RoleBasedRoute` normalises role strings to lowercase for comparison against the backend's lowercase tokens.

**Frontend env var:** `REACT_APP_API_URL` sets the API base URL. No trailing slash — the `apiUrl()` helper in `utils/api.js` handles path joining.

### Database

Schema source of truth: `server/sql/schema.sql`. Domains:
1. **Identity** — `users`, `roles`, `user_roles`
2. **Courses** — `courses`, `subjects`, `subject_teachers`, `subject_enrollments`
3. **Content** — `quizzes`, `quiz_sets`, `questions`, `options`, `assignments`, `subject_materials`
4. **Activity** — `quiz_attempts`, `attempt_answers`, `assignment_submissions`, `student_progress`
5. **Delivery** — `sessions`, `session_recurrence`

All primary keys are UUIDs (`gen_random_uuid()`). DB-level triggers enforce `updated_at` auto-update and authorization checks (teachers can only create quizzes/sessions for their assigned subjects).

Useful views: `v_session_dashboard`, `v_teacher_dashboard`, `v_student_report`, `v_subject_resources`.

Run the full schema: `psql $DATABASE_URL -f server/sql/schema.sql`. Incremental migrations are in `server/sql/migrations/`.
