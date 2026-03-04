# CI (Continuous Integration) Guide

## What is it?

CI stands for **Continuous Integration**. It is a GitHub feature (via GitHub Actions) that automatically runs a set of checks every time you push code or open a pull request.

The workflow file lives at `.github/workflows/ci.yml` in your repo. GitHub reads it and runs it on their cloud servers — no setup on your machine needed.

---

## Will it break my production deployment?

**No. It is completely safe.**

The CI workflow only does three things:

| Step | What it does | Touches production? |
|------|-------------|---------------------|
| `npm ci` | Installs dependencies | No |
| `tsc --noEmit` | Type-checks TypeScript | No |
| `npm test` | Runs unit tests (all DB calls are mocked) | No |

It never deploys code, never connects to your real database, and never restarts your Render server. Your live site is untouched.

---

## When does it run?

Automatically, on every:

- **Push to `main`** — after you merge or push directly
- **Push to `develop`** — if you use a develop branch
- **Pull request targeting `main` or `develop`** — before you merge

You can also trigger it manually from the **Actions** tab on GitHub.

---

## What does it check?

Two jobs run **in parallel**:

### 1. `server-test` — Backend
1. Installs server dependencies
2. Runs TypeScript type-check (`tsc --noEmit`)
3. Runs all 157 unit tests with coverage summary

### 2. `client-build` — Frontend
1. Installs client dependencies
2. Builds the React app (`npm run build`)

If either job fails, GitHub shows a red ✗ on the commit/PR. If both pass, you get a green ✓.

---

## How to use it

### Viewing results

1. Go to your GitHub repository
2. Click the **Actions** tab
3. Click any workflow run to see detailed logs

### On pull requests

When you open a PR, the checks appear automatically at the bottom:

```
✓ Server — Type-check & Tests    (passing)
✓ Client — Lint & Build          (passing)
```

You can require these checks to pass before merging (in repo Settings → Branch protection rules).

### Protecting your main branch (recommended)

1. Go to GitHub repo → **Settings** → **Branches**
2. Click **Add branch protection rule**
3. Branch name pattern: `main`
4. Enable **Require status checks to pass before merging**
5. Select `server-test` and `client-build`

This prevents broken code from ever reaching production.

---

## When will it help you?

| Scenario | How CI helps |
|----------|-------------|
| You push a bug that breaks a service | CI catches it before it hits production |
| A teammate's PR breaks existing functionality | Tests fail on their PR — you see it before merging |
| You refactor code and accidentally change a type | `tsc --noEmit` catches it instantly |
| You want confidence before deploying | Green CI = safe to deploy |

---

## Environment variables

The CI workflow injects its own test env vars directly (see `.github/workflows/ci.yml`). You do **not** need to add any secrets to GitHub for the tests to run — all database calls in tests are mocked.

If you ever add tests that need real secrets (e.g., integration tests), add them in:
**GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

---

## Quick reference

```
Push code / open PR
        ↓
GitHub Actions triggers automatically
        ↓
  ┌─────────────────────┐   ┌──────────────────────┐
  │   server-test        │   │   client-build        │
  │  1. npm ci           │   │  1. npm ci            │
  │  2. type-check       │   │  2. npm run build     │
  │  3. npm test         │   └──────────────────────┘
  └─────────────────────┘
        ↓
  ✓ All pass → green badge on commit
  ✗ Any fail → red badge, email notification
```
