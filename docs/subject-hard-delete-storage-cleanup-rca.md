# Subject Hard Delete Storage Cleanup — RCA (Interview POV)

**Date:** 2026-04-10  
**Area:** Admin → Subject Management (`hard delete` flow)  
**Type:** Data lifecycle bug (orphaned storage objects)

---

## 1) Problem Statement

When an admin deleted a subject, database records were removed successfully, but some quiz/practice-set images in storage were left behind.

### Observed behavior
- Subject hard delete removed relational data from PostgreSQL.
- Associated storage files (question images, explanation images, option images) were not always cleaned up.
- Course hard delete did clean up quiz images correctly.

---

## 2) Severity Assessment

**Severity: High (Operational + Cost + Compliance risk)**

Why this is serious:
1. **Storage bloat:** orphaned files accumulate and increase infra cost over time.
2. **Data lifecycle mismatch:** DB says content is deleted, but files still exist in object storage.
3. **Potential privacy/compliance concern:** residual media can remain accessible if references are leaked/signed.
4. **Hard to detect manually:** dashboards look “clean” because DB rows are gone.

Not marked Critical because:
- Core learning flows were not blocked.
- No immediate production outage.

---

## 3) Root Cause (RCA)

The subject deletion path used a less robust cleanup pattern than course deletion.

### Technical root cause
- Subject delete collected file URLs using direct joins on `subject_id` and executed outside a strict transaction pattern used by course hard delete.
- Cleanup logic was not anchored first on the exact quiz IDs being deleted.
- This made subject cleanup more fragile and inconsistent compared to course cleanup.

### Why course hard delete worked better
- Course hard delete first resolved related entities (subjects/quizzes), then collected image URLs via entity IDs, then performed transactional delete + post-commit storage cleanup.
- That approach is deterministic and less likely to miss child assets.

---

## 4) Fix Implemented

We refactored `deleteSubject()` to follow the same robust pattern as course hard delete.

### What changed
1. Run subject delete in `withTransaction(...)`.
2. Resolve the subject’s quiz IDs first.
3. Resolve question IDs from quiz IDs.
4. Collect all relevant file refs before cascade delete:
   - question `image_url`
   - question `explanation_image_url`
   - option `option_image_url`
   - assignment/submission/session related files (existing behavior retained)
5. Delete `attempt_answers` by resolved question IDs (prevents FK blocking).
6. Delete subject row (DB cascade removes remaining relational rows).
7. After transaction, delete collected storage refs via `deleteFilesByUrls(...)`.

---

## 5) Files Changed

- [server/src/modules/admin/admin.service.ts](server/src/modules/admin/admin.service.ts)
  - Refactored `deleteSubject()` to transactional, ID-driven cleanup.
- [server/src/__tests__/modules/admin.service.test.ts](server/src/__tests__/modules/admin.service.test.ts)
  - Updated/added unit test coverage for transactional `deleteSubject()` flow.

---

## 6) Validation Performed

- Type/lint diagnostics on changed files: no errors.
- Focused unit test pass:
  - `admin.service` suite
  - `deleteSubject` test confirms transaction + `attempt_answers` cleanup + subject delete call order intent.

---

## 7) Interview Talking Points (POV)

If asked in an interview, frame it like this:

1. **Detection:**
   - “We noticed a functional asymmetry: course hard delete removed storage assets, subject hard delete did not.”

2. **Diagnosis:**
   - “DB cascades were correct; the defect was in file lifecycle orchestration.”
   - “Subject cleanup queries were less deterministic than the course flow.”

3. **Solution strategy:**
   - “I normalized subject delete to the same transactional, ID-driven pattern used by the working course delete path.”

4. **Risk management:**
   - “Kept patch minimal, no API contract changes, added/updated test coverage to prevent regression.”

5. **Outcome:**
   - “Hard deletes now align across entities: DB rows and storage artifacts are cleaned consistently.”

---

## 8) Preventive Improvements (Next Steps)

1. Add integration test that asserts both DB deletion and storage deletion calls for subject/course hard delete.
2. Add structured logs/metrics for `deletedFiles` per hard-delete operation.
3. Periodic orphaned-object scanner to detect historical leftovers.
4. Consider centralizing delete orchestration in a shared content cleanup service.

---

## 9) One-line Summary

This was a **high-severity data lifecycle consistency bug**: subject hard delete removed DB records but could leave storage media behind; we fixed it by adopting a **transactional, entity-ID-driven cleanup flow** and verified with tests.
