// Pure helpers for the Stripe overview panel: money formats, day labels, the 7-day tile scale
// and the 30-day pixel line. Day keys are "YYYY-MM-DD" calendar days in the shop's time zone.

const formats = new Map();
export function money(value, currency = "CAD", withCents = false) {
  const key = `${currency}:${withCents}`;
  if (!formats.has(key)) {
    const digits = withCents ? 2 : 0;
    formats.set(key, new Intl.NumberFormat("en-CA", {
      style: "currency", currency, currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }));
  }
  return formats.get(key).format(Number(value) || 0);
}

const atNoon = (dateKey) => new Date(`${dateKey}T12:00:00Z`);
export const weekday = (dateKey, style = "short") => atNoon(dateKey).toLocaleDateString("en-US", { weekday: style, timeZone: "UTC" });
export const shortDate = (dateKey) => atNoon(dateKey).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const clockLabel = (iso, timeZone) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Today's payments show their time, older ones their date.
export function whenLabel(iso, timeZone) {
  const at = new Date(iso);
  const sameDay = at.toLocaleDateString("en-US", { timeZone }) === new Date().toLocaleDateString("en-US", { timeZone });
  return sameDay ? clockLabel(iso, timeZone) : at.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric" });
}

// Change vs the day before. A falling day is flagged so its pointer turns yellow.
export function dayChange(cur, prev) {
  if (prev > 0) {
    const pct = Math.abs(Math.round(((cur - prev) / prev) * 100));
    return cur < prev
      ? { down: true, text: `▼ ${pct}%`, words: `down ${pct}% on the day before` }
      : { down: false, text: `▲ ${pct}%`, words: `up ${pct}% on the day before` };
  }
  return cur > 0
    ? { down: false, text: "▲ New", words: "up from no sales the day before" }
    : { down: false, text: "No sales", words: "no sales" };
}

// One square = a fixed round amount, chosen so the busiest day fills (close to) all 6 squares.
const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
export function tileUnit(maxDay) {
  if (!(maxDay > 0)) return 100;
  const raw = maxDay / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  return STEPS.find((s) => s * mag >= raw) * mag;
}

// Lit squares count up from the bottom; any sale lights at least one.
export const litTiles = (amount, unit) => (amount > 0 ? Math.min(6, Math.max(1, Math.round(amount / unit))) : 0);

// Daily totals -> one bright cell per column of the 47 x 17 grid (rows 2-14, top = best day),
// plus bridge cells where the line steps more than one row so it stays connected.
export function pixelLine(values, cols = 47) {
  const max = Math.max(0, ...values);
  const last = values.length - 1;
  const cells = [];
  let prev = null;
  for (let col = 0; col < cols; col++) {
    const t = (col * last) / (cols - 1);
    const i = Math.floor(t);
    const v = values[i] + (values[Math.min(i + 1, last)] - values[i]) * (t - i);
    const row = max > 0 ? Math.round(14 - (v / max) * 12) : 14;
    if (prev !== null && Math.abs(row - prev) > 1) {
      const dir = Math.sign(row - prev);
      for (let r = prev + dir; r !== row; r += dir) cells.push({ col, row: r });
    }
    cells.push({ col, row });
    prev = row;
  }
  return cells;
}