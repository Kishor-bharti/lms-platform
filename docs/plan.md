# LMS Additions Plan (Admin Permission Control + P2 Features)

## 1) Objective

Implement admin-controlled, fine-grained permissions so admins can decide exactly what each teacher can do (create/edit/delete/publish for assignments, quizzes, practice, materials, sessions), then expand into scale/polish features:
- Notifications/reminders
- Parent/guardian portal (optional by segment)
- Adaptive recommendations
- Admin audit dashboards

---

## 2) Scope

### A. Fine-Grained Permission System (P0/P1)
Replace coarse role-only behavior with **role + permission + scope** checks.

#### Core permissions (initial set)
- `assignment.create`, `assignment.edit`, `assignment.delete`, `assignment.publish`
- `quiz.create`, `quiz.edit`, `quiz.delete`, `quiz.publish`
- `practice.create`, `practice.edit`, `practice.delete`, `practice.publish`
- `material.create`, `material.edit`, `material.delete`, `material.publish`
- `session.create`, `session.edit`, `session.delete`, `session.publish`
- `report.view_all`, `report.export`

#### Scope model
Permissions may be scoped to:
- org/global
- course
- subject
- batch/class

Example: Teacher X can `quiz.create` only in Subject A.

#### Admin UX
- Permission templates (e.g., Junior Teacher, Senior Teacher, Coordinator)
- Per-user overrides
- Expiry for temporary grants
- Action history (who changed permissions and when)

---

### B. Notifications/Reminders (P2)
- Event types:
  - Upcoming session
  - Assignment due soon / overdue
  - Quiz published
  - Grades released
- Channels:
  1. In-app (first release)
  2. Email (second release)
- Student controls:
  - Mute by category
  - Reminder timing preferences

---

### C. Parent/Guardian Portal (P2, optional by target market)
- Parent linked to one or more students
- Views:
  - Attendance
  - Pending assignments
  - Recent scores
  - Weak topics
  - Weekly digest

---

### D. Adaptive Recommendations (P2)
- Build topic mastery per student from quiz attempts
- Recommend:
  - Remedial content for weak topics
  - Next practice set difficulty
- Start with rule-based logic; later ML optional

---

### E. Admin Audit Dashboard (P2)
Operational + engagement KPIs:
- Class start-time SLA
- Grading turnaround SLA
- Submission/completion rates
- DAU/WAU
- Attendance rate
- Quiz pass rate by teacher/course/subject

---

## 3) Data Model Changes (Proposed)

## Permission/RBAC tables
- `permissions(id, key, module, description)`
- `roles(id, name, is_system)`
- `role_permissions(role_id, permission_id)`
- `user_roles(user_id, role_id)`
- `user_permission_scopes(id, user_id, permission_id, scope_type, scope_id, expires_at)`
- `permission_audit_logs(id, actor_user_id, target_user_id, change_json, created_at)`

## Notifications
- `notifications(id, user_id, type, title, body, data_json, read_at, created_at)`
- `notification_preferences(user_id, type, enabled, reminder_offset_min)`
- `notification_jobs(id, event_type, payload_json, status, run_at)`

## Parent portal
- `guardian_links(id, guardian_user_id, student_user_id, relation, status)`

## Recommendations
- `topic_mastery(student_id, topic_id, mastery_score, updated_at)`
- `recommendation_events(id, student_id, recommendation_type, payload_json, created_at)`

---

## 4) Backend/API Plan

### Phase 1: Permission foundation
1. Add permission middleware: `requirePermission(permissionKey, scopeResolver)`
2. Apply to:
   - Assignment endpoints
   - Quiz endpoints
   - Practice endpoints
   - Material endpoints
   - Session endpoints
3. Add admin APIs:
   - List permissions
   - Assign role/template to user
   - Add scoped permission override
   - Revoke permission

### Phase 2: Notifications
1. Emit events from assignment/quiz/session workflows
2. Create in-app notification records
3. Add unread counts and mark-as-read APIs

### Phase 3: Parent + Recommendations + Dashboards
1. Guardian link/approval flow
2. Topic mastery updater from quiz attempts
3. KPI aggregation jobs + dashboard endpoints

---

## 5) Frontend Plan

- Admin page: **Permission Matrix**
  - Rows: users or templates
  - Columns: permissions
  - Scope picker (global/course/subject)
  - Expiry date support
- Teacher UI:
  - Hide/disable actions without permission
- Student UI:
  - Notification center + preferences
- Parent UI:
  - Student summary dashboard
- Admin UI:
  - KPI dashboard with date/course filters

---

## 6) Rollout Strategy

1. Ship with feature flag: `fine_grained_permissions`
2. Backward compatibility:
   - Existing `admin/teacher/student` mapped to default templates
3. Dry-run mode:
   - Log denied actions before strict enforcement
4. Enable strict mode after validation

---

## 7) Acceptance Criteria

- Admin can configure teacher actions at per-module level
- Scoped restrictions are enforced server-side
- Unauthorized actions fail with clear 403 reason
- Permission changes are auditable
- Notification events are delivered in-app reliably
- Dashboard reflects SLA and engagement metrics accurately

---

## 8) Risks & Mitigations

- **Risk:** Permission complexity confusion  
  **Mitigation:** Start with templates + minimal overrides
- **Risk:** Missing scope checks in some endpoints  
  **Mitigation:** Central middleware + endpoint audit checklist
- **Risk:** Noisy notifications  
  **Mitigation:** Preference controls + digest mode
- **Risk:** Performance for dashboard aggregates  
  **Mitigation:** Precompute daily summaries/materialized views

---

## 9) Suggested Timeline (6 weeks)

- **Week 1–2:** DB + middleware + admin permission APIs
- **Week 3:** Apply checks to assignments/quizzes/materials/sessions
- **Week 4:** Admin permission matrix UI + audit logs
- **Week 5:** Notifications (in-app) + preferences
- **Week 6:** KPI dashboard v1 + stabilization/testing


```psql
-- file name: rdbc_permission_migration.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) Core RBAC Tables
-- =========================================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS user_permission_scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'course', 'subject', 'batch')),
  scope_id UUID,
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g. GRANT_ROLE, REVOKE_ROLE, GRANT_SCOPE, REVOKE_SCOPE
  change_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- global scope should not carry scope_id
ALTER TABLE user_permission_scopes
  DROP CONSTRAINT IF EXISTS chk_user_permission_scope_global;

ALTER TABLE user_permission_scopes
  ADD CONSTRAINT chk_user_permission_scope_global
  CHECK (
    (scope_type = 'global' AND scope_id IS NULL)
    OR
    (scope_type <> 'global')
  );

-- =========================================================
-- 2) Indexes
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_scopes_user_id ON user_permission_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permission_scopes_permission_id ON user_permission_scopes(permission_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_actor ON permission_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_target ON permission_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_created_at ON permission_audit_logs(created_at DESC);

-- =========================================================
-- 3) Seed Permissions
-- =========================================================

INSERT INTO permissions (key, module, description) VALUES
  ('assignment.create', 'assignment', 'Create assignments'),
  ('assignment.edit', 'assignment', 'Edit assignments'),
  ('assignment.delete', 'assignment', 'Delete assignments'),
  ('assignment.publish', 'assignment', 'Publish assignments'),

  ('quiz.create', 'quiz', 'Create quizzes'),
  ('quiz.edit', 'quiz', 'Edit quizzes'),
  ('quiz.delete', 'quiz', 'Delete quizzes'),
  ('quiz.publish', 'quiz', 'Publish quizzes'),

  ('practice.create', 'practice', 'Create practice sets'),
  ('practice.edit', 'practice', 'Edit practice sets'),
  ('practice.delete', 'practice', 'Delete practice sets'),
  ('practice.publish', 'practice', 'Publish practice sets'),

  ('material.create', 'material', 'Create/upload materials'),
  ('material.edit', 'material', 'Edit materials'),
  ('material.delete', 'material', 'Delete materials'),
  ('material.publish', 'material', 'Publish materials'),

  ('session.create', 'session', 'Create sessions'),
  ('session.edit', 'session', 'Edit sessions'),
  ('session.delete', 'session', 'Delete sessions'),
  ('session.publish', 'session', 'Publish sessions'),

  ('report.view_all', 'report', 'View all reports'),
  ('report.export', 'report', 'Export reports')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- 4) Seed System Roles
-- =========================================================

INSERT INTO roles (name, is_system) VALUES
  ('admin', true),
  ('teacher', true),
  ('student', true)
ON CONFLICT (name) DO NOTHING;

-- =========================================================
-- 5) Role -> Permission mapping
-- =========================================================

-- Admin: all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Teacher: standard authoring permissions + report view/export
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.key IN (
  'assignment.create','assignment.edit','assignment.publish',
  'quiz.create','quiz.edit','quiz.publish',
  'practice.create','practice.edit','practice.publish',
  'material.create','material.edit','material.publish',
  'session.create','session.edit','session.publish',
  'report.view_all','report.export'
)
WHERE r.name = 'teacher'
ON CONFLICT DO NOTHING;

-- Student: no authoring permissions (keep empty by design)

-- =========================================================
-- 6) Optional backfill from users.role (if column exists)
-- =========================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'role'
  ) THEN
    INSERT INTO user_roles (user_id, role_id)
    SELECT u.id, r.id
    FROM users u
    JOIN roles r ON lower(r.name) = lower(u.role)
    ON CONFLICT (user_id, role_id) DO NOTHING;
  END IF;
END $$;

COMMIT;
```