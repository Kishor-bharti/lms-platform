# Private Supabase Storage Migration Plan (No Code Changes Yet)

**Date:** 2026-03-31  
**Scope:** LMS server + client + Supabase Storage/RLS  
**Goal:** Keep `portal-assets` and `temp-uploads` private while preserving current user experience (view/download/upload working normally).

---

## 1) Objectives and Success Criteria

### Objectives
1. Make storage buckets private (no permanent public URLs).
2. Continue serving assignment/material/submission files to authorized users.
3. Replace public URL usage with signed URL delivery.
4. Ensure hard delete and publish-move workflows still work.
5. Preserve existing records and minimize downtime.

### Success Criteria
- Direct URL access without auth fails.
- Authorized users can still load files in UI via short-lived signed URLs.
- Upload flow works for admin, teacher, student.
- Publish flow moves files and still displays/opens correctly.
- Hard delete removes DB records + storage objects reliably.
- No regressions in assignment/material/student-upload features.

---

## 2) Current-State Findings (Baseline)

1. Backend currently uses `SUPABASE_ANON_KEY` for storage operations.
2. File fields in DB currently store full public URLs.
3. UI uses returned URL directly for display/download.
4. RLS currently allows anon/authenticated for key operations in active setup.
5. Hard delete parses URLs and batch deletes by extracted bucket/path.

**Risk:** Keeping permanent public URLs defeats private-bucket security and introduces cache persistence issues.

---

## 3) Target Architecture

### Identity and Access
- Buckets are **private**.
- Backend uses **service role key** for privileged storage actions.
- Frontend never receives service key.

### Data Representation
- Store object reference as:
  - preferred: `bucket` + `object_path`
  - acceptable transitional: existing URL + derived path helper

### Delivery Model
- API returns **signed URLs** with short expiry (for viewing/downloading).
- Signed URLs generated on demand in backend.

### Lifecycle
- Upload -> private object path stored.
- Read -> signed URL generated per request.
- Publish move -> copy/move by object path, update stored reference.
- Hard delete -> delete by object path from private bucket.

---

## 4) Migration Strategy (Phased)

## Phase 0 - Preparation
1. Freeze schema/API change window.
2. Identify all DB columns containing file references.
3. Inventory endpoints returning file URLs.
4. Confirm all environments have:
   - `SUPABASE_URL_PUBLIC`
   - `SUPABASE_ANON_KEY` (if still needed for any public client path)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `SUPABASE_PORTAL_BUCKET`
   - `SUPABASE_TEMP_BUCKET`
5. Add rollout checklist + rollback checklist.

Deliverable: approved migration checklist.

## Phase 1 - Supabase Policy & Bucket Hardening
1. Set `portal-assets` and `temp-uploads` to private.
2. Replace public SELECT policies with authenticated-only access where needed.
3. Keep insert/update/delete rights aligned with server-side service-role usage.
4. Validate no direct anonymous object reads.

Deliverable: private buckets with validated RLS.

## Phase 2 - Backend Storage Client Split
1. Introduce a dedicated server storage client using service role key.
2. Keep anon-based client only where explicitly required (ideally none for server storage ops).
3. Centralize helpers:
   - `createSignedUrl(bucket, path, expiresIn)`
   - `deleteObjects(bucket, paths)`
   - `moveObject(sourceBucket, sourcePath, targetBucket, targetPath)`

Deliverable: one secure storage abstraction for all modules.

## Phase 3 - Data Model Transition
1. Define canonical file reference format (`bucket`, `path`, optional `filename`, `mime`).
2. Add migration script to backfill path from current public URLs.
3. Keep temporary compatibility layer that can parse both old URL and new path format.
4. Mark old URL-only representation as deprecated.

Deliverable: DB records usable without public URLs.

## Phase 4 - API Response Contract Updates
1. Update read endpoints (materials, assignments, submissions, uploads) to return signed URL fields.
2. Standardize expiry per use case (e.g., 5-15 minutes).
3. Include deterministic refresh strategy:
   - regenerate URL on page/API refresh
   - optional refresh endpoint if long-lived pages are common

Deliverable: frontend receives signed URLs transparently.

## Phase 5 - Publish/Move and Hard Delete Alignment
1. Move-on-publish uses path-based operations (not public URL parsing only).
2. Hard delete collects paths and deletes through service-role client.
3. Add robust logging for per-object delete/move failures.
4. Add retry strategy for transient storage errors.

Deliverable: secure lifecycle parity with existing behavior.

## Phase 6 - Frontend Compatibility Pass
1. Ensure components can render signed URLs same as old URLs.
2. Handle expiry-related edge cases:
   - image/file fails due to expired URL -> trigger refetch
3. Avoid storing signed URLs long-term in local state/storage.

Deliverable: UX unchanged for users.

## Phase 7 - Cutover and Cleanup
1. Run production data backfill.
2. Deploy backend + frontend with signed URL support.
3. Purge/rotate old publicly cached references where possible.
4. Remove obsolete public-policy SQL and dead code paths.

Deliverable: final secure state without public object access.

---

## 5) Detailed Task Breakdown

### A. Discovery Tasks
- Map all file-related tables/columns.
- Map all routes that emit URLs.
- Map all client views that consume URLs.
- Confirm current hard-delete coverage by role.

### B. Security Tasks
- Add service-role env var to all server environments.
- Verify key handling and secret storage in deployment platform.
- Validate no secret leakage in logs/responses.

### C. Data Tasks
- Build SQL/backfill script for extracting paths from historical URLs.
- Add idempotent migration scripts.
- Add verification query to detect unresolved rows.

### D. API Tasks
- Define contract versioning for URL fields (`file_url_signed` etc.).
- Add compatibility to support old clients during rollout window.

### E. QA Tasks
- Unit tests for storage utility layer.
- Integration tests for upload/read/move/delete.
- Manual test matrix per role and module.

---

## 6) Proposed DB/Field Normalization (Recommended)

For each file reference currently stored as full URL, move toward:
- `file_bucket` (text)
- `file_path` (text)
- optional `file_original_name` (text)
- optional `file_mime` (text)

Reason: avoids brittle URL parsing and decouples from host/CDN format.

---

## 7) API Contract Proposal (Draft)

For read responses, include:
- persistent reference: `bucket`, `path`
- ephemeral access URL: `signed_url`
- metadata: `expires_in`

For upload responses, include:
- `bucket`, `path`, `name`
- optional immediate `signed_url`

---

## 8) Test Plan (End-to-End)

### Role Matrix
1. Admin uploads file -> file accessible in UI, private direct URL blocked.
2. Teacher uploads draft -> publish -> still accessible via signed URL.
3. Student submits assignment -> teacher can review/download.
4. Super admin hard deletes student -> all related files removed from storage.
5. Super admin hard deletes teacher -> unpublished files removed, published retained.

### Expiry Matrix
1. Open page, wait past expiry, attempt access.
2. Refetch endpoint and verify new signed URL works.

### Security Matrix
1. Try opening stored raw path/old public URL directly.
2. Verify unauthorized user cannot fetch signed URLs for foreign resources.

---

## 9) Rollout Plan

1. Deploy Phase 2 helpers behind feature flag.
2. Deploy API signed-URL response support.
3. Deploy client compatibility for signed URLs.
4. Run backfill and validate.
5. Switch buckets private and enforce final policies.
6. Monitor logs and error rates for 24-48 hours.

---

## 10) Rollback Plan

If major issue occurs:
1. Re-enable temporary compatibility mode in backend.
2. Restore previous policy set (controlled SQL rollback file).
3. Keep bucket private if possible; if emergency, temporary public read policy (time-boxed).
4. Re-run health checks and incident report.

---

## 11) Risks and Mitigations

1. **Signed URL expiry breaks long sessions**  
   Mitigation: API refetch-on-failure + shorter cache layers.

2. **Legacy records not backfilled**  
   Mitigation: compatibility parser + unresolved-row detector query.

3. **Hard delete misses orphan files**  
   Mitigation: scheduled orphan sweeper job (bucket listing vs DB refs).

4. **Policy misconfiguration blocks uploads**  
   Mitigation: pre-cutover staging validation + smoke suite.

---

## 12) Effort Estimate (Rough)

- Discovery + design: 0.5-1 day
- Backend storage/client refactor: 1-2 days
- DB migration + backfill: 0.5-1 day
- Frontend compatibility: 0.5-1 day
- QA + rollout: 1 day

**Total:** ~3.5 to 6 days depending on regression scope.

---

## 13) Implementation Order Recommendation

1. Build backend signed URL capability first.
2. Add client support for signed URLs.
3. Backfill DB references.
4. Private bucket cutover.
5. Final policy lock + cleanup.

---

## 14) Definition of Done

- No public file access possible by raw URL.
- All relevant user flows pass in staging and production.
- Hard delete removes expected private objects.
- Logs show no sustained RLS/storage errors.
- Team has updated runbook for key rotation and policy management.
