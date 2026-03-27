# Scalability, Concurrency & Reliability Audit — 10xAccel LMS

> **Industry terms for these problem categories:**
>
> | What you see in this doc | Industry name |
> |---|---|
> | Zoom call inside DB transaction | **Long-held lock / Lock contention** |
> | Loop with one DB call per item | **N+1 Query Problem** |
> | Two writers overwriting each other | **Lost Update Anomaly** (class of *race condition*) |
> | Pool max: 5 under load | **Connection pool exhaustion** / **resource starvation** |
> | Read endpoint mutating data | **Command-Query Separation (CQS) violation** |
> | No LIMIT on queries | **Unbounded query** / **full table scan risk** |
> | Tokens that can't be revoked | **Broken authentication** (OWASP A07) |
> | Repeated identical API calls | **Thundering herd** / **polling storm** |
> | One slow component failing everything | **Cascading failure** / **lack of bulkhead** |
> | No retry / timeout on external call | **Missing resilience pattern** (Circuit Breaker) |
> | Upload with no size cap | **Unrestricted file upload** (OWASP A04) |
> | No rate limiting | **Denial of Service (DoS) surface** |
> | Concurrent token refresh across tabs | **TOCTOU race** (Time-of-Check / Time-of-Use) |

This document is a full audit of issues found by reading the production source code.
Each section names the problem, shows the exact bad code, explains what breaks and when, and gives a concrete fix.

---

## Table of Contents

1. [Connection Pool Exhaustion](#1-connection-pool-exhaustion)
2. [Long-held Lock During External HTTP Call](#2-long-held-lock-during-external-http-call)
3. [Lost Update — Concurrent Quiz Editing](#3-lost-update--concurrent-quiz-editing)
4. [N+1 Query — Content Assignment Bulk Insert](#4-n1-query--content-assignment-bulk-insert)
5. [N+1 Query — Material Reordering](#5-n1-query--material-reordering)
6. [N+1 Query — Quiz Question & Option Insertion](#6-n1-query--quiz-question--option-insertion)
7. [CQS Violation — Side-effect in a GET Request](#7-cqs-violation--side-effect-in-a-get-request)
8. [Unbounded Queries — Missing LIMIT / Pagination](#8-unbounded-queries--missing-limit--pagination)
9. [Missing Database Indexes](#9-missing-database-indexes)
10. [JWT Refresh — No Rotation or Invalidation](#10-jwt-refresh--no-rotation-or-invalidation)
11. [Client-Side Token Refresh Race (Multi-Tab)](#11-client-side-token-refresh-race-multi-tab)
12. [No Rate Limiting on Critical Endpoints](#12-no-rate-limiting-on-critical-endpoints)
13. [Frontend Polling Storms](#13-frontend-polling-storms)
14. [File Upload — No Timeout, No Size Guard](#14-file-upload--no-timeout-no-size-guard)
15. [No Circuit Breaker Around Zoom API](#15-no-circuit-breaker-around-zoom-api)
16. [Quiz Answer Saves — No Debounce](#16-quiz-answer-saves--no-debounce)
17. [Priority Roadmap](#17-priority-roadmap)

---

## 1. Connection Pool Exhaustion

**Category:** Resource Starvation
**Severity:** 🔴 Critical
**File:** `server/src/config/db.ts`

### The bad code

```typescript
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,                        // ← only 5 simultaneous DB connections
  idleTimeoutMillis: 40000,      // ← idle connections held 40 s
  connectionTimeoutMillis: 20000,// ← callers wait 20 s before error
});
```

### What breaks and when

Every in-flight HTTP request holds a pool connection for its entire lifetime.
With `max: 5`, the 6th simultaneous request queues and waits up to 20 s.
Under load this cascades — queued requests pile up, Node's event loop fills with pending promises, and the server appears frozen even though nothing is crashed.

**Real scenario:**
50 students all submit a quiz at 3:00 PM (common in a class). Each submission:
1. Opens a connection for the INSERT into `quiz_attempts`
2. Loops inserting each answer into `attempt_answers`
3. Releases connection only after all inserts finish

5 connections are taken immediately. The remaining 45 students wait.
Each waits up to 20 s, then gets a `connection timeout` error.
Their quiz submission is lost.

### Fix

```typescript
// server/src/config/db.ts
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 30,                      // tune to (available DB connections - 5 headroom)
  idleTimeoutMillis: 10000,     // release idle connections quickly
  connectionTimeoutMillis: 5000,// fail fast — don't leave users hanging 20 s
  ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

Also run the Node process in **cluster mode** (PM2 or Node's `cluster` module) so each CPU core runs its own pool:

```javascript
// ecosystem.config.js (PM2)
module.exports = {
  apps: [{
    name: 'lms-server',
    script: 'dist/server.js',
    instances: 'max',   // one process per CPU core
    exec_mode: 'cluster',
  }]
};
```

Each worker process gets its own pool of 30, so on a 4-core machine you get 120 total connections.

---

## 2. Long-held Lock During External HTTP Call

**Category:** Lock Contention / Cascading Failure
**Severity:** 🔴 Critical
**File:** `server/src/modules/classes/classes.service.ts` — `startSessionById`

### The bad code

```typescript
return withTransaction(async (client) => {
  // 1. Lock the sessions row
  const rows = await queryWithClient(client,
    `SELECT ... FROM sessions WHERE id = $1 FOR UPDATE`, [sessionId]
  );

  // 2. ← EXTERNAL HTTP CALL WHILE THE ROW IS LOCKED
  const accessToken = await getZoomAccessToken();       // network call
  const { joinUrl } = await createZoomMeeting({...});   // network call

  // 3. Write, then finally release lock
  await queryWithClient(client, `UPDATE sessions SET meeting_link=$1...`, [...]);
});
```

### What breaks and when

A PostgreSQL `FOR UPDATE` lock blocks every other transaction that tries to read
or write that row. The Zoom API typically takes 200–800 ms; under degraded
conditions it can take 5–30 s or time out entirely.

**Real scenario:**
- Teacher A starts session → lock acquired → Zoom API is slow (3 s)
- Teacher B tries to complete a *different* session on the same subject →
  their query hits the same row → blocked for 3 s
- 10 teachers all starting sessions simultaneously → 10 Zoom calls in series
  through the lock queue → last teacher waits 30 s → timeout error → session
  never starts for them

If Zoom is down: the lock is held until the DB `statement_timeout`, which can
be minutes. The entire sessions table is effectively locked.

### Fix

Move the Zoom API call **outside** the transaction. Only hold the lock for pure DB work.

```typescript
export async function startSessionById(sessionId, teacherId, role) {

  // Phase 1 — short transaction: validate, mark status 'starting'
  const existing = await withTransaction(async (client) => {
    const rows = await queryWithClient(client,
      `SELECT ... FROM sessions WHERE id = $1 FOR UPDATE`, [sessionId]
    );
    if (!rows[0]) throw new Error('Session not found');
    if (rows[0].status === 'live') throw new Error('Already LIVE');
    // Optimistically mark it — prevents double-start without holding lock long
    await queryWithClient(client,
      `UPDATE sessions SET status='starting' WHERE id=$1`, [sessionId]
    );
    return rows[0];
  });

  // Phase 2 — external call, NO lock held
  let joinUrl, startUrl;
  try {
    const token = await getZoomAccessToken();
    ({ joinUrl, startUrl } = await createZoomMeeting({ ...existing }));
  } catch (err) {
    // Roll back the optimistic status change
    await query(`UPDATE sessions SET status='scheduled' WHERE id=$1`, [sessionId]);
    throw err;
  }

  // Phase 3 — short transaction: write Zoom URLs
  return withTransaction(async (client) => {
    const updated = await queryWithClient(client,
      `UPDATE sessions SET meeting_link=$1, zoom_start_url=$2, status='live'
       WHERE id=$3 RETURNING *`,
      [joinUrl, startUrl, sessionId]
    );
    return updated[0];
  });
}
```

Total lock-hold time drops from `~Zoom latency (800 ms+)` to `~2 ms`.

---

## 3. Lost Update — Concurrent Quiz Editing

**Category:** Race Condition / Lost Update Anomaly
**Severity:** 🔴 Critical
**File:** `server/src/modules/quiz/quiz.service.ts` — `updateQuiz`

### The bad code

```typescript
// Soft-delete ALL existing questions
await queryWithClient(client,
  `UPDATE questions SET is_active=false WHERE quiz_id=$1`, [data.quizId]
);

// Re-insert the entire payload from one teacher's browser state
for (const q of data.questions) {
  await queryWithClient(client, `INSERT INTO questions (...) VALUES (...)`, [...]);
}
```

### What breaks and when

This is a **full-replace pattern** — one save wipes everything and re-writes
from whatever the saving teacher last saw in their browser.

**Timeline:**

```
T=0   Teacher A opens quiz (Q1, Q2, Q3)
T=0   Teacher B opens quiz (Q1, Q2, Q3)
T=10s Teacher A adds Q4 → saves → DB now has Q1–Q4
T=12s Teacher B adds Q4 (different content) → saves
        → soft-deletes Q1–Q4 (including A's Q4)
        → inserts Q1, Q2, Q3, B's Q4
      Result: Teacher A's Q4 is permanently gone. No error, no warning.
```

This is called the **Lost Update Anomaly**. PostgreSQL transactions are ACID,
but ACID does not protect you from two *separate* transactions overwriting each other.

### Fix — Optimistic Locking

Add a `version` column to `quizzes` and make the client prove it has the latest version before saving.

```sql
-- migration
ALTER TABLE quizzes ADD COLUMN version INT NOT NULL DEFAULT 1;
```

```typescript
// service — update with version check
const result = await queryWithClient(client,
  `UPDATE quizzes SET title=$1, updated_at=now(), version=version+1
   WHERE id=$2 AND version=$3          -- only succeeds if version matches
   RETURNING id`,
  [data.title, data.quizId, data.clientVersion]
);

if (result.length === 0) {
  throw { statusCode: 409, message: 'Quiz was modified by someone else. Reload and try again.' };
}
```

```typescript
// client — pass the version you loaded with
await http.patch(`/api/quizzes/${quizId}`, {
  ...formData,
  version: quiz.version,   // the version you fetched
});

// handle 409
if (err.response?.status === 409) {
  alert('Someone else saved this quiz. Reloading latest version…');
  refetchQuiz();
}
```

---

## 4. N+1 Query — Content Assignment Bulk Insert

**Category:** N+1 Query Problem
**Severity:** 🟠 High
**File:** `server/src/modules/content-assignments/content-assignments.service.ts`

### The bad code

```typescript
for (const studentId of data.studentIds) {  // 1 query per student
  await query(
    `INSERT INTO student_content_assignments (...) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT ... DO NOTHING`,
    [subjectId, courseId, contentType, contentId, studentId, assignedBy]
  );
}
```

### What breaks and when

Assigning a quiz to a class of 200 students fires 200 sequential INSERT
queries. Each query is a round-trip to PostgreSQL (~1 ms on localhost,
~5–20 ms on a remote DB). That's 200–4000 ms for one teacher action.
Meanwhile, the pool connection is occupied for the full duration.

### Fix — Single batch INSERT

```typescript
export async function assignContent(data: AssignContentData): Promise<void> {
  if (data.studentIds.length === 0) return;

  // Build parameterised placeholders: ($1,$2,$3,$4,$5,$6),($1,$2,$3,$4,$7,$6),...
  const baseParams = [data.subjectId ?? null, data.courseId ?? null,
                      data.contentType, data.contentId, data.assignedBy];
  const placeholders = data.studentIds.map((_, i) =>
    `($1,$2,$3,$4,$${baseParams.length + i + 1},$5)`
  ).join(',');

  await query(
    `INSERT INTO student_content_assignments
       (subject_id,course_id,content_type,content_id,student_id,assigned_by)
     VALUES ${placeholders}
     ON CONFLICT (content_type,content_id,student_id) DO NOTHING`,
    [...baseParams, ...data.studentIds]
  );
}
```

200 students → 1 query → ~5 ms instead of ~1000 ms.

---

## 5. N+1 Query — Material Reordering

**Category:** N+1 Query Problem
**Severity:** 🟡 Medium
**File:** `server/src/modules/materials/materials.service.ts` — `reorderMaterials`

### The bad code

```typescript
for (let i = 0; i < orderedIds.length; i++) {
  await query(
    `UPDATE subject_materials SET order_index=$1 WHERE id=$2 AND subject_id=$3`,
    [i, orderedIds[i], subjectId]
  );
}
```

### Fix — Single CASE UPDATE

```typescript
export async function reorderMaterials(subjectId: string, orderedIds: string[]) {
  if (orderedIds.length === 0) return;

  const cases = orderedIds.map((id, i) => `WHEN $${i + 2}::uuid THEN ${i}`).join(' ');
  const params = [subjectId, ...orderedIds];

  await query(
    `UPDATE subject_materials
     SET order_index = CASE id ${cases} END
     WHERE subject_id = $1 AND id = ANY($${params.length + 1}::uuid[])`,
    [...params, orderedIds]
  );
}
```

20 materials → 1 query instead of 20.

---

## 6. N+1 Query — Quiz Question & Option Insertion

**Category:** N+1 Query Problem
**Severity:** 🟡 Medium
**File:** `server/src/modules/quiz/quiz.service.ts` — `createQuiz`, `appendQuestionsToQuiz`

### The bad code

```typescript
for (const q of data.questions) {             // 1 INSERT per question
  const qRows = await queryWithClient(client,
    `INSERT INTO questions (...) VALUES (...) RETURNING id`, [...]
  );
  for (const opt of q.options) {              // 1 INSERT per option
    await queryWithClient(client,
      `INSERT INTO options (...) VALUES (...)`, [...]
    );
  }
}
```

### What breaks and when

A quiz with 50 questions × 4 options = **250 sequential queries** inside a
single transaction. The transaction stays open (holding a connection) for the
entire duration. Larger quizzes (100+ questions) can take several seconds.

### Fix

Insert all questions in one batch, use `RETURNING id` to map them, then insert
all options in a second batch:

```typescript
// 1. Batch insert all questions
const qPlaceholders = data.questions.map((_, i) => {
  const base = i * 9;
  return `($${base+1},$${base+2},...,$${base+9})`;
}).join(',');
const questionRows = await queryWithClient(client,
  `INSERT INTO questions (...) VALUES ${qPlaceholders} RETURNING id, order_index`,
  data.questions.flatMap((q, i) => [quizId, q.text, ..., i])
);

// 2. Map order_index → id
const idByOrder = Object.fromEntries(questionRows.map(r => [r.order_index, r.id]));

// 3. Batch insert all options
const opts = data.questions.flatMap((q, qi) =>
  q.options.map(o => ({ questionId: idByOrder[qi], ...o }))
);
const oPlaceholders = opts.map((_, i) => {
  const base = i * 5; return `($${base+1},...,$${base+5})`;
}).join(',');
await queryWithClient(client,
  `INSERT INTO options (...) VALUES ${oPlaceholders}`,
  opts.flatMap(o => [o.questionId, o.label, o.text, o.isCorrect, o.explanation])
);
```

250 queries → 2 queries.

---

## 7. CQS Violation — Side-effect in a GET Request

**Category:** Command-Query Separation Violation
**Severity:** 🟡 Medium
**File:** `server/src/modules/classes/classes.service.ts` — `getSessionsByTeacher`

### The bad code

```typescript
export async function getSessionsByTeacher(teacherId, date, month, ...) {
  // Mutates data inside a read function!
  await query(
    `UPDATE sessions SET status='missed', updated_at=now()
     WHERE teacher_id=$1 AND status='scheduled'
     AND (session_date::date + start_time::timetz + interval '10 minutes') < now()`,
    [teacherId]
  );

  // Then reads and returns sessions
  const rows = await query(`SELECT ...`, [teacherId]);
  return rows.map(...);
}
```

### What breaks and when

**Command-Query Separation** is the principle that a function either reads
data *or* changes data, never both. Violating it causes:

1. **Unexpected mutations on every page load.** The Sessions page polls every
   60 seconds — so the UPDATE runs every 60 seconds per teacher, even if
   nothing changed.
2. **Testability nightmare.** You can't call `getSessionsByTeacher` in a test
   without it modifying the database.
3. **Hidden load.** 50 teachers with Sessions pages open = 50 UPDATEs/minute
   hitting the DB constantly.

### Fix — Move to a scheduled background job

```typescript
// server/src/jobs/markMissedSessions.ts
export async function markMissedSessions(): Promise<void> {
  await query(
    `UPDATE sessions SET status='missed', updated_at=now()
     WHERE status='scheduled'
     AND (session_date::date + start_time::timetz + interval '10 minutes') < now()`
    // No teacher_id filter — catches all missed sessions in one pass
  );
}

// server/src/server.ts — run every 5 minutes
import cron from 'node-cron';
import { markMissedSessions } from './jobs/markMissedSessions';

cron.schedule('*/5 * * * *', async () => {
  await markMissedSessions().catch(err =>
    logger.error('[cron] markMissedSessions failed', err)
  );
});
```

Remove the UPDATE from `getSessionsByTeacher`. The read is now a pure query.

---

## 8. Unbounded Queries — Missing LIMIT / Pagination

**Category:** Unbounded Query / Full Table Scan Risk
**Severity:** 🟡 Medium
**Files:** `quiz.service.ts`, `classes.service.ts`, `materials.service.ts`

### The bad code

```typescript
// quiz.service.ts — getQuizzesBySubject
const rows = await query(`
  SELECT q.*, COUNT(qs.id) AS question_count
  FROM quizzes q
  LEFT JOIN questions qs ON qs.quiz_id = q.id
  WHERE q.subject_id = $1 AND q.is_active = true
  GROUP BY q.id
  ORDER BY q.created_at DESC
  -- NO LIMIT
`, [subjectId]);

// classes.service.ts — getSessionsByTeacher (when no date filter)
`... WHERE s.teacher_id = $1${dateClause}
 ORDER BY s.session_date DESC, s.start_time DESC
 ${limitClause}` // limitClause = '' when month/week mode is used
```

### What breaks and when

A subject with 500 quizzes, or a teacher with 2 years of session history,
returns every single row. The DB does a full table scan with GROUP BY,
transferring potentially megabytes of data over the network, materialising it
all in Node's memory, and sending it all to the browser in one JSON payload.
The browser then renders 500 rows at once, freezing the UI.

### Fix

Add `limit` / `offset` params everywhere and return a `total` count:

```typescript
// Consistent pagination signature
export async function getQuizzesBySubject(
  subjectId: string,
  role: string,
  userId?: string,
  page = 1,
  pageSize = 20,
): Promise<{ data: QuizSummary[]; total: number }> {
  const offset = (page - 1) * pageSize;

  const [rows, countRows] = await Promise.all([
    query(`SELECT ... FROM quizzes q WHERE q.subject_id=$1 ...
           ORDER BY q.created_at DESC LIMIT $2 OFFSET $3`,
          [subjectId, pageSize, offset]),
    query(`SELECT COUNT(*)::int AS total FROM quizzes q WHERE q.subject_id=$1 ...`,
          [subjectId]),
  ]);

  return { data: rows.map(toSummary), total: countRows[0].total };
}
```

---

## 9. Missing Database Indexes

**Category:** Missing Index / Full Table Scan
**Severity:** 🟡 Medium
**File:** `server/sql/schema.sql`

### The problem

PostgreSQL uses sequential scans when no index exists for a query's WHERE
clause. On small datasets this is fine. At thousands of rows (quiz attempts,
session history, content assignments) every query that lacks an index becomes
a full table scan — O(n) instead of O(log n).

### Critical missing indexes

The schema defines indexes for top-level lookups but misses the compound
patterns used most frequently by the application queries:

```sql
-- quiz_attempts: looked up by (quiz_id, student_id) in getStudentQuizStatuses
-- and startAttempt uniqueness check
CREATE INDEX idx_quiz_attempts_quiz_student
  ON quiz_attempts(quiz_id, student_id);

-- attempt_answers: fetched by attempt_id in getAttemptResult
CREATE INDEX idx_attempt_answers_attempt
  ON attempt_answers(attempt_id);

-- subject_enrollments: checked per student on every session query
CREATE INDEX idx_subject_enrollments_student
  ON subject_enrollments(student_id, enrollment_status);

-- subject_teacher_students: joined on every teacher's session/content query
CREATE INDEX idx_sts_teacher_subject
  ON subject_teacher_students(teacher_id, subject_id);

-- sessions: looked up by date + status regularly
CREATE INDEX idx_sessions_date_status
  ON sessions(session_date, status);

-- student_content_assignments: checked per student on quiz/assignment load
CREATE INDEX idx_sca_student_content
  ON student_content_assignments(student_id, content_type, content_id);
```

Run `EXPLAIN ANALYZE` on your slowest queries to confirm which ones are
doing sequential scans and add indexes accordingly.

---

## 10. JWT Refresh — No Rotation or Invalidation

**Category:** Broken Authentication (OWASP A07)
**Severity:** 🟡 Medium
**File:** `server/src/modules/auth/auth.service.ts` — `refreshTokens`

### The bad code

```typescript
export async function refreshTokens(refreshToken: string) {
  // Verifies signature only — never checks any DB state
  const payload = verifyRefreshToken(refreshToken);

  const newAccessToken  = signAccessToken(tokenPayload);
  const newRefreshToken = signRefreshToken(tokenPayload);

  // Old refresh token is still valid — not recorded anywhere!
  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}
```

### What breaks and when

1. **No logout invalidation.** A teacher logs out. Their refresh token is
   still valid for 7 days. If it was stored or leaked, anyone who has it can
   generate new access tokens indefinitely.

2. **No reuse detection.** If an attacker steals a refresh token and uses it
   before the legitimate user does, both get new tokens. There is no signal
   that a theft occurred.

3. **No force-logout.** If an admin disables a user account, their existing
   tokens keep working until natural expiry.

### Fix — Token blacklist table

```sql
CREATE TABLE refresh_token_store (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    CHAR(64) NOT NULL UNIQUE,  -- SHA-256 hex
  issued_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  replaced_by   CHAR(64)  -- hash of the token that superseded this one
);
CREATE INDEX ON refresh_token_store(token_hash);
CREATE INDEX ON refresh_token_store(user_id, revoked_at);
```

```typescript
import { createHash } from 'crypto';
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// On login — store token
await query(
  `INSERT INTO refresh_token_store (user_id, token_hash, expires_at)
   VALUES ($1, $2, now() + interval '7 days')`,
  [userId, hash(refreshToken)]
);

// On refresh — check + rotate
export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hash(refreshToken);

  const rows = await query(
    `SELECT id FROM refresh_token_store
     WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  if (!rows.length) throw new Error('Token revoked or expired');

  const newRefresh = signRefreshToken(payload);

  // Rotate: revoke old, store new — in one transaction
  await withTransaction(async (client) => {
    await queryWithClient(client,
      `UPDATE refresh_token_store SET revoked_at=now(), replaced_by=$1
       WHERE token_hash=$2`,
      [hash(newRefresh), tokenHash]
    );
    await queryWithClient(client,
      `INSERT INTO refresh_token_store (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '7 days')`,
      [payload.userId, hash(newRefresh)]
    );
  });

  return { accessToken: signAccessToken(payload), refreshToken: newRefresh };
}

// On logout — revoke
export async function logout(refreshToken: string) {
  await query(
    `UPDATE refresh_token_store SET revoked_at=now()
     WHERE token_hash=$1`,
    [hash(refreshToken)]
  );
}
```

---

## 11. Client-Side Token Refresh Race (Multi-Tab)

**Category:** TOCTOU Race Condition
**Severity:** 🟡 Medium
**File:** `client/src/utils/http.js` — `silentRefresh`

### The bad code

```javascript
let _refreshingPromise = null;   // only deduplicated within one tab

export async function silentRefresh() {
  if (_refreshingPromise) return _refreshingPromise;  // same-tab dedup ✓

  _refreshingPromise = axios.post('/api/auth/refresh', { refreshToken })
    .then(res => {
      localStorage.setItem('accessToken',  res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      return res.data.accessToken;
    })
    .finally(() => { _refreshingPromise = null; });

  return _refreshingPromise;
}
```

### What breaks and when

`_refreshingPromise` is a module-level variable — it exists *per browser tab*.
If a student has 3 tabs open and all 3 get a 401 at the same moment:
- Tab A calls POST /refresh with `tokenR1` → receives `tokenR2`
- Tab B calls POST /refresh with `tokenR1` → server has already rotated; returns 401
- Tab C calls POST /refresh with `tokenR1` → same 401
- Tabs B and C log the student out even though Tab A succeeded

### Fix — BroadcastChannel coordination

```javascript
// client/src/utils/auth-sync.js
const channel = new BroadcastChannel('auth');

export function broadcastNewTokens(accessToken, refreshToken) {
  channel.postMessage({ type: 'TOKENS_REFRESHED', accessToken, refreshToken });
}

export function listenForTokenRefresh(callback) {
  channel.addEventListener('message', (e) => {
    if (e.data.type === 'TOKENS_REFRESHED') callback(e.data);
  });
}
```

```javascript
// http.js — updated silentRefresh
import { broadcastNewTokens, listenForTokenRefresh } from './auth-sync';

let _refreshingPromise = null;

listenForTokenRefresh(({ accessToken, refreshToken }) => {
  localStorage.setItem('accessToken',  accessToken);
  localStorage.setItem('refreshToken', refreshToken);
});

export async function silentRefresh() {
  if (_refreshingPromise) return _refreshingPromise;
  _refreshingPromise = axios.post('/api/auth/refresh', { refreshToken })
    .then(res => {
      localStorage.setItem('accessToken',  res.data.accessToken);
      localStorage.setItem('refreshToken', res.data.refreshToken);
      broadcastNewTokens(res.data.accessToken, res.data.refreshToken);
      return res.data.accessToken;
    })
    .finally(() => { _refreshingPromise = null; });
  return _refreshingPromise;
}
```

---

## 12. No Rate Limiting on Critical Endpoints

**Category:** Denial-of-Service Surface
**Severity:** 🟡 Medium
**Files:** `server/src/app.ts`, `server/src/middlewares/rateLimit.middleware.ts`

### The situation

Only the login endpoint has a rate limiter:

```typescript
// rateLimit.middleware.ts
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
});
router.post('/login', loginRateLimiter, authController.login);
```

All other endpoints are unprotected.

### What breaks and when

- A student in a dispute auto-clicks "Submit Quiz" 500 times → 500 DB inserts
- A bot scrapes `/api/quizzes/subject/:id` on every subject → DB exhausted
- A bad actor uploads 10,000 small files → Supabase storage quota depleted
- A buggy frontend polling loop goes into a tight cycle → server log flooded, DB hammered

### Fix

```typescript
// middlewares/rateLimit.middleware.ts — add these
import rateLimit from 'express-rate-limit';

// General API limit — generous enough for normal use
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  limit: 120,            // 2 req/sec average
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

// Quiz attempt endpoints — stricter (a student can't submit the same quiz 50 times)
export const quizLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `${req.ip}-${req.user?.id}`,
});

// Upload endpoints — strict (prevent storage abuse)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
});
```

```typescript
// app.ts
import { apiLimiter } from './middlewares/rateLimit.middleware';
app.use('/api/', apiLimiter);  // blanket limit on all API routes

// quiz routes
router.post('/:quizId/attempts',            quizLimiter, startAttempt);
router.post('/:quizId/attempts/:id/submit', quizLimiter, submitAttempt);

// upload routes
router.post('/quiz-image',    uploadLimiter, uploadController.uploadFile);
router.post('/material-file', uploadLimiter, uploadController.uploadFile);
```

---

## 13. Frontend Polling Storms

**Category:** Thundering Herd / Polling Storm
**Severity:** 🟡 Medium
**Files:** `client/src/components/Dashboard/UpcomingClasses.js`, `Sessions.js`, `Classes.js`

### The situation

Multiple components poll the server on fixed intervals:

```javascript
// UpcomingClasses.js
const AUTO_REFRESH_MS = 60_000;
setInterval(() => fetchSessions(), AUTO_REFRESH_MS);

// Sessions.js / Classes.js
const interval = setInterval(fetchSessions, 60000);

// UpcomingClasses.js — also re-fetches on tab visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) fetchSessions();
});
```

### What breaks and when

A school with 500 logged-in users (students + teachers), each with the
dashboard open:

- 500 users × 1 request/minute = **500 DB queries/minute** just for session data
- If a user switches tabs repeatedly, each focus event fires an immediate re-fetch
- If the Sessions page AND the Dashboard are both open: **2 polling loops simultaneously**
- On mobile where apps background/foreground frequently: constant re-fetch storms

### Fix options

**Option A — Exponential backoff on errors + jitter on start:**
```javascript
// Stagger startup so not all 500 clients hit at second :00
const jitter = Math.random() * 10_000; // 0–10 s random delay
setTimeout(() => {
  const interval = setInterval(fetchSessions, 60_000);
  return () => clearInterval(interval);
}, jitter);
```

**Option B — WebSocket / Server-Sent Events (proper fix):**
```typescript
// server — push session status changes instead of clients pulling
import { EventEmitter } from 'events';
export const sessionBus = new EventEmitter();

// After a session status changes:
sessionBus.emit('session:updated', { sessionId, status, subjectId });

// SSE endpoint — one persistent connection per browser tab
router.get('/api/sessions/stream', authMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  const handler = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  sessionBus.on('session:updated', handler);
  req.on('close', () => sessionBus.off('session:updated', handler));
});
```

This cuts 500 polls/minute to near-zero — clients only update when something actually changes.

---

## 14. File Upload — No Timeout, No Size Guard

**Category:** Missing Resilience / Unrestricted File Upload
**Severity:** 🟡 Medium
**File:** `server/src/modules/upload/upload.controller.ts`

### The bad code

```typescript
const { error } = await supabase.storage
  .from(bucket)
  .upload(filename, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
    // No timeout!
  });
```

Multer config (in the route file) defines `limits: { fileSize: 50 * 1024 * 1024 }` for some routes — but:
1. There is no global timeout on the Supabase upload call
2. If Supabase is degraded, the Node.js worker hangs on this `await` indefinitely
3. One stuck upload consumes a pool connection AND a Node worker for minutes

### Fix

```typescript
const UPLOAD_TIMEOUT_MS = 30_000;

async function uploadWithTimeout(bucket, filename, buffer, contentType) {
  const uploadPromise = supabase.storage.from(bucket)
    .upload(filename, buffer, { contentType, upsert: false });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Upload timed out after 30s')), UPLOAD_TIMEOUT_MS)
  );

  const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);
  if (error) throw error;
  return data;
}
```

Also ensure every upload route uses `multer` limits:
```typescript
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,   // 50 MB hard cap
    files: 1,                      // one file per request
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','application/pdf','video/mp4'];
    cb(null, allowed.includes(file.mimetype));
  },
});
```

---

## 15. No Circuit Breaker Around Zoom API

**Category:** Missing Resilience Pattern / Cascading Failure
**Severity:** 🟡 Medium
**File:** `server/src/services/zoom.service.ts`

### The problem

Every session start calls Zoom. There is no:
- Retry with backoff (transient failures just error immediately)
- Circuit breaker (if Zoom is down, every start attempt fails with a 500 and waits for the full timeout)
- Fallback (sessions could still start without a Zoom link and be given the link later)

### What breaks and when

Zoom has outages. When it does, every teacher's "Start Session" button returns
an error. The session is stuck in `scheduled` status. Teachers have no way to
start their class. Students wait. The timeout (default Node 120 s) means each
failed attempt occupies a DB connection for 2 minutes.

### Fix — Circuit Breaker pattern

Install `opossum` (industry-standard Node.js circuit breaker):

```bash
npm install opossum
npm install @types/opossum --save-dev
```

```typescript
// services/zoom.service.ts
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(createZoomMeetingImpl, {
  timeout: 10_000,          // fail after 10 s (not 120 s)
  errorThresholdPercentage: 50,  // open circuit if >50% of calls fail
  resetTimeout: 30_000,     // try again after 30 s
});

breaker.on('open',     () => logger.warn('[zoom] Circuit OPEN — Zoom API failing'));
breaker.on('halfOpen', () => logger.info('[zoom] Circuit HALF-OPEN — testing Zoom'));
breaker.on('close',    () => logger.info('[zoom] Circuit CLOSED — Zoom API healthy'));

// Fallback: create session without Zoom link; admin can add later
breaker.fallback(() => ({
  joinUrl: null,
  startUrl: null,
  meetingId: null,
}));

export async function createZoomMeeting(opts) {
  return breaker.fire(opts);
}
```

---

## 16. Quiz Answer Saves — No Debounce

**Category:** Excessive API Calls
**Severity:** 🟢 Low-Medium
**File:** `client/src/views/quiz/QuizTaker.js`

### The situation

```javascript
// Saves to localStorage on every single answer change
useEffect(() => {
  if (phase !== 'taking' || quiz?.quiz_type !== 'test' || !attemptId) return;
  localStorage.setItem(`quiz_test_${quizId}`, JSON.stringify({
    attemptId, startedAtMs: startedAt.current, answers,
  }));
}, [answers]);
```

For quiz type `practice` the same pattern applies for server-side partial saves.
A student quickly changing answers fires multiple saves in rapid succession.

### Fix

```javascript
import { useCallback, useRef } from 'react';

function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// In QuizTaker.js
const saveToStorage = useDebounce((answers) => {
  localStorage.setItem(`quiz_test_${quizId}`, JSON.stringify({
    attemptId, startedAtMs: startedAt.current, answers,
  }));
}, 500);

useEffect(() => {
  if (phase !== 'taking' || quiz?.quiz_type !== 'test' || !attemptId) return;
  saveToStorage(answers);
}, [answers]);
```

---

## 17. Priority Roadmap

These issues are grouped by the effort-to-impact ratio. Do Phase 1 before going to production with any real users.

### Phase 1 — Do before production (hours of work, critical risk)

| # | Issue | File | Change |
|---|---|---|---|
| 1 | Connection pool `max: 5` | `config/db.ts` | Raise to 30, lower idle timeout |
| 2 | Zoom call inside DB transaction | `classes.service.ts` | Move Zoom calls outside `withTransaction` |
| 3 | Lost update on quiz edit | `quiz.service.ts` | Add `version` column + 409 check |
| 4 | N+1 insert in `assignContent` | `content-assignments.service.ts` | Single batch INSERT |

### Phase 2 — First month in production (days of work, high impact)

| # | Issue | File | Change |
|---|---|---|---|
| 5 | No JWT invalidation on logout | `auth.service.ts` | `refresh_token_store` table + blacklist check |
| 6 | Missing DB indexes | `schema.sql` | Add 6 indexes listed in §9 |
| 7 | Unbounded list queries | `quiz.service.ts` etc. | Add LIMIT/OFFSET + total count |
| 8 | CQS violation — UPDATE in GET | `classes.service.ts` | Move to `node-cron` job every 5 min |
| 9 | No rate limiting on API | `app.ts` | Add `express-rate-limit` blanket + stricter limits on quiz/upload |

### Phase 3 — Scale preparation (weeks of work, important at 1000+ users)

| # | Issue | File | Change |
|---|---|---|---|
| 10 | Polling storm | `UpcomingClasses.js`, `Sessions.js` | Add jitter + consider SSE/WebSocket |
| 11 | Upload no timeout | `upload.controller.ts` | 30 s timeout wrapper |
| 12 | No Zoom circuit breaker | `zoom.service.ts` | `opossum` circuit breaker + fallback |
| 13 | Multi-tab token race | `http.js` | `BroadcastChannel` coordination |
| 14 | N+1 in quiz insertion | `quiz.service.ts` | Batch INSERT questions + options |
| 15 | N+1 in material reorder | `materials.service.ts` | Single CASE UPDATE |

### Phase 4 — Production hardening (ongoing)

- Add `EXPLAIN ANALYZE` query profiling on the slowest 10 endpoints
- Set up `pg_stat_statements` to track query performance in production
- Add structured logging with request IDs to trace slow requests end-to-end
- Introduce a Redis cache for frequently-read, rarely-written data (quiz metadata, subject lists)
- Set up PM2 cluster mode or a container orchestrator (Docker + horizontal scaling)

---

*Last updated: 2026-03-27 — based on full source code audit of 10xAccel LMS platform.*
