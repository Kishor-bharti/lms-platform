# SQL Index Review

## Scope
Reviewed:
- `server/sql/schema.sql`
- `server/sql/migrations/add_content_assignment_system.sql`
- `server/sql/migrations/add_quiz_write_permissions.sql`
- `server/sql/migrations/course_level_content_assignments.sql`

## Short Answer
The schema is **more read-optimized than write-optimized**.

That is not automatically a problem: for an LMS, read-heavy workloads are common, especially for dashboards, subject pages, quiz listings, progress views, and admin reports. However, this schema does have **many secondary indexes**, and several tables are carrying enough index overhead that writes will become more expensive as data volume grows.

## What Looks Good
- The schema has indexes for the most common lookup patterns: by `student_id`, `subject_id`, `quiz_id`, `assignment_id`, `session_date`, and status fields.
- The reporting views in the schema are supported by sensible access paths for joins and filters.
- The migrations use `IF NOT EXISTS`, so they are safe to apply repeatedly.
- The schema uses primary keys and unique constraints to enforce data integrity, which is good for correctness.

## Where Write Cost Is High
Every extra index makes `INSERT`, `UPDATE`, and `DELETE` work harder because PostgreSQL must maintain the index entries too.

The biggest write-cost tables are likely:
- `quiz_attempts`
- `sessions`
- `student_content_assignments`
- `subject_enrollments`
- `assignment_submissions`
- `quiz_write_permissions`

Some of these tables have several secondary indexes plus a primary key and one or more unique constraints. For example, a write to `quiz_attempts` touches the primary key, the unique constraint, and multiple lookup indexes.

## Possible Redundancies
A few indexes appear potentially redundant because the table already has a primary key or unique index with the same leading column(s):

- `subject_teachers` has a composite primary key on `(subject_id, teacher_id)` and also separate indexes on `subject_id` and `teacher_id`.
- `subject_teacher_students` has a composite primary key on `(subject_id, teacher_id, student_id)` plus a separate `(subject_id, teacher_id)` index.
- `options` has `UNIQUE (question_id, option_label)` and also a separate index on `question_id`.
- `subject_enrollments` has `UNIQUE (subject_id, student_id)` and also a separate index on `subject_id`.
- `student_progress` has `UNIQUE (student_id, subject_id)` and also a separate index on `student_id`.
- `quiz_write_permissions` has `UNIQUE (quiz_id, teacher_id)` plus separate indexes on `quiz_id` and `teacher_id`.

Some of those extra indexes may still be justified if the app frequently queries by the non-leading column alone. But from a schema-design perspective, they should be treated as candidates for pruning or validation with real query plans.

## Database Size Impact
Yes, the schema will increase database size more than a lean schema would.

Reasons:
- Each index stores a copy of indexed values plus row pointers.
- UUID-based keys are relatively large, so index entries are not tiny.
- Composite indexes multiply storage more than single-column indexes.
- Unique constraints and primary keys also create indexes automatically.

So the schema is not just write-expensive; it is also **index-storage-heavy**, especially for large tables with many rows.

## Overall Verdict
### Current state
- **Read optimization:** good to strong for the current feature set
- **Write optimization:** moderate to weak if the system gets heavy activity traffic
- **Storage efficiency:** acceptable now, but not lean

### Practical interpretation
If this LMS is expected to have:
- lots of dashboard/report reads,
- moderate data volume,
- and relatively fewer writes,

then the current design is reasonable.

If it is expected to have:
- frequent quiz attempts,
- heavy assignment submission traffic,
- many session updates,
- and fast-growing tenant data,

then the index count should be trimmed and re-validated against real query patterns.

## Recommendations
1. Keep the indexes that directly support high-value filters and joins.
2. Review redundant prefix indexes before production scale increases.
3. Use `EXPLAIN ANALYZE` on the slowest read queries before removing anything.
4. Check `pg_stat_user_indexes` to see which indexes are actually used.
5. For write-heavy tables, prefer fewer but higher-value indexes.
6. Revisit the schema after real workload data is available.

## Final Take
This schema is **not badly designed**, but it is clearly **biased toward read performance and enforcement of constraints**, not minimal write cost. That means it should work well for an LMS with reporting and dashboard usage, but it will likely grow write overhead and storage usage as the dataset gets larger.
