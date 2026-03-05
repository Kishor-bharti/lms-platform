# Case Study — Fixing the TypeScript Test Infrastructure

> **Project:** 10xAccel LMS
> **Date:** March 2026
> **Scope:** 16 test files, 157 test cases across the server test suite

---

## 1. The Problem

After writing a comprehensive test suite for the backend (16 files, 157 unit tests), the development experience was severely degraded by **51 TypeScript errors** reported across every single test file in the IDE (VS Code).

Every test file showed red squiggles on fundamental Jest globals:

```
Cannot find name 'jest'.
Cannot find name 'describe'.
Cannot find name 'it'.
Cannot find name 'expect'.
Cannot find name 'beforeEach'.
Cannot find name 'afterEach'.
```

The errors appeared in **all 16 test files** — middleware tests, utility tests, and service tests alike.

### The Paradox

Here's what made this confusing: **all 157 tests passed when run via `npm test`**. The Jest runner executed flawlessly with zero failures. The errors were purely in the IDE, but they had real consequences:

- ❌ Red error markers on every test file in the file explorer
- ❌ No autocomplete for Jest APIs (`expect().toBe`, `jest.fn()`, etc.)
- ❌ No type checking within test files (mocks, assertions, etc.)
- ❌ False error noise drowning out real problems elsewhere
- ❌ New developers would assume the tests were broken

---

## 2. Root Cause Analysis

### The TypeScript Configuration Chain

The server had three TypeScript configs:

| File | Purpose |
|------|---------|
| `tsconfig.json` | Production build config |
| `tsconfig.test.json` | Jest runner config (used by ts-jest) |
| *(missing)* | IDE config for test files |

**The production `tsconfig.json`** intentionally excluded test files to keep them out of the build output:

```jsonc
// tsconfig.json
{
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/__tests__"]  // ← tests excluded
}
```

**The test config `tsconfig.test.json`** extended the base and added Jest types:

```jsonc
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["jest", "node"]    // ← Jest types added here
  },
  "exclude": ["node_modules", "dist"]  // ← tests NOT excluded
}
```

### Why Jest Worked but the IDE Didn't

**Jest + ts-jest** explicitly used `tsconfig.test.json` (configured in `jest.config.js`), so the test runner always had Jest type definitions available. Tests compiled and ran perfectly.

**VS Code's TypeScript language server**, however, resolves `tsconfig.json` files by walking up the directory tree. For files inside `src/__tests__/`, it found `server/tsconfig.json` first — which **excludes** `src/__tests__` entirely. Since excluded files fall into TypeScript's "inferred project" (with no custom `types` configuration), the Jest type definitions (`@types/jest`) were never loaded.

### The Disconnect

```
Jest runtime:    tsconfig.test.json  →  types: ["jest", "node"]  →  ✅ all globals found
VS Code IDE:     tsconfig.json       →  excludes __tests__       →  ❌ inferred project, no Jest types
```

### A Second Issue: Deprecated Jest Config

The `jest.config.js` used the deprecated `globals` syntax for ts-jest configuration:

```javascript
// ❌ Deprecated — generates warnings on every test run
globals: {
  'ts-jest': {
    tsconfig: 'tsconfig.test.json',
  },
},
```

This produced noisy deprecation warnings for every test worker:

```
ts-jest[ts-jest-transformer] (WARN) Define `ts-jest` config under `globals` is deprecated.
```

---

## 3. The Fix

### Fix 1: Nested `tsconfig.json` for IDE Resolution

Created a new `src/__tests__/tsconfig.json` that VS Code's language server discovers when opening test files:

```jsonc
// src/__tests__/tsconfig.json
{
  "extends": "../../tsconfig.test.json",
  "compilerOptions": {
    "noEmit": true,       // IDE-only — never produces output
    "rootDir": ".."       // Resolve imports relative to src/
  },
  "include": ["**/*.ts", "../**/*.ts"]  // Include both tests and source
}
```

**Why this works:**

1. VS Code walks up from a test file and finds `__tests__/tsconfig.json` first
2. It extends `tsconfig.test.json`, which adds `types: ["jest", "node"]`
3. The `include` pattern covers both test files and the source files they import
4. `noEmit: true` ensures this config is purely for editor intelligence
5. `rootDir: ".."` lets relative imports like `../../config/db` resolve correctly

### Fix 2: Modern Jest Configuration

Migrated from the deprecated `globals` syntax to the current `transform` syntax:

```javascript
// ❌ Before (deprecated)
module.exports = {
  preset: 'ts-jest',
  globals: {
    'ts-jest': { tsconfig: 'tsconfig.test.json' },
  },
};

// ✅ After (current)
module.exports = {
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
};
```

The `preset: 'ts-jest'` was also removed since the explicit `transform` entry makes it redundant.

---

## 4. Results

### Before

| Metric | Value |
|--------|-------|
| IDE errors in `__tests__/` | **51** |
| Deprecation warnings per test run | **16** (one per worker) |
| Jest autocomplete | ❌ None |
| Test results | 157 passed (but IDE said everything was broken) |

### After

| Metric | Value |
|--------|-------|
| IDE errors in `__tests__/` | **0** |
| Deprecation warnings per test run | **0** |
| Jest autocomplete | ✅ Full IntelliSense |
| Test results | 157 passed, 16 suites — unchanged |

### Files Changed

| File | Change |
|------|--------|
| `src/__tests__/tsconfig.json` | **Created** — IDE type resolution for test files |
| `jest.config.js` | **Updated** — `globals` → `transform`, removed `preset` |

Zero test files were modified. Zero test behavior changed. The fix was entirely in the infrastructure layer.

---

## 5. Key Takeaway

**TypeScript has two separate consumers in a typical project: the build tool and the IDE.** They don't necessarily use the same `tsconfig.json`. When your build (or test runner) works but the IDE shows errors, the root cause is almost always a config resolution mismatch.

The pattern of placing a `tsconfig.json` inside the `__tests__` directory — extending the test config — is a reliable solution that:

- Keeps test types (`@types/jest`) out of the production build
- Gives the IDE full type information for test files
- Requires no changes to existing test code
- Works across VS Code, WebStorm, and other TypeScript-aware editors

---

*Part of the 10xAccel LMS engineering documentation.*
