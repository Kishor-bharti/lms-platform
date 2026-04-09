# Signed URL Cache — Problem, Severity & Solution

## The Problem

Every time any user loads a page that displays files (materials, assignments,
student uploads, quiz images), the server calls Supabase's Storage API to
generate a **signed URL per file, per request**. There is no reuse between
requests.

### Concrete example — 50 students, 1 materials page

A subject has 8 files. 50 students open the materials page at the same time:

```
50 requests × 8 files = 400 Supabase API calls in a few seconds
```

All 400 calls return **the exact same 8 URLs**. Every call is wasted work.

### Why signed URLs are the same for the same file

A signed URL for a given `bucket/path` with the same `expiresIn` value is
deterministic within the validity window — Supabase issues the same URL every
time until it expires. There is no reason to call the API more than once per
file per expiry window.

---

## Severity

| Load scenario | Without cache | With cache |
|---|---|---|
| 50 students, 8-file page | 400 Supabase calls | 8 calls (first student) + 0 for the rest |
| 200 students, 8-file page | 1,600 Supabase calls | 8 calls total |
| Supabase free tier rate limit | Throttling starts → slow responses → DB connections pile up → pool exhausts → users see errors | Well within limits |

**The secondary effect is worse than it looks.** Each Supabase API call is an
outbound HTTP request. While waiting for the response, the Node.js request
handler is `await`-ing. If 400 concurrent handlers are all awaiting Supabase,
the event loop backs up, the DB connection pool fills, and unrelated requests
start timing out — even requests that don't touch storage at all.

---

## The Solution

An **in-memory `Map` cache** on the server process, keyed by
`bucket + path + expiresIn`.

### Cache design

```
Key:   "bucket\0path\0expiresIn"    ← null byte prevents key collisions
Value: { url: string, expiresAt: number (ms) }
TTL:   (expiresIn - 60) seconds
```

**Why `expiresIn - 60` as TTL?**

Signed URLs expire after `expiresIn` seconds (default 900 s = 15 min). If we
cached them for the full 15 minutes, a student could receive a URL with only
3 seconds left — it would 403 before the browser even fetches the file. The
60-second safety margin guarantees every served URL has at least 60 s of life
remaining.

### Cache invalidation

The cache is evicted **proactively** when files are deleted or moved:

- `deleteFileByUrl()` — evicts before calling Supabase remove
- `deleteFilesByUrls()` — evicts each file before the batch remove
- `moveFileBetweenBuckets()` — evicts the source path after copy

This ensures we never return a signed URL for a file that no longer exists.

### Implementation location

`server/src/utils/storage.ts` — `_signedUrlCache` Map + `_evictFile()` helper.
The cache is completely internal; no callers needed to change.

```
createSignedUrl(bucket, path, expiresIn)
  │
  ├── cache HIT  →  return cached URL instantly (0 Supabase calls)
  │
  └── cache MISS →  call Supabase, store result with TTL, return URL
```

All higher-level functions (`resolveSignedUrl`, `signFileFields`) automatically
benefit because they call `createSignedUrl` internally.

### Memory footprint

Each cache entry is roughly 250–300 bytes (URL string + metadata). In the
worst case (1,000 unique files cached simultaneously):

```
1,000 entries × 300 bytes ≈ 300 KB
```

Negligible. Node.js typically uses 50–150 MB for this app; 300 KB is noise.

### Limitations

- **Single process only.** If you ever run multiple Node processes (cluster
  mode, multiple EC2 instances), each process has its own cache. This is fine
  for the current single-instance setup. If you scale horizontally, move the
  cache to Redis.
- **Process restart clears the cache.** Cold start after a deploy means the
  first wave of requests repopulates the cache. This is a one-time cost.

---

## Before vs After

| Metric | Before | After |
|---|---|---|
| Supabase calls for 50 concurrent students (8-file page) | 400 | 8 |
| Supabase calls for 200 concurrent students (8-file page) | 1,600 | 8 |
| Risk of hitting Supabase free tier rate limit | High at >30 concurrent | Very low |
| Stale URL risk | N/A | None — evicted on delete/move |
| Added dependencies | — | None |
| Code changed | — | `server/src/utils/storage.ts` only |
