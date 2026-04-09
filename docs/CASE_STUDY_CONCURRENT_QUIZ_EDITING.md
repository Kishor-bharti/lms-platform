# Case Study: Concurrent Quiz Editing Race Condition in an LMS Platform

## Context

**System:** 10xAccel — an enterprise Learning Management System (LMS)
**Stack:** React 18 SPA · TypeScript/Express REST API · PostgreSQL (no ORM)
**Feature:** Collaborative quiz/practice-set authoring by multiple teachers under admin oversight

---

## Problem Statement

The platform supports a workflow where an admin can grant multiple teachers **write access** to a specific quiz so they can collaboratively build it before it is published to students. The original `updateQuiz` endpoint used a **full-replace strategy**: it soft-deleted all existing questions and reinserted the entire quiz from the client's payload in a single transaction.

The question was: **What happens when two or more teachers with write access edit the same quiz concurrently?**

---

## Root Cause Analysis

### The full-replace pattern

```
PUT /api/quizzes/:quizId
Body: { title, questions: [ ...ALL questions ] }
```

Inside `updateQuiz` (PostgreSQL transaction):
```sql
-- Step 1: wipe everything
UPDATE questions SET is_active = false WHERE quiz_id = $1;

-- Step 2: reinsert from client payload
INSERT INTO questions (...) VALUES (...);
```

### The race condition

```
T=0   Teacher A opens quiz  (loads Q1–Q10)
T=0   Teacher B opens quiz  (loads Q1–Q10)

T=5s  Teacher A adds Q11, clicks Save
      → transaction: Q1–Q10 deleted, Q1–Q11 inserted  ✓

T=7s  Teacher B adds Q11 (a different one), clicks Save
      → transaction: Q1–Q11 DELETED (including A's Q11), B's Q1–Q11 inserted  ✗
```

**Last write wins.** Teacher A's contribution is silently gone. There is no error, no conflict signal, no merge — just data loss.

### Why the transaction doesn't help

A database transaction guarantees **atomicity within one request**. It does not prevent two separate transactions from running in sequence against the same rows. The second transaction sees the committed state from the first and overwrites it completely. This is a classic **lost update** anomaly — the most common form of write-write conflict.

### Scale of impact

With N concurrent teachers:
- Each teacher loads a snapshot of the quiz at time T₀
- Each teacher's save discards every question added by teachers who saved between T₀ and their save
- The final state of the quiz reflects only the last teacher to save
- All intermediate contributions are permanently lost (soft-deleted rows are orphaned and never recovered)

---

## Solution Design

### Core insight: change the write model

The full-replace pattern is inherently unsafe for collaborative writes. The fix is to make teacher writes **append-only** — teachers never replace existing data, they only add to it.

### Two-layer permission model (kept intact)

| Layer | Scope | Set by |
|---|---|---|
| Subject-level write (`subject_teachers.permission_level`) | All quizzes in subject | AdminAllocations "Grant Write" |
| Per-quiz write (`quiz_write_permissions` table) | One specific quiz | Permissions button on quiz row |

### New endpoint

```
POST /api/quizzes/:quizId/questions
Body: { questions: [ ...NEW questions only ] }
```

**Append semantics:**
1. Reads `MAX(order_index)` of existing active questions — determines insertion point
2. Inserts only the submitted questions starting at `nextIndex`
3. Never touches existing questions
4. Keeps quiz `is_published = false` (admin must review before re-publishing)

### Concurrent-safety proof

```
T=0   Teacher A opens quiz  (loads Q1–Q10, sees Q11 blank form)
T=0   Teacher B opens quiz  (loads Q1–Q10, sees Q11 blank form)

T=5s  Teacher A submits Q11:
      MAX(order_index) = 9 → inserts at index 10
      DB: Q1–Q11 exist

T=7s  Teacher B submits Q11 (different):
      MAX(order_index) = 10 → inserts at index 11
      DB: Q1–Q12 exist  ✓

Both contributions preserved. No conflict. No data loss.
```

The only residual risk is **index collision** if two teachers submit at the exact same millisecond. This is handled by computing `MAX(order_index)` inside the transaction — PostgreSQL's row-level locking ensures the two inserts are serialised, so each gets a unique index.

---

## Implementation

### Database

```sql
-- New table for per-quiz write permissions
CREATE TABLE quiz_write_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id     UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  granted_by  UUID NOT NULL REFERENCES users(id),
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, teacher_id)
);
```

### Backend (TypeScript / Express / PostgreSQL)

**`quiz.service.ts` — `appendQuestionsToQuiz`**
```typescript
export async function appendQuestionsToQuiz(quizId, addedBy, questions) {
  // Compute insertion point atomically
  const [{ max_idx }] = await query(
    `SELECT COALESCE(MAX(order_index), -1) AS max_idx
     FROM questions WHERE quiz_id = $1 AND is_active = true`, [quizId]
  );
  let nextIndex = Number(max_idx) + 1;

  await withTransaction(async (client) => {
    for (const q of questions) {
      const [{ id: questionId }] = await queryWithClient(client, `
        INSERT INTO questions (quiz_id, question_text, ..., order_index, created_by)
        VALUES ($1, ..., $8, $9) RETURNING id
      `, [quizId, ..., nextIndex++, addedBy]);

      for (const opt of q.options) {
        await queryWithClient(client, `
          INSERT INTO options (question_id, ...) VALUES ($1, ...)
        `, [questionId, ...]);
      }
    }
    // Keep draft — admin reviews before publishing
    await queryWithClient(client,
      `UPDATE quizzes SET is_published = false, updated_at = now() WHERE id = $1`,
      [quizId]
    );
  });
}
```

**`permissions.ts` — `hasQuizWritePermission`**
```typescript
export async function hasQuizWritePermission(userId, role, quizId, subjectId) {
  if (role === 'admin') return true;
  if (role !== 'teacher') return false;
  // Subject-level write (all quizzes in subject)
  const level = await getTeacherPermissionLevel(userId, subjectId);
  if (level === 'write') return true;
  // Per-quiz write (this quiz only)
  const rows = await query(
    `SELECT 1 FROM quiz_write_permissions WHERE quiz_id = $1 AND teacher_id = $2`,
    [quizId, userId]
  );
  return rows.length > 0;
}
```

**Route:**
```typescript
router.post('/:quizId/questions', quizController.appendQuestions); // teacher append
router.put('/:quizId', validateBody(updateQuizSchema), quizController.updateQuiz); // admin full-replace
```

### Frontend (React)

**`QuizBuilder.js` — teacher edit mode:**
- Loads existing questions as **read-only display** (cannot edit or delete)
- Provides a separate "new questions" section — editable, starts with one blank question
- "Submit Questions for Review" calls `POST /api/quizzes/:quizId/questions` with only new questions
- Quiz meta settings (title, type, topic) hidden — teacher cannot change these

**`SubjectTeacher.js` — Permissions modal:**
- Per-quiz table: teacher name · subject access level · quiz-specific write access · grant date · Grant/Revoke button
- Admin can grant write to a teacher → they see the unpublished quiz and can append questions
- Admin revokes before publishing → quiz locks down

---

## Workflow

```
Admin creates quiz (unpublished)
   ↓
Admin grants per-quiz write to Teacher A
   ↓
Teacher A opens quiz → sees existing Q read-only + blank form for new Q
Teacher A appends Q11, Q12 → quiz stays unpublished
   ↓
Admin grants per-quiz write to Teacher B
   ↓
Teacher B appends Q13, Q14 → both teachers' questions coexist safely
   ↓
Admin reviews all questions, happy with quiz
Admin revokes per-quiz write from Teacher A and Teacher B
Admin publishes quiz
   ↓
All teachers allocated to the subject can now see the quiz
Teachers assign the quiz to specific students individually
Students can only see quizzes assigned to them
```

---

## Key Engineering Decisions

| Decision | Rationale |
|---|---|
| Append-only for teachers, full-replace for admin | Admin is the single source of truth; teachers are contributors |
| Per-quiz write separate from subject-level write | Granular control without a full permissions table for every content item |
| `MAX(order_index)` inside the transaction | Prevents index collision under concurrent inserts without needing a sequence or lock |
| Quiz auto-unpublishes on teacher append | Enforces admin review gate before any teacher contribution reaches students |
| Existing questions displayed read-only in UI | UX guardrail — teacher cannot accidentally erase peer contributions |

---

## Interview Talking Points

**Q: What kind of bug is this?**
A: A **lost update anomaly** — a write-write conflict where the second transaction silently overwrites the first. This is one of the four standard database concurrency anomalies alongside dirty reads, non-repeatable reads, and phantom reads.

**Q: Doesn't wrapping it in a transaction fix it?**
A: No. A transaction guarantees atomicity *within itself* — all-or-nothing execution. It does not prevent two separate committed transactions from overwriting each other. You need either optimistic locking (version check), pessimistic locking (SELECT FOR UPDATE), or — better in this case — a write model that is inherently non-conflicting.

**Q: Why not use SELECT FOR UPDATE?**
A: Pessimistic locking would serialise all teacher saves, meaning only one teacher can save at a time and others block. For a high-latency editing flow (teacher has the quiz open for minutes) this creates unacceptable lock contention. The append model avoids the conflict entirely rather than serialising around it.

**Q: What if two teachers submit at the exact same millisecond?**
A: `MAX(order_index)` is read inside the transaction. PostgreSQL's MVCC and row-level locking mean the two transactions serialise at the point they insert — each sees the committed state of the other, so they each get a unique order_index. There is no collision.

**Q: How do you prevent a teacher from editing another teacher's question?**
A: The append endpoint only inserts new rows — it has no UPDATE or DELETE path. The read-only display in the UI is a UX enforcement. Even if a teacher called the API directly, the endpoint only accepts new questions to insert, not modifications to existing rows.

**Q: How does the admin review process work?**
A: The quiz is kept `is_published = false` after every teacher append. The admin can view all questions (including who added each, via `created_by`). When satisfied, the admin revokes all per-quiz write permissions and publishes. From that point the quiz is visible to all allocated teachers who can assign it to students.
