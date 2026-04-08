# DB Query Response Time Cheat Sheet

## Use This When
You want to measure the time spent by the **database query itself**, not the full API request.

## Best Tools
- `EXPLAIN (ANALYZE, BUFFERS)` — best for one query
- `\timing on` in `psql` — quick manual timing
- `pg_stat_statements` — best for real workload analysis
- `log_min_duration_statement` — logs slow SQL automatically
- `auto_explain` — logs the plan for slow queries

## Quick Commands

### 1) Measure one query
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM quiz_attempts
WHERE student_id = '00000000-0000-0000-0000-000000000000'
ORDER BY started_at DESC
LIMIT 20;
```

### 2) Quick timing in `psql`
```sql
\timing on
SELECT * FROM sessions WHERE subject_id = '00000000-0000-0000-0000-000000000000';
```

### 3) Find expensive queries
```sql
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

## How to Read Results
- **Seq Scan**: often slow on large tables
- **Index Scan / Index Only Scan**: usually better for selective filters
- **Execution Time**: the actual query time
- **Rows Removed by Filter**: query may need a better index or filter
- **Shared Read Blocks**: possible disk I/O cost

## What to Watch Most in This LMS
- `quiz_attempts`
- `sessions`
- `student_content_assignments`
- `assignment_submissions`
- `subject_enrollments`
- `quiz_write_permissions`

## Simple Rule
- **< 5 ms**: excellent
- **5–20 ms**: usually fine
- **20–100 ms**: review if frequent
- **100+ ms**: investigate
- **500+ ms**: likely a user-visible slowdown

## Recommended Workflow
1. Copy the exact SQL the app runs.
2. Run `EXPLAIN (ANALYZE, BUFFERS)`.
3. Check whether PostgreSQL uses an index.
4. Verify the query with realistic parameters.
5. Compare before/after any index change.
6. Use `pg_stat_statements` to confirm real-world cost.

## Bottom Line
Use `EXPLAIN ANALYZE` for one query, and `pg_stat_statements` for real workload performance.
