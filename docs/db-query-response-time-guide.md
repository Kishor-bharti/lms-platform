# Measuring Database Query Response Time

## Goal
This guide explains how to measure the time spent by **database queries themselves**, not API request time.

That distinction matters:
- **API time** includes authentication, business logic, network latency, serialization, caching, and database time.
- **Database query time** measures how long PostgreSQL spends executing the SQL statement.

If you want to know whether an index is helping, whether a join is slow, or whether a query is doing a sequential scan, you should measure at the database layer.

---

## The 4 Best Ways to Measure Query Time

### 1) `EXPLAIN ANALYZE` for one query
Use this when you want the actual execution time of a specific SQL statement.

```sql
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT *
FROM quiz_attempts
WHERE student_id = '00000000-0000-0000-0000-000000000000'
ORDER BY started_at DESC
LIMIT 20;
```

What it gives you:
- actual execution time
- how many rows were scanned
- whether PostgreSQL used an index or sequential scan
- buffer hits/reads, which helps you understand I/O cost

What to look for:
- **Execution Time**: the real time spent executing the query
- **Seq Scan**: often a warning sign on large tables
- **Index Scan / Index Only Scan**: usually better for selective lookups
- **Rows Removed by Filter**: suggests the filter is not selective enough
- **Shared Read Blocks**: means PostgreSQL had to read from disk/cache

Important:
- `EXPLAIN ANALYZE` actually runs the query.
- On `INSERT`, `UPDATE`, or `DELETE`, it will also perform the write.
- Use with care on production, especially for queries that modify data.

---

### 2) `\timing` in `psql` for quick interactive testing
Use this when you want a very fast manual check from the database client.

```sql
\timing on
SELECT *
FROM sessions
WHERE subject_id = '00000000-0000-0000-0000-000000000000'
  AND status = 'scheduled'
ORDER BY session_date DESC
LIMIT 50;
```

What it gives you:
- elapsed time for the client round-trip
- useful during local development

Limitations:
- includes some client round-trip overhead
- does not explain why a query is fast or slow
- does not show plan details

Use `\timing` for quick checks, but use `EXPLAIN ANALYZE` when you need the reason behind the timing.

---

### 3) `pg_stat_statements` for real workload tracking
Use this when you want to see which queries are slow **over time** and **in aggregate**.

This is the best option for understanding actual production usage.

What it shows:
- total execution time per normalized query
- number of calls
- average execution time
- minimum, maximum, and standard deviation
- rows returned
- shared block hits and reads

Example query:

```sql
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(min_exec_time::numeric, 2) AS min_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  rows,
  query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Why this matters:
- a query that is individually fast but called thousands of times can still be expensive overall
- a query that is slow only once might not matter much
- this gives you a workload-wide view, not just a single test case

Requirements:
- the `pg_stat_statements` extension must be enabled
- the database must be configured to collect query statistics

If you are on PostgreSQL or Supabase, this is typically the first production-safe tool to enable.

---

### 4) `log_min_duration_statement` and `auto_explain` for automatic slow-query logging
Use these when you want PostgreSQL to log slow queries automatically.

#### `log_min_duration_statement`
Logs any statement that runs longer than the threshold.

Example:

```sql
SET log_min_duration_statement = 250;
```

That means queries slower than 250 ms will be logged.

Good for:
- identifying unexpectedly slow SQL
- catching slow queries in staging or production
- building a slow-query list without manually running every query

#### `auto_explain`
Automatically logs execution plans for slow queries.

Typical use:
- set a threshold
- log plans for statements slower than that threshold

This is especially useful when you need to see not just that a query was slow, but **why**.

---

## Recommended Workflow

### Step 1: Test a single query locally
Use `EXPLAIN (ANALYZE, BUFFERS)` first.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT qa.*
FROM quiz_attempts qa
WHERE qa.student_id = '00000000-0000-0000-0000-000000000000'
  AND qa.status = 'submitted'
ORDER BY qa.started_at DESC;
```

This tells you whether the query is using the right index and whether the table is being scanned too much.

### Step 2: Repeat with realistic parameters
A query can be fast for one student and slow for another.

Test with:
- a student who has many rows
- a subject with many quizzes
- a table that is already large
- the exact filters your app uses in production

### Step 3: Compare different versions
Run the same query before and after:
- adding an index
- changing a join
- changing a filter
- removing an `ORDER BY`

You want to confirm the plan and the execution time both improve.

### Step 4: Check aggregate statistics
Use `pg_stat_statements` to find the most expensive queries overall.

That is how you see what matters in real usage, not just in a single test.

### Step 5: Log slow queries automatically
Use `log_min_duration_statement` or `auto_explain` in staging/production so you can catch regressions over time.

---

## How to Interpret the Results

### Fast query
Usually looks like:
- index scan on a selective filter
- low row count
- low execution time
- minimal buffer reads

### Slow query
Usually shows one or more of:
- sequential scan on a large table
- nested loop with many repeated lookups
- sort on too many rows
- many rows removed by filter
- high buffer reads or disk I/O

### Important note
A query can be slow even with indexes if:
- the filter is not selective enough
- the query returns too many rows
- the sort is expensive
- the join order is poor
- the table is bloated or statistics are stale

So the goal is not just “add indexes,” but “measure, inspect the plan, and verify the fix.”

---

## What to Measure in This LMS
These are the types of queries most worth profiling in this project:

- session dashboards
- quiz listing and quiz load queries
- quiz attempt creation and submission queries
- assignment submission lookups
- subject/resource summary views
- student progress dashboards
- teacher permission lookups
- content assignment lookups

For example, these tables are likely to produce frequent timing questions:
- `quiz_attempts`
- `sessions`
- `student_content_assignments`
- `assignment_submissions`
- `subject_enrollments`
- `quiz_write_permissions`

---

## Suggested Measurement Order
If you want to review your database in a disciplined way, use this order:

1. Identify the slow endpoint or screen in the app.
2. Copy the exact SQL query it uses.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` in the database.
4. Confirm whether the plan uses an index or sequential scan.
5. Check `pg_stat_statements` for real-world frequency and cost.
6. Add or remove an index only after confirming the query pattern.
7. Re-test the same query with the same parameters.

---

## Practical Thresholds
A rough guideline for PostgreSQL query time:

- **Under 5 ms**: excellent for common lookups
- **5–20 ms**: usually fine for most app reads
- **20–100 ms**: worth reviewing if it happens often
- **100+ ms**: investigate the query plan
- **500+ ms**: likely a user-visible slowdown

These are not strict rules, but they are useful for prioritizing work.

---

## Local Testing Checklist
When you test a query locally or in staging:

- use the exact SQL
- use realistic parameter values
- test with enough data in the table
- run the query more than once if caching may affect results
- compare execution time with and without the candidate index
- check whether the index is actually used

---

## Bottom Line
If you want to know **how long a query takes in the database**, do not start with API logs.

Start with:
- `EXPLAIN (ANALYZE, BUFFERS)` for one query
- `pg_stat_statements` for workload-wide analysis
- `log_min_duration_statement` or `auto_explain` for slow-query detection

That is the most reliable way to measure database response time and decide whether an index is worth keeping.
