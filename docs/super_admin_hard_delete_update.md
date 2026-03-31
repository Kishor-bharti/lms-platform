# Super Admin, Hard Delete & Storage Restructure Update

**Date:** 2026-03-31
**Branch:** `next-mission`
**Scope:** Backend (server), Frontend (client), Database (SQL)

---

## Table of Contents

1. [Overview](#overview)
2. [What Was Updated](#what-was-updated)
3. [Database Changes](#database-changes)
4. [Storage Bucket Restructure](#storage-bucket-restructure)
5. [New API Endpoints](#new-api-endpoints)
6. [Hard Delete Logic — Deep Dive](#hard-delete-logic--deep-dive)
7. [Password Management Changes](#password-management-changes)
8. [Frontend Changes](#frontend-changes)
9. [Challenges Faced & Solutions](#challenges-faced--solutions)
10. [Setup / Migration Steps](#setup--migration-steps)
11. [Files Changed](#files-changed)

---

## Overview

This update introduces the **Super Admin** concept, a **user detail panel**, **hard delete** functionality for permanently removing users and their data, a **storage bucket restructure** to separate temporary and permanent files, and **password management** restricted to the super admin only.

The driving goal: when a student completes their coursework or a user is no longer associated with the platform, an administrator (specifically the super admin) should be able to permanently remove that user and all their data — including uploaded files — to free up storage and keep the database clean. At the same time, published course content created by teachers must be preserved because once published, it belongs to the portal.

---

## What Was Updated

| Area | Change |
|------|--------|
| **Database** | Added `is_super_admin` and `description` columns to `users` table |
| **Seed** | First seeded admin (`admin@10xaccel.com`) is marked as super admin |
| **Storage** | Renamed `assignment-files` bucket to `portal-assets`; added `temp-uploads` bucket |
| **Upload logic** | Admin uploads go to `portal-assets`; teacher/student uploads go to `temp-uploads` |
| **Publish flow** | On publish, files are **moved** (not copied) from `temp-uploads` to `portal-assets` |
| **Admin Panel** | Detail button, password reset, hard delete in Users table |
| **Create User** | Added `description` field |
| **Password** | Change password removed for all non-super-admin users (frontend + backend) |
| **Deactivation** | Super admin cannot be deactivated (button hidden + server enforced) |
| **Hard Delete** | Full cascade delete with password confirmation, super admin only |
| **Auth/Login** | Login response now includes `isSuperAdmin` flag |

---

## Database Changes

### Migration: `server/sql/migrations/super_admin_and_description.sql`

```sql
-- Add is_super_admin flag (only ONE user can have this set to TRUE)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Add description column
ALTER TABLE users ADD COLUMN IF NOT EXISTS description TEXT;

-- Mark the original seeded admin
UPDATE users SET is_super_admin = TRUE WHERE email = 'admin@10xaccel.com';

-- Database-level enforcement: only one super admin
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_super_admin
  ON users (is_super_admin) WHERE is_super_admin = TRUE;
```

The **partial unique index** (`WHERE is_super_admin = TRUE`) is the key design choice here. It allows unlimited rows with `is_super_admin = FALSE` but guarantees at most one row can have `TRUE`. This is enforced at the PostgreSQL level — no application code can bypass it.

### Seed Update: `server/sql/seed.sql`

The seeded admin now includes `is_super_admin = TRUE` and `description = 'Platform super administrator'`.

---

## Storage Bucket Restructure

### Before

| Bucket | Contents |
|--------|----------|
| `quiz-images` | Quiz question/option images |
| `assignment-files` | Everything else (assignments, materials, student uploads) |

### After

| Bucket | Contents |
|--------|----------|
| `quiz-images` | Quiz question/option images (unchanged) |
| `portal-assets` | Published portal content — assignment attachments, materials once published |
| `temp-uploads` | Temporary/unpublished files — student uploads, teacher drafts |

### Why?

The old model stored everything in one bucket. When deleting a user, we couldn't safely distinguish which files belonged to published (permanent) vs. unpublished (deletable) content without querying the database for each file. The new structure makes this clear by design:

- **`temp-uploads`**: safe to delete when user is removed
- **`portal-assets`**: permanent, belongs to the portal regardless of who uploaded it

### File Movement on Publish

When an admin publishes a material or assignment, the associated file is **moved** from `temp-uploads` to `portal-assets` using a download-upload-delete pattern (Supabase doesn't have a native move/rename operation). The database URL is updated to point to the new location.

This is implemented in `server/src/utils/storage.ts` via `moveFileBetweenBuckets()`.

### Upload Routing

The upload controller (`server/src/modules/upload/upload.controller.ts`) now routes files based on the uploader's role:
- **Admin** uploads go directly to `portal-assets`
- **Teacher/Student** uploads go to `temp-uploads`

---

## New API Endpoints

All under `POST /api/admin/...` (require `authMiddleware` + `rbacMiddleware(['admin'])`):

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| `GET` | `/users/:userId/detail` | Any admin | Full user details including timestamps, description |
| `POST` | `/verify-password` | Super admin | Verify admin's own password before sensitive operations |
| `POST` | `/users/:userId/reset-password` | Super admin | Reset any user's password (requires admin password confirmation) |
| `DELETE` | `/users/:userId/hard-delete` | Super admin | Permanently delete user and all their data |

---

## Hard Delete Logic — Deep Dive

This was the most complex part of the update. The `hardDeleteUser` function in `admin.service.ts` handles the full cascade.

### For Teachers

When a teacher is deleted:

1. **Published content is preserved** — ownership of published quizzes, assignments, materials, and questions is transferred to the super admin via `UPDATE ... SET created_by = superAdminId`
2. **Unpublished content is deleted** — unpublished materials, assignments, quizzes and their child records (questions, options, quiz sets, attempts)
3. **Sessions are deleted** — all sessions created by the teacher, along with session_students records
4. **Role assignments cleaned up** — subject_teachers, subject_teacher_students, quiz_write_permissions
5. **File URLs collected** — all file URLs from unpublished content are collected and batch-deleted from Supabase storage after the DB transaction commits

### For Students

When a student is deleted:

1. **All quiz attempts deleted** — attempt_answers first (FK dependency), then quiz_attempts
2. **All submissions deleted** — assignment_submissions with their file URLs
3. **All uploads deleted** — student_uploads with their file URLs
4. **Progress cleared** — student_progress records
5. **Enrollments removed** — subject_enrollments, session_students, subject_teacher_students, student_content_assignments
6. **Storage files deleted** — submission files, upload files, feedback files

### For All Users (regardless of role)

- Foreign key references where the deleted user assigned/enrolled/graded others are transferred to the super admin (`assigned_by`, `enrolled_by`, `graded_by`, `granted_by`, `created_by` on courses/subjects/topics)
- `user_roles` records are deleted
- The `users` row itself is deleted last

### Safety Checks

- Cannot delete the super admin (checked in service + unique index prevents re-marking)
- Requires the super admin to confirm their own password before deletion
- Storage file deletion happens **after** the DB transaction commits — if DB operations fail, no files are deleted
- If file deletion partially fails, it's logged but doesn't roll back the DB changes (the data is already gone, stale files are acceptable)

---

## Password Management Changes

### Before

- Any authenticated user could change their own password via `POST /api/profile/me/password`
- No admin-side password reset existed

### After

- `POST /api/profile/me/password` is restricted to **super admin only** (server-side check on `is_super_admin`)
- The Profile page hides the "Change Password" section for non-super-admin users
- Super admin can reset any user's password via `POST /api/admin/users/:userId/reset-password` (requires own password confirmation)
- Super admin cannot reset their own password through the admin endpoint (must use Profile page)

---

## Frontend Changes

### Admin Users Page (`client/src/views/admin/AdminUsers.js`)

1. **Detail Button** — new button in the Actions column for every user, opens a modal with:
   - Avatar initials, name, email
   - User ID (monospace for easy copying)
   - Phone, status, roles, description
   - Created at, last updated, last login (with full date+time)
   - Actions: Reset Password, Hard Delete (super admin only, not shown for the super admin's own row)

2. **SUPER Badge** — super admin user shows a red "SUPER" badge next to their name

3. **Deactivate Button** — hidden for the super admin user row

4. **Hard Delete Button** — shown only if the current user is super admin, and not for the super admin's own row. Opens a confirmation modal with:
   - Warning message explaining what will be deleted
   - Role-specific notes (different warnings for teachers vs students)
   - Password confirmation field

5. **Reset Password Modal** — super admin only, requires own password + new password + confirmation

6. **Create User Modal** — added `Description` textarea field

### Profile Page (`client/src/views/examples/Profile.js`)

- "Change Password" section is conditionally rendered only when `profile.is_super_admin === true`

### Auth Flow

- Login response now includes `isSuperAdmin` in the user object
- Stored in `localStorage` as part of the `user` JSON, accessed via `JSON.parse(localStorage.getItem('user')).isSuperAdmin`

---

## Challenges Faced & Solutions

### 1. Foreign Key Dependencies During Hard Delete

**Challenge:** The `users` table is referenced by 27+ other tables with various ON DELETE behaviors (CASCADE, SET NULL, or no action). Simply deleting the user row would either fail due to FK constraints or cascade-delete things we want to keep (published content).

**Solution:** Manual cascade in a specific order within a single transaction:
1. Transfer ownership of published content to super admin first
2. Delete unpublished content explicitly (collecting file URLs along the way)
3. Clean up all junction table references
4. Update all `assigned_by`/`created_by`/`granted_by` foreign keys to point to super admin
5. Delete user_roles, then the user row

The `attempt_answers` table was particularly tricky — it references `questions(id)` without ON DELETE CASCADE, so deleting quizzes would fail if attempt_answers still existed. We delete attempt_answers first for both student attempts and quiz-level cascades.

### 2. Supabase Has No Native File Move Operation

**Challenge:** Supabase Storage doesn't support moving or renaming files across buckets. When publishing content, we needed to move files from `temp-uploads` to `portal-assets`.

**Solution:** Implemented a download-upload-delete pattern in `server/src/utils/storage.ts`:
1. Download the file from the source bucket into memory
2. Upload it to the target bucket with the same path
3. Delete the original from the source bucket
4. Update the database URL to point to the new location

The function is idempotent — if the file is already in the target bucket, it returns the existing URL without doing anything. If the move fails, the original URL is preserved and a warning is logged.

### 3. Ensuring Only One Super Admin Exists

**Challenge:** Need to guarantee at the database level that no one can accidentally create a second super admin through direct SQL or a bug.

**Solution:** PostgreSQL partial unique index:
```sql
CREATE UNIQUE INDEX idx_single_super_admin ON users(is_super_admin) WHERE is_super_admin = TRUE;
```
This allows any number of `FALSE` values but only one `TRUE`. Any attempt to set a second user as super admin will fail with a unique constraint violation.

### 4. Cascading File Deletion Without Losing Data on DB Failure

**Challenge:** If we delete storage files during the transaction and the transaction rolls back, the files are gone but the database still references them — broken URLs.

**Solution:** Collect all file URLs during the transaction but only perform the actual Supabase storage deletions **after** the transaction commits successfully. The `withTransaction().then()` pattern ensures files are only deleted when the DB changes are committed. If file deletion partially fails, it's logged but doesn't affect the DB state.

### 5. TypeScript Strict Null Checks on Regex Match Groups

**Challenge:** `string.match()` returns `(string | undefined)[]` for capture groups. Assigning `match[1]` to a `string` type field caused a TS error.

**Solution:** Used non-null assertion (`match[1]!`) after confirming the match exists (the `if (!match) return null` guard guarantees the groups are defined).

### 6. Distinguishing Admin-Uploaded vs Teacher-Uploaded Files

**Challenge:** When an admin creates content directly, the file should go to `portal-assets` immediately (admin content is implicitly "published-grade"). But teacher uploads should go to `temp-uploads` until published.

**Solution:** The upload controller checks `req.user.role` to determine the target bucket. Admin role routes to `portal-assets`, all other roles route to `temp-uploads`. This means admin-created content doesn't need the move-on-publish step.

### 7. Preventing Super Admin Self-Destruction

**Challenge:** Multiple attack vectors where the super admin could lock themselves out — deactivating themselves, deleting themselves, resetting their own password through the admin endpoint (which doesn't verify the current password).

**Solution:** Multi-layered protection:
- Frontend: deactivate button hidden, delete button hidden for super admin row
- Backend: `toggleUserActive` checks `isSuperAdmin()` and rejects deactivation
- Backend: `hardDeleteUser` checks `is_super_admin` flag and rejects
- Backend: `resetUserPassword` rejects if target is super admin (use Profile page instead, which requires current password)

---

## Setup / Migration Steps

### 1. Run the Database Migration

```bash
psql $DATABASE_URL -f server/sql/migrations/super_admin_and_description.sql
```

This adds the new columns and marks the existing seeded admin as super admin.

### 2. Create Supabase Storage Buckets

In your Supabase Dashboard > Storage:

1. **Create** a new public bucket named `portal-assets`
   - Set to **Public** access
   - No MIME type restrictions
2. **Create** a new public bucket named `temp-uploads`
   - Set to **Public** access
   - No MIME type restrictions
3. If you have existing files in `assignment-files`, **copy** them to `portal-assets`
4. The `quiz-images` bucket remains unchanged

### 3. Update Environment Variables (if using custom names)

```env
# Optional — these are the defaults
SUPABASE_PORTAL_BUCKET=portal-assets
SUPABASE_TEMP_BUCKET=temp-uploads
```

The old `SUPABASE_ASSIGNMENT_BUCKET` variable is no longer used.

### 4. Re-login Required

Existing users need to log out and log back in to get the `isSuperAdmin` flag in their localStorage user data. The admin panel will function correctly after re-login.

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `server/sql/migrations/super_admin_and_description.sql` | Database migration |
| `server/src/utils/storage.ts` | Supabase storage utilities (move, delete, parse URL) |

### Modified Files — Server
| File | Changes |
|------|---------|
| `server/sql/schema.sql` | Added `description`, `is_super_admin` columns + unique index |
| `server/sql/seed.sql` | Super admin flag on seeded user |
| `server/src/config/env.ts` | `SUPABASE_PORTAL_BUCKET` + `SUPABASE_TEMP_BUCKET` replacing `SUPABASE_ASSIGNMENT_BUCKET` |
| `server/src/modules/admin/admin.service.ts` | `getUserDetail`, `verifyAdminPassword`, `resetUserPassword`, `hardDeleteUser`, `isSuperAdmin`; updated `AdminUser` interface and `createUser`/`getUsers` |
| `server/src/modules/admin/admin.controller.ts` | New endpoints + super admin guard on `toggleUserActive` |
| `server/src/modules/admin/admin.routes.ts` | 4 new routes |
| `server/src/modules/auth/auth.service.ts` | `is_super_admin` in login query + response |
| `server/src/modules/auth/auth.types.ts` | `is_super_admin` in `UserRow`, `isSuperAdmin` in `LoginResponse` |
| `server/src/modules/profile/profile.service.ts` | `is_super_admin` in profile query + `UserProfile` interface |
| `server/src/modules/profile/profile.controller.ts` | Super admin check on `changePassword` |
| `server/src/modules/upload/upload.controller.ts` | Role-based bucket routing |
| `server/src/modules/materials/materials.service.ts` | File move on publish |
| `server/src/modules/assignment/assignment.service.ts` | File move on publish |

### Modified Files — Client
| File | Changes |
|------|---------|
| `client/src/views/admin/AdminUsers.js` | Detail modal, password reset modal, hard delete modal, description in create form, super admin protections |
| `client/src/views/examples/Profile.js` | Change password hidden for non-super-admin |
