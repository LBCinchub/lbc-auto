// Pure, read-only dashboard selectors. Never mutate records.

export const ACTIVE_RO_STATUSES = ["waiting", "in_progress", "waiting_for_parts"];

export const countActiveOrders = (orders = []) =>
  orders.filter((o) => ACTIVE_RO_STATUSES.includes(o?.status)).length;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

// Date key (YYYY-MM-DD) for a stored date. Date-only values are taken as-is.
// Timestamps use the given verified IANA timeZone, or the existing UTC split when none.
export function toDateKey(value, timeZone) {
  if (typeof value !== "string") return null;
  const m = value.match(DATE_RE);
  if (!m) return null;
  const check = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (check.getUTCMonth() !== +m[2] - 1 || check.getUTCDate() !== +m[3]) return null;
  const hasTime = value.length > 10 && value.includes("T");
  if (!hasTime || !timeZone) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return zonedKey(d, timeZone);
}

function zonedKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

function shiftKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Period boundaries. With a verified timeZone, boundaries follow that zone (DST-safe,
// since they are calendar keys). Without one, preserves the existing UTC-key behaviour.
export function periodKeys(now = new Date(), timeZone) {
  const today = timeZone ? zonedKey(now, timeZone) : now.toISOString().slice(0, 10);
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // Sunday-start week
  return { today, weekStart: shiftKey(today, -dow), monthStart: `${today.slice(0, 7)}-01` };
}

// Payment events for one invoice. Detailed history wins; legacy amount_paid/paid_date
// is used only when history is absent. Invalid/undated entries are flagged, never dated.
export function invoicePaymentEvents(inv, timeZone) {
  const events = [];
  let needsReview = 0;
  const history = Array.isArray(inv?.payment_history) ? inv.payment_history : [];
  const push = (amountRaw, dateRaw) => {
    const amount = parseFloat(amountRaw);
    const key = toDateKey(dateRaw, timeZone);
    if (!Number.isFinite(amount) || amount === 0 || !key) { needsReview++; return; }
    events.push({ amount, key });
  };
  if (history.length > 0) {
    history.forEach((p) => push(p?.amount, p?.date));
  } else if ((parseFloat(inv?.amount_paid) || 0) > 0) {
    push(inv.amount_paid, inv.paid_date);
  }
  return { events, needsReview };
}

export function collectedRevenue(invoices = [], { now = new Date(), timeZone } = {}) {
  const { today, weekStart, monthStart } = periodKeys(now, timeZone);
  const out = { today: 0, week: 0, month: 0, needsReview: 0 };
  for (const inv of invoices) {
    const { events, needsReview } = invoicePaymentEvents(inv, timeZone);
    out.needsReview += needsReview;
    for (const { amount, key } of events) {
      if (key > today) continue;
      if (key === today) out.today += amount;
      if (key >= weekStart) out.week += amount;
      if (key >= monthStart) out.month += amount;
    }
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  return { today: r2(out.today), week: r2(out.week), month: r2(out.month), needsReview: out.needsReview };
}