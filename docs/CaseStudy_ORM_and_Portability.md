# Case Study: ORM, Storage Portability, and Environment-Agnostic Architecture

**Project:** 10xAccel LMS Platform  
**Date:** April 2026  
**Context:** Currently deployed on Render (backend) + Supabase (DB + Storage) + Vercel (frontend). Client may move to AWS in production.

---

## Part 1 — Confirming Your Current Setup

### Is the file upload system designed for Supabase?

**Yes, 100%.** Every file operation in `server/src/utils/storage.ts` is tightly coupled to the Supabase JS SDK:

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
// ...
const supabase = getStorageClient(); // returns a SupabaseClient
supabase.storage.from(bucket).createSignedUrl(...)
supabase.storage.from(bucket).upload(...)
supabase.storage.from(bucket).remove(...)
supabase.storage.from(bucket).download(...)
```

The entire storage layer — signed URL generation, file upload, move, delete — calls Supabase's SDK directly. If you swapped to AWS S3, every one of those calls would need to be rewritten.

Similarly, the **database** is PostgreSQL accessed via raw SQL, currently hosted on Supabase's managed Postgres. Your `config/db.ts` uses the `pg` (node-postgres) driver directly.

---

## Part 2 — The Real Problem: Tight Coupling to Infrastructure

Your concern is real and has a name: **infrastructure coupling** — when your application code directly depends on a specific vendor's API or SDK.

### What happens when you move to AWS?

| Layer | Current | AWS Equivalent | What breaks |
|---|---|---|---|
| File Storage | Supabase Storage (SDK) | AWS S3 (AWS SDK) | All of `storage.ts` |
| Database | Supabase Postgres (pg driver) | RDS Postgres (same pg driver) | Almost nothing |
| Auth/tokens | Custom JWT (jsonwebtoken) | Same | Nothing |
| Backend host | Render | EC2 / ECS / Lambda | Just env vars & deployment config |

The database is actually fine — because you're using raw SQL via the generic `pg` driver, and Postgres is Postgres. Moving from Supabase Postgres to AWS RDS is just a `DATABASE_URL` change.

**The actual problem is the storage layer**, not the database.

---

## Part 3 — What is an ORM?

An **ORM (Object-Relational Mapper)** is a library that maps database tables to programming language objects (classes), and generates SQL on your behalf. Instead of writing:

```sql
SELECT id, name, email FROM users WHERE id = $1
```

You write:

```ts
// Prisma ORM
const user = await prisma.user.findUnique({ where: { id } });

// TypeORM
const user = await userRepository.findOneBy({ id });
```

The ORM generates the SQL, manages connections, and handles type-mapping.

### Popular Node.js ORMs

| ORM | Style | Works with |
|---|---|---|
| **Prisma** | Schema-first, type-safe | Postgres, MySQL, SQLite, MongoDB |
| **TypeORM** | Decorator-based, Active Record | Postgres, MySQL, SQLite, MSSQL |
| **Drizzle** | SQL-like, type-safe | Postgres, MySQL, SQLite |
| **Sequelize** | Classic, flexible | Most SQL databases |

---

## Part 4 — Does ORM Solve the "Changing Environment" Problem?

### For the database: Partially yes, but you don't actually need it.

The promise of ORM is **database portability**: write ORM code once, switch between Postgres / MySQL / SQLite by changing a config line. This is valuable when:
- You genuinely don't know which database you'll use
- You need to support multiple databases simultaneously (e.g. SQLite for tests, Postgres for prod)

**But in your case:**
- You are on Postgres now, and AWS RDS is also Postgres
- Moving to AWS does NOT require you to change your SQL or your `pg` driver at all
- The ORM portability benefit is **irrelevant** here because you're staying on the same database engine

### For file storage: ORM doesn't help at all.

ORM only deals with relational databases. It has zero relationship to file storage. Moving from Supabase Storage to AWS S3 is a storage problem, not a database problem.

---

## Part 5 — What Actually Solves the Changing Environment Problem

The real solution is the **Adapter Pattern** (also called Provider Pattern or Strategy Pattern). This is a core software engineering principle, not specific to any library.

The idea: define a **stable interface** for what you need (e.g. "upload a file, generate a URL, delete a file"), and write **interchangeable implementations** — one for Supabase, one for S3, one for local disk — behind that interface. The rest of your app only sees the interface, never the vendor SDK.

### Applied to Your Storage Layer

**Step 1 — Define a storage interface (the contract):**

```ts
// server/src/storage/IStorageProvider.ts
export interface IStorageProvider {
  upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<string>;
  getSignedUrl(bucket: string, path: string, expiresIn?: number): Promise<string | null>;
  delete(bucket: string, paths: string[]): Promise<void>;
  download(bucket: string, path: string): Promise<Buffer | null>;
}
```

**Step 2 — Write a Supabase implementation:**

```ts
// server/src/storage/SupabaseStorageProvider.ts
import { createClient } from '@supabase/supabase-js';
import { IStorageProvider } from './IStorageProvider';

export class SupabaseStorageProvider implements IStorageProvider {
  async upload(bucket, path, data, contentType) { /* supabase SDK call */ }
  async getSignedUrl(bucket, path, expiresIn) { /* supabase SDK call */ }
  async delete(bucket, paths) { /* supabase SDK call */ }
  async download(bucket, path) { /* supabase SDK call */ }
}
```

**Step 3 — Write an S3 implementation:**

```ts
// server/src/storage/S3StorageProvider.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { IStorageProvider } from './IStorageProvider';

export class S3StorageProvider implements IStorageProvider {
  async upload(bucket, path, data, contentType) { /* AWS SDK call */ }
  async getSignedUrl(bucket, path, expiresIn) { /* AWS presigned URL */ }
  async delete(bucket, paths) { /* AWS SDK call */ }
  async download(bucket, path) { /* AWS SDK call */ }
}
```

**Step 4 — Select provider via environment variable:**

```ts
// server/src/storage/index.ts
import { IStorageProvider } from './IStorageProvider';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { S3StorageProvider } from './S3StorageProvider';

let _provider: IStorageProvider;

export function getStorageProvider(): IStorageProvider {
  if (!_provider) {
    const engine = process.env.STORAGE_ENGINE || 'supabase';
    if (engine === 's3') _provider = new S3StorageProvider();
    else _provider = new SupabaseStorageProvider();
  }
  return _provider;
}
```

**Result:** Every service in your app (`materials.service.ts`, `student-uploads.service.ts`, `upload.controller.ts`) calls `getStorageProvider().upload(...)` — and never imports Supabase or AWS SDKs directly. To move to AWS, you set `STORAGE_ENGINE=s3` and never touch the service layer.

---

## Part 6 — Should You Adopt ORM in This Project?

### The honest assessment

Your current stack uses **raw SQL via the `pg` driver**. This is a deliberate, documented decision (see `CLAUDE.md`: *"No ORM — raw SQL only"*). Let's evaluate whether that should change.

**Arguments for keeping raw SQL:**
- You are staying on PostgreSQL regardless of host — Supabase, RDS, or self-hosted Postgres all speak the same SQL
- Raw SQL gives you full control over query performance — important for a platform with complex joins (quiz attempts, enrollments, progress reports)
- Your existing views (`v_student_report`, `v_teacher_dashboard`) are database-level SQL that ORMs struggle to manage cleanly
- The team already knows SQL; ORM introduces a new abstraction layer to learn and debug
- Migrations and schema management in ORMs (especially Prisma) can be opinionated and conflict with your existing `schema.sql` + migration script approach

**Arguments for adopting ORM (e.g. Prisma):**
- Type-safe queries — no stringly-typed SQL, full TypeScript autocomplete on query results
- Auto-generated types from schema — eliminates a lot of manual `interface` definitions in `.types.ts` files
- Built-in migration tracking
- Easier onboarding for developers unfamiliar with SQL

**Verdict for this project:**

| Concern | ORM helps? | Alternative |
|---|---|---|
| Moving DB from Supabase to AWS RDS | No (both are Postgres) | Just change `DATABASE_URL` |
| Moving file storage to S3 | No (ORM ≠ file storage) | Adapter Pattern on storage layer |
| Type safety | Yes | Prisma specifically is excellent here |
| Query portability across DB engines | Not needed | You're on Postgres |
| DB trigger / view management | Worse (ORMs fight with these) | Keep raw SQL |

**Recommendation:** ORM is not the solution to your environment-portability concern — the Adapter Pattern is. However, if you want **type safety benefits**, Prisma can be layered in gradually (it can work alongside raw SQL via `prisma.$queryRaw`). That's a separate refactoring decision unrelated to portability.

---

## Part 7 — What You Should Actually Do Before AWS Migration

If a client asks for AWS deployment, here is the minimal work required:

### Database — almost zero work
```bash
# Just change the environment variable
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/lmsdb
```
That's it. Your raw SQL stays identical.

### File Storage — implement the Adapter Pattern
1. Extract `IStorageProvider` interface from `storage.ts`
2. Move current Supabase code into `SupabaseStorageProvider`
3. Write `S3StorageProvider` with AWS SDK v3
4. Add `STORAGE_ENGINE` env var to select provider
5. Update all callers to use `getStorageProvider()` instead of importing `storage.ts` functions directly

### Hosting — just deployment config
- Render → AWS ECS / EC2 / App Runner: just `Dockerfile` + env vars
- Vercel → CloudFront + S3 (static site) or AWS Amplify: just a build + deploy config change

### Environment variables — centralise and document
Create a `docs/ENV_VARIABLES.md` that maps each env var to its purpose and per-environment value. This makes any infrastructure move a configuration exercise, not a code exercise.

---

## Summary

| Question | Answer |
|---|---|
| Is file upload Supabase-specific? | **Yes** — `storage.ts` is tightly coupled to Supabase SDK |
| Is the database Supabase-specific? | **No** — raw `pg` driver works with any Postgres host |
| Does ORM solve environment changes? | **Not for storage**. Partially for DB, but you don't need it since you're staying on Postgres |
| What actually solves this? | **Adapter Pattern** on the storage layer — one interface, swap implementations via env var |
| Should you adopt ORM now? | **Not for portability reasons**. Consider Prisma only if you want type-safe queries as a developer experience improvement |
| Effort to move to AWS | **Low** — DB is already portable; storage needs the adapter refactor (1–2 days of work) |

The core principle: **code against interfaces, not implementations**. When your application talks to an `IStorageProvider` instead of `supabase.storage`, the vendor becomes a configuration detail, not a code dependency.
