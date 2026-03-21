export function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function toLocalDateKey(utcTimestamp, timeZone = getUserTimeZone()) {
  if (!utcTimestamp) return '';

  const date = utcTimestamp instanceof Date ? utcTimestamp : new Date(utcTimestamp);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function getTodayLocalDateKey(timeZone = getUserTimeZone()) {
  return toLocalDateKey(new Date(), timeZone);
}

export function isLocalToday(utcTimestamp, timeZone = getUserTimeZone()) {
  return toLocalDateKey(utcTimestamp, timeZone) === getTodayLocalDateKey(timeZone);
}

export function withTimeZoneQuery(path, timeZone = getUserTimeZone()) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}timeZone=${encodeURIComponent(timeZone)}`;
}

export function toTimetzFromLocal(dateKey, timeHHmm) {
  if (!dateKey || !timeHHmm) return '';
  const local = new Date(`${dateKey}T${timeHHmm}:00`);
  if (Number.isNaN(local.getTime())) return '';

  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${timeHHmm}:00${sign}${hh}:${mm}`;
}
