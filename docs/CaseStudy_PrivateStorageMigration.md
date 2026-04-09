# Case Study: Migrating LMS File Storage from Public to Private Buckets

**Project:** 10xAccel LMS Platform
**Stack:** TypeScript/Express, PostgreSQL, Supabase Storage, React
**Branch:** `feature/private-uploads`
**Date:** April 2026

---

## TL;DR

Every file users uploaded to the LMS — assignment PDFs, student submissions, quiz images, teacher materials — was sitting in **public Supabase buckets**. Anyone with a URL could read any file, forever, with no authentication. I migrated the platform to **private buckets with short-lived signed URLs**, without breaking a single existing record, without requiring any frontend changes, and without a database migration.

---

## The Problem

### What I found
The LMS stored file URLs like this in the database:

```
https://<project>.supabase.co/storage/v1/object/public/portal-assets/1234-abc.pdf
```

Three buckets — `portal-assets`, `temp-uploads`, `quiz-images` — were all flagged **Public** in the Supabase dashboard. That meant:

- Any file URL, once leaked, was **permanently accessible to the entire internet**.
- Student assignment submissions (potentially containing personal info, graded work) had zero access control.
- Teacher-uploaded course materials could be scraped by anyone who guessed or found a URL.
- Quiz images — including answer-explanation images — were reachable without being enrolled in the course.

### Severity: High

| Dimension | Impact |
|---|---|
| **Confidentiality** | Every uploaded file was world-readable. Student PII, graded feedback, proprietary course content all exposed. |
| **Compliance** | For any institution treating the LMS as FERPA/GDPR-adjacent, this is a direct violation — student work must not be publicly accessible. |
| **Reputation** | A single "here's a link to every PDF on the platform" post would be a PR incident. |
| **Blast radius** | ~every file in the system. All roles. All historical data. |

This was the kind of bug that doesn't trigger alarms because nothing is *broken* — until someone notices, and then it's a front-page problem.

---

## Constraints That Shaped the Solution

Before writing any code I pinned down what I couldn't break:

1. **Zero frontend changes.** The React client passes `image_url`, `file_url`, `attachment_url` directly to `<img>` / `<a>` tags. I could not ship a migration that required retouching every view.
2. **Zero downtime for existing data.** The DB had thousands of rows with the old public URLs baked in. A hard cutover would 404 every existing assignment and course material.
3. **No DB migration if avoidable.** Schema changes mean coordinating prod deploys, backfills, and rollback plans. If I could reuse the existing URL columns, I should.
4. **Form round-trips must survive.** The quiz builder is particularly gnarly: uploaded image URLs are both *displayed immediately* to the teacher AND *posted back to the server* when saving. Whatever the upload endpoint returns has to work in both roles.

---

## The Solution

### Core idea
Stop storing the **access URL** in the database. Store a **reference** (`bucket/path`) instead, and generate a fresh short-lived signed URL every time data is read.

```
Old: https://.../storage/v1/object/public/portal-assets/1234-abc.pdf   ← in DB
New: portal-assets/1234-abc.pdf                                        ← in DB
     → signed URL (15 min expiry) generated at read time               ← in response
```

### Architecture changes

**1. Service-role storage client**
Private buckets require the Supabase `service_role` key for signing. I added a single `getStorageClient()` helper in [server/src/utils/storage.ts](server/src/utils/storage.ts) that returns a service-role client (falling back to anon in dev for convenience). All storage operations — upload, delete, move, sign — now route through it.

**2. A format-tolerant resolver**
This was the key trick for avoiding a DB migration. `resolveStorageRef()` accepts **three** formats and normalizes them to `{ bucket, path }`:

```typescript
// 1. New canonical form
"portal-assets/1234-abc.pdf"

// 2. Legacy public URL (what old rows contain)
"https://.../storage/v1/object/public/portal-assets/1234-abc.pdf"

// 3. Signed URL (what forms temporarily round-trip)
"https://.../storage/v1/object/sign/portal-assets/1234-abc.pdf?token=..."
```

Because the resolver handles all three, **old rows keep working untouched**. The DB doesn't need a backfill — every read is self-healing. The file still lives at the same path inside the bucket; only the access mechanism changed.

**3. A batch-signing helper**
Every service method that returns a row with file fields now pipes it through `signFileFields(row, ['file_url', 'attachment_url'])` before responding. One line per service method, applied across materials, assignments, student uploads, quiz, and progress services.

```typescript
const rows = await query<Material>('SELECT ... FROM subject_materials ...');
return Promise.all(rows.map(r => signFileFields(r, ['file_url'])));
```

The client sees fresh 15-minute signed URLs every request. It has no idea the underlying storage model changed.

**4. Upload response designed for backward compat**
Upload endpoints return *both* forms:
```json
{
  "url": "https://.../sign/portal-assets/1234.pdf?token=...",
  "ref": "portal-assets/1234.pdf",
  "signed_url": "https://.../sign/portal-assets/1234.pdf?token=..."
}
```

Existing client code that reads `url` keeps working (it gets a signed URL for immediate preview). Future client code can migrate to `ref` when convenient. Nothing had to change on day one.

---

## The Tricky Part: The Quiz Builder

The quiz builder exposed the one edge case that nearly broke the "zero frontend changes" goal.

**The flow:**
1. Teacher clicks "Add image" on a question → file uploads → server returns URL.
2. The returned URL is immediately rendered as a `<img src={url}>` preview.
3. Teacher clicks Save → client POSTs the entire quiz JSON back → that same URL is stored to the DB.

**The problem:**
- If I returned `"portal-assets/1234.pdf"` (the ref), the `<img src>` preview breaks instantly.
- If I returned a signed URL, it works as a preview — but it gets round-tripped into the DB, where its token expires in 15 minutes, and future readers hit 400 errors.

**The fix:**
Extend `resolveStorageRef` to *also* parse signed URLs. Now, even if the DB temporarily contains a signed URL with a long-expired token, the resolver just strips out the bucket/path and re-signs it fresh. The expired token is harmless — it's never actually used.

This made the transitional state **self-healing**: the DB can contain any of the three formats, in any combination, forever. Over time, new uploads will store refs, and old rows will naturally age out, but nothing forces a migration and nothing breaks if it doesn't happen.

---

## What I Shipped

| Change | Files |
|---|---|
| Service-role client + signing helpers | [storage.ts](server/src/utils/storage.ts) |
| Format-tolerant ref resolver | [storage.ts](server/src/utils/storage.ts) |
| Upload endpoints return signed URL + ref | [upload.controller.ts](server/src/modules/upload/upload.controller.ts) |
| Read services sign file fields on response | materials, assignment, student-uploads, quiz, progress services |
| Env var documentation | `.env.development.example`, `.env.production.example` |

**Not shipped (intentional):**
- No DB migration
- No frontend changes
- No data backfill

**Operator steps (runbook):**
1. Set `SUPABASE_SERVICE_ROLE_KEY` in server env.
2. Flip all three buckets to Private in Supabase dashboard.
3. Remove the now-redundant public-read RLS policies.

Order matters: set the key **before** flipping buckets, or uploads break for the duration of the gap.

---

## Validation

- All 157 server tests pass
- `tsc --noEmit` clean
- Client lint clean
- Manual smoke test checklist documented (upload → render → wait 16 min → confirm URL re-signed → confirm expired URL returns 403)

---

## What I'd Call Out in an Interview

**1. The real work was designing the data model, not writing the code.**
The resolver-accepts-three-formats design is what made everything else cheap. Once that decision was made, the rest was mechanical — one helper call per service method. If I'd gone with "migrate all URLs in the DB first, then switch over," this would have been a weeks-long project with a rollback plan, a staging dry-run, and a feature flag. Instead it was a few hours of work and a single branch.

**2. Backward compatibility was a feature, not an afterthought.**
The upload endpoint returning `{ url, ref, signed_url }` is *deliberately* redundant. It lets old client code, new client code, and any future refactor all coexist. Shipping private storage without forcing a coordinated frontend deploy was the thing that made this mergeable on a Sunday afternoon.

**3. I chose a read-path fix over a write-path migration.**
Classic trade-off: you can either rewrite everything that *writes* to the DB, or wrap everything that *reads* from it. Reads are safer to change — they don't touch stored data, they're idempotent, and a bug in a read path fails loudly (broken image) instead of silently (corrupted row). For a migration that touches every file in the system, "make reads smarter" is almost always the right answer.

**4. The security bug was invisible because nothing was broken.**
This is the category of bug I actively look for — features that work perfectly but have a wrong default. Public buckets, overly permissive CORS, default admin passwords, unauthenticated health endpoints that leak version info. Nothing crashes, nothing pages oncall, so nobody notices until it's on Hacker News. Auditing for "things that silently fail open" is worth a recurring calendar reminder.

**5. Signed URLs are not a panacea.**
15 minutes is a tradeoff. Too short and legitimate users get broken images on slow pages; too long and a leaked URL is still dangerous. I picked 15 because it covers realistic page-view sessions while keeping the exposure window tight. A future improvement: shorter expiry (5 min) combined with a silent re-sign endpoint that the client calls when an image fails to load.
