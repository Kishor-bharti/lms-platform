# Global Timezone Handling (UTC Storage + Local User Experience)

## Goal

This implementation ensures:

1. Database timestamps remain UTC-based (no storage model changes).
2. Frontend displays and compares dates in each user's local timezone.
3. "Today" logic is local-date based, not UTC-string based.
4. No hardcoded offsets (e.g. `+05:30`).

---

## Frontend Utilities

File: [client/src/utils/date.js](../client/src/utils/date.js)

### `getUserTimeZone()`
Returns browser timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### `toLocalDateKey(utcTimestamp, timeZone?)`
Converts a UTC timestamp to local date key format `YYYY-MM-DD` using `Intl.DateTimeFormat(...).formatToParts()`.

### `getTodayLocalDateKey(timeZone?)`
Returns local "today" key in `YYYY-MM-DD`.

### `isLocalToday(utcTimestamp, timeZone?)`
Reusable `isToday` check comparing local date keys.

### `withTimeZoneQuery(path, timeZone?)`
Appends `timeZone=...` query param for backend-aware responses.

### `toTimetzFromLocal(dateKey, timeHHmm)`
Builds `HH:mm:ss±HH:mm` from local date/time using browser offset (DST-aware, no hardcoded offsets).

---

## Example Usage

```js
import { getTodayLocalDateKey, toLocalDateKey, isLocalToday } from 'utils/date';

const today = getTodayLocalDateKey();
const sessionDate = toLocalDateKey(session.scheduled_at);
const showInTodayList = sessionDate === today;

const isToday = isLocalToday(session.scheduled_at);
```

---

## Backend Changes

### Timezone-aware session status
File: [server/src/modules/classes/classes.service.ts](../server/src/modules/classes/classes.service.ts)

- `calculateSessionStatus()` now accepts `timeZone`.
- `TODAY`/`TOMORROW` are computed using `Intl.DateTimeFormat` in that timezone.
- `MISSED` still uses absolute instant comparison (UTC-safe).

### Timezone-aware API input
File: [server/src/modules/classes/classes.controller.ts](../server/src/modules/classes/classes.controller.ts)

- `GET /api/classes/my-sessions-v2` accepts optional `timeZone` query param.
- Timezone is validated via `Intl.DateTimeFormat`.
- Fallback is `UTC` if invalid.

### Preserve explicit timestamp offsets in API output
File: [server/src/modules/classes/classes.service.ts](../server/src/modules/classes/classes.service.ts)

- `scheduled_at` now includes offset (`YYYY-MM-DDTHH:mm:ss±HH:mm`) instead of dropping timezone.

---

## Result

- Global users see correct local dates.
- "Today" works correctly across all timezones.
- Backend logic is deterministic and not tied to server machine timezone.
- UTC storage remains unchanged.
