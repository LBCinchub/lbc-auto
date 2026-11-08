// Calendar days in the shop's time zone using Intl only, so "today" and "30 days" are real local days.

export function zoneOrUtc(zone) {
  const tz = String(zone || '');
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export const dayFormatter = (timeZone) => new Intl.DateTimeFormat('en-US', {
  timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

const partsOf = (ms, fmt) => Object.fromEntries(fmt.formatToParts(ms).map((p) => [p.type, Number(p.value)]));

export function dayKey(ms, fmt) {
  const p = partsOf(ms, fmt);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

// How far the shop's clock is ahead of UTC at a given moment.
function offsetMs(ms, fmt) {
  const p = partsOf(ms, fmt);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (ms - (ms % 1000));
}

// UTC moment of the local midnight that starts the given day (second pass settles DST changes).
export function startOfDay(key, fmt) {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return guess - offsetMs(guess - offsetMs(guess, fmt), fmt);
}

// The last n calendar days in the shop's time zone, oldest first, ending today.
export function lastDays(n, fmt) {
  const [y, m, d] = dayKey(Date.now(), fmt).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1, d - (n - 1 - i))).toISOString().slice(0, 10));
}