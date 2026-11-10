// Staff assistant authority. Identity = verified server session only (auth.me()). The only provable
// role today is OWNER-SELF: records the session user created (created_by_id cannot be set by a client),
// with any shop stamp required to match the session email. Platform "admin" grants NO cross-shop reach.
import { ownership } from '../staffEstimateCore.ts';
import { canonicalTaxTarget } from '../financialPolicy.ts';

export class ToolError extends Error {
  code: string; status: number;
  constructor(code: string, message: string, status = 400) { super(message); this.code = code; this.status = status; }
}
const lc = (v: any) => String(v ?? '').trim().toLowerCase();
const finite = (n: any) => typeof n === 'number' && Number.isFinite(n);
const DAY = 864e5;

// Server copy of the app's subscription gate (App.jsx): 7-day trial, or active and not past billing date.
export function subscriptionActive(user: any, now = Date.now()) {
  if (user.subscription_status === 'active') {
    return !(user.setup_fee_paid && user.next_billing_date && now > Date.parse(user.next_billing_date));
  }
  const start = Date.parse(user.trial_started_date || user.created_date || '');
  return Number.isFinite(start) && now <= start + 7 * DAY;
}

export function validTimezone(tz: any) {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch (_) { return false; }
}

export function resolveStaffScope(user: any, now = Date.now()) {
  if (!user?.id || !user?.email) throw new ToolError('unauthorized', 'Sign in required.', 401);
  if (!user.business_name) throw new ToolError('forbidden', 'Finish your shop setup before LBC Auto AI can use shop records.', 403);
  if (!subscriptionActive(user, now)) throw new ToolError('forbidden', 'Your LBC Auto subscription is not active, so shop records are unavailable.', 403);
  const tzOk = validTimezone(user.timezone);
  return Object.freeze({
    userId: String(user.id), tenant: lc(user.email), role: 'owner', businessName: String(user.business_name),
    timezone: tzOk ? user.timezone : 'UTC', timezoneVerified: tzOk,
    laborRate: finite(user.labor_rate) && user.labor_rate > 0 ? user.labor_rate : null,
    taxRate: finite(user.tax_rate) && user.tax_rate >= 0 && user.tax_rate <= 30 ? user.tax_rate : null,
    taxTarget: canonicalTaxTarget(user) || 'both',
  });
}

export const owned = (rec: any, scope: any) => ownership(rec, { userId: scope.userId, tenant: scope.tenant }) === 'owned';
// Entities whose RLS create rule forces shop_owner_email/shop_email = session email (stamp is tenant-bound).
export const stampedOwned = (rec: any, scope: any, field = 'shop_owner_email') => !!rec && lc(rec[field]) === scope.tenant;

export async function getOwned(svc: any, entity: string, id: any, scope: any, label: string) {
  if (!id || typeof id !== 'string' || id.length > 64) throw new ToolError('missing', `${label} is required.`);
  const rec = await svc[entity].get(id).catch(() => null);
  if (!owned(rec, scope)) throw new ToolError('not_found', `${label} not found in your shop.`, 404);
  return rec;
}

// Tenant constraint is applied to the QUERY before retrieval, then re-checked per row.
export async function ownedPage(svc: any, entity: string, scope: any, query: any = {}, { sort = '-created_date', limit = 10, skip = 0 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 25);
  const sk = Math.max(Number(skip) || 0, 0);
  const rows = await svc[entity].filter({ ...query, created_by_id: scope.userId }, sort, lim + 1, sk);
  return { rows: rows.slice(0, lim).filter((r: any) => owned(r, scope)), has_more: rows.length > lim, next_skip: sk + lim };
}

// Exhaustive bounded scan for summaries. Reports partial instead of a silently low number.
export async function ownedScan(svc: any, entity: string, scope: any, query: any = {}, { pages = 5, size = 200, sort = '-created_date' } = {}) {
  const out: any[] = [];
  for (let p = 0; p < pages; p++) {
    const rows = await svc[entity].filter({ ...query, created_by_id: scope.userId }, sort, size, p * size);
    out.push(...rows.filter((r: any) => owned(r, scope)));
    if (rows.length < size) return { rows: out, partial: false };
  }
  return { rows: out, partial: true };
}

export function todayIn(tz: string, now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
function tzOffsetMs(ts: number, tz: string) {
  const p: any = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - ts;
}
// Start of a shop-local calendar day, as a UTC ISO instant.
export function dayStartUtc(date: string, tz: string) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  return new Date(guess - tzOffsetMs(guess, tz)).toISOString();
}
export const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10);