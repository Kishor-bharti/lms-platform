# Production Logging Guide

This document explains how logging works in the LMS server, where log files live, and how to read them when debugging production issues.

---

## How Logging Works

The server uses **[Winston](https://github.com/winstonjs/winston)** with **daily log rotation**.

### Log Levels (low number = most severe)

| Level | Number | When it's used |
|-------|--------|----------------|
| `error` | 0 | Unhandled exceptions, DB failures, Zoom API failures, 5xx responses |
| `warn`  | 1 | Auth failures (401/403), rate-limit hits, CORS rejections, slow requests (>2s) |
| `info`  | 2 | Startup events, DB connection, server ready, graceful shutdown |
| `http`  | 3 | Every HTTP request/response (method, path, status, duration, user ID) |
| `debug` | 4 | Only in development — verbose details |

### Environment behaviour

| Environment | Console output | File output | Level logged |
|-------------|---------------|-------------|--------------|
| `development` | Pretty, coloured | None | `debug` (all) |
| `production` | JSON | 3 rotating log files | `http` (all except debug) |
| `test` | Pretty, coloured | None | `debug` |

---

## Log File Locations (Production)

By default, log files are written to a `logs/` directory **inside the server working directory** (i.e. where you run `node dist/server.js` from, usually the `server/` folder).

```
server/
└── logs/
    ├── combined-2026-03-04.log   ← all info+ events
    ├── error-2026-03-04.log      ← errors only (fastest way to spot problems)
    └── http-2026-03-04.log       ← every HTTP request (traffic analysis)
```

### Override the log directory

Set the `LOG_DIR` environment variable in `.env.production`:

```env
LOG_DIR=/var/log/lms
```

This is recommended on a real server so logs survive deployments.

### Override the log level

```env
LOG_LEVEL=debug   # enable verbose logging temporarily in production
```

---

## Retention Policy

| File | Retained for | Max size |
|------|-------------|----------|
| `combined-*.log` | 14 days | 50 MB per file |
| `error-*.log` | 30 days | 20 MB per file |
| `http-*.log` | 7 days | 100 MB per file |

Old files are **deleted automatically** by `winston-daily-rotate-file`.

---

## Reading Logs on a Production Server

### 1. SSH into the server

```bash
ssh user@your-server-ip
cd /path/to/server    # wherever you run npm start from
```

### 2. Tail live logs (real-time debugging)

```bash
# Watch everything live
tail -f logs/combined-$(date +%Y-%m-%d).log

# Watch errors only
tail -f logs/error-$(date +%Y-%m-%d).log

# Watch HTTP traffic
tail -f logs/http-$(date +%Y-%m-%d).log
```

### 3. Pretty-print JSON logs

Each line in a production log file is a JSON object. Use `jq` to read them:

```bash
# Pretty print last 20 lines
tail -20 logs/combined-$(date +%Y-%m-%d).log | jq .

# Show only the message and timestamp
tail -50 logs/error-$(date +%Y-%m-%d).log | jq '{time: .timestamp, msg: .message, path: .path, user: .user_id}'
```

### 4. Search for a specific error

```bash
# Find all errors in today's combined log
grep '"level":"error"' logs/combined-$(date +%Y-%m-%d).log | jq .

# Find all requests by a specific user ID
grep '<user-uuid>' logs/http-$(date +%Y-%m-%d).log | jq .

# Find all 500 responses
grep '"status":500' logs/http-$(date +%Y-%m-%d).log | jq .

# Find all slow requests (>2s warning)
grep 'Slow request' logs/combined-$(date +%Y-%m-%d).log | jq .

# Find all failed logins
grep 'invalid or expired' logs/combined-$(date +%Y-%m-%d).log | jq .

# Find all rate-limit hits
grep 'Rate limit hit' logs/combined-$(date +%Y-%m-%d).log | jq .
```

### 5. Search across multiple days

```bash
# All errors across the last 3 days
cat logs/error-*.log | grep '"level":"error"' | jq '{time: .timestamp, msg: .message, path: .path}'

# Count errors per day
for f in logs/error-*.log; do echo "$f: $(wc -l < $f) errors"; done
```

---

## Log Entry Structure

Every log line in production is a JSON object. Here are the key shapes:

### HTTP request log (`http-*.log`)
```json
{
  "level": "http",
  "message": "HTTP request",
  "timestamp": "2026-03-04T10:23:45.123Z",
  "method": "POST",
  "path": "/api/auth/login",
  "status": 200,
  "duration_ms": 145,
  "ip": "203.0.113.42",
  "user_id": "uuid-of-logged-in-user",
  "role": "teacher",
  "user_agent": "Mozilla/5.0 ..."
}
```

### Error log (`error-*.log`)
```json
{
  "level": "error",
  "message": "Unhandled server error",
  "timestamp": "2026-03-04T10:23:45.123Z",
  "status": 500,
  "path": "/api/quizzes/submit",
  "method": "POST",
  "user_id": "uuid",
  "role": "student",
  "ip": "203.0.113.42",
  "code": "INTERNAL_SERVER_ERROR"
}
```

### Auth/security warning
```json
{
  "level": "warn",
  "message": "Auth: invalid or expired access token",
  "timestamp": "2026-03-04T10:23:45.123Z",
  "path": "/api/admin/users",
  "method": "GET",
  "ip": "203.0.113.42"
}
```

### Slow request warning
```json
{
  "level": "warn",
  "message": "Slow request detected",
  "timestamp": "2026-03-04T10:23:45.123Z",
  "method": "GET",
  "path": "/api/progress/my",
  "duration_ms": 3241,
  "status": 200,
  "user_id": "uuid"
}
```

---

## Common Debug Scenarios

### "The app crashed and I don't know why"

```bash
# Check errors from today
tail -100 logs/error-$(date +%Y-%m-%d).log | jq .

# Check the combined log around the crash time
grep '2026-03-04T14:3' logs/combined-$(date +%Y-%m-%d).log | jq .
```

### "A user says they can't log in"

```bash
# Find all login attempts from their IP or with their email pattern
grep 'Login error\|INVALID_CREDENTIALS\|invalid or expired' logs/combined-$(date +%Y-%m-%d).log | jq .

# Check rate limiting
grep 'Rate limit hit' logs/combined-$(date +%Y-%m-%d).log | jq .
```

### "The API feels slow"

```bash
# Find all slow requests (>2s)
grep 'Slow request' logs/combined-$(date +%Y-%m-%d).log | jq '{path: .path, ms: .duration_ms}'

# Check average response time for a specific endpoint
grep '"/api/quizzes"' logs/http-$(date +%Y-%m-%d).log | jq '.duration_ms' | awk '{s+=$1; n++} END {print "avg:", s/n, "ms over", n, "requests"}'
```

### "Zoom meetings aren't being created"

```bash
grep 'Zoom' logs/error-$(date +%Y-%m-%d).log | jq .
```

### "Something happened yesterday, not today"

```bash
# List all available log dates
ls logs/

# Query a specific date
tail -200 logs/error-2026-03-03.log | jq .
```

---

## If You're Using a Process Manager (PM2)

If the server runs under **PM2**, logs are also captured by PM2 in addition to the files above:

```bash
# View live server output
pm2 logs lms-server

# View last 200 lines
pm2 logs lms-server --lines 200
```

The Winston file logs are still the primary source — PM2 logs only capture stdout/stderr.

---

## If You're Using a Hosting Platform (Railway, Render, Fly.io, etc.)

These platforms capture stdout directly. The Winston console transport outputs JSON to stdout in production, so **all logs appear in the platform's built-in log viewer**.

Set `LOG_DIR` to a writable path (or leave it out — file logs won't persist across deploys on ephemeral containers anyway). Rely on the platform's log viewer for production debugging on these hosts.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_DIR` | `./logs` (relative to cwd) | Where log files are written |
| `LOG_LEVEL` | `http` (prod), `debug` (dev) | Minimum level to log |
| `NODE_ENV` | `development` | Controls file vs console output |
