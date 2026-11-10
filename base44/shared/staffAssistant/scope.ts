// Staff assistant authority. Identity = verified server session only (auth.me()). The only provable
// role today is OWNER-SELF: records the session user created (created_by_id cannot be set by a client),
// with any shop stamp required to match the session email. Platform "admin" grants NO cross-shop reach.
import { ownership } from '../staffEstimateCore.ts';
import { canonicalTaxTarget } from '../financialPolicy.ts';
import { isServiceCreated } from '../shopProvenance.ts';

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

// Verified shop memberships for this session. The only provable membership today is OWNER-SELF:
// there is no membership entity binding a second login to a shop (team members sign in with a PIN
// on the Team Portal, which has no assistant). business_name is a label, never proof of membership.
export function verifiedMemberships(user: any) {
  return [{ shop_key: `shop_${user.id}`, role: 'owner', name: String(user.business_name) }];
}

export function resolveStaffScope(user: any, now = Date.now(), requested: any = {}) {
  if (!user?.id || !user?.email) throw new ToolError('unauthorized', 'Sign in required.', 401);
  if (!user.business_name) throw new ToolError('forbidden', 'Finish your shop setup before LBC Auto AI can use shop records.', 403);
  if (!subscriptionActive(user, now)) throw new ToolError('forbidden', 'Your LBC Auto subscription is not active, so shop records are unavailable.', 403);
  const memberships = verifiedMemberships(user);
  const sel = requested?.shop_key;
  const m = sel ? memberships.find((x) => x.shop_key === sel) : memberships.length === 1 ? memberships[0] : null;
  if (!m) throw new ToolError(sel ? 'shop_mismatch' : 'shop_ambiguous', sel ? 'That shop is not one of your verified shops. Close and reopen LBC Auto AI.' : 'Choose which of your shops to use.', 403);
  const tzOk = validTimezone(user.timezone);
  return Object.freeze({
    userId: String(user.id), tenant: lc(user.email), role: m.role, shopKey: m.shop_key, businessName: m.name,
    publicPhone: typeof user.phone === 'string' ? user.phone : '', publicAddress: typeof user.address === 'string' ? user.address : '',
    timezone: tzOk ? user.timezone : 'UTC', timezoneVerified: tzOk,
    laborRate: finite(user.labor_rate) && user.labor_rate > 0 ? user.labor_rate : null,
    taxRate: finite(user.tax_rate) && user.tax_rate >= 0 && user.tax_rate <= 30 ? user.tax_rate : null,
    taxTarget: canonicalTaxTarget(user) || 'both',
  });
}

// Owned = created by the session user (stamp, if any, must match), OR created by a platform service
// identity and stamped for this tenant (same provenance rule as shopScopedRecords). Conflicts fail closed.
// Reads run through the service role (ctx.svc) because creator-only RLS hides service-created rows;
// the tenant constraint is in every query and owned() re-checks every row.
export function owned(rec: any, scope: any) {
  if (!rec) return false;
  const stamps = [rec.shop_owner_email, rec.shop_email].map(lc).filter(Boolean);
  if (new Set(stamps).size > 1) return false;
  if (isServiceCreated(rec)) return stamps[0] === scope.tenant;
  return ownership(rec, { userId: scope.userId, tenant: scope.tenant }) === 'owned';
}
// Writes: own records through the user's client; service-created ones through the service role ONLY
// after owned() verified them.
export const writerFor = (ctx: any, rec: any) => (isServiceCreated(rec) ? ctx.svc : ctx.userDb);

export const shopIdentity = (scope: any) => ({ key: scope.shopKey, name: scope.businessName, role: scope.role, verified: true });

const STAMP: Record<string, string> = { Customer: 'shop_owner_email', Vehicle: 'shop_owner_email', Appointment: 'shop_email', Mechanic: 'shop_owner_email', TimeEntry: 'shop_owner_email', PaymentRecord: 'shop_owner_email',
  DiagnosticScan: 'shop_owner_email', CustomerReview: 'shop_owner_email', ShopOffer: 'shop_owner_email', CustomerMessage: 'shop_owner_email', CarRecommendation: 'shop_owner_email', VehiclePhoto: 'shop_email' };
// AND(query, owner) using only $or: (A|B) & (X|Y) = AX|AY|BX|BY.
export function ownerQuery(entity: string, scope: any, query: any = {}) {
  const owners: any[] = [{ created_by_id: scope.userId }];
  if (STAMP[entity]) owners.push({ [STAMP[entity]]: scope.tenant });
  const { $or, ...rest } = query || {};
  const ors = Array.isArray($or) && $or.length ? $or.flatMap((a: any) => owners.map((o) => ({ ...a, ...o }))) : owners;
  return ors.length === 1 ? { ...rest, ...ors[0] } : { ...rest, $or: ors };
}
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
  const rows = await svc[entity].filter(ownerQuery(entity, scope, query), sort, lim + 1, sk);
  return { rows: rows.slice(0, lim).filter((r: any) => owned(r, scope)), has_more: rows.length > lim, next_skip: sk + lim };
}

// Exhaustive bounded scan for summaries. Reports partial instead of a silently low number.
export async function ownedScan(svc: any, entity: string, scope: any, query: any = {}, { pages = 5, size = 200, sort = '-created_date' } = {}) {
  const out: any[] = [];
  for (let p = 0; p < pages; p++) {
    const rows = await svc[entity].filter(ownerQuery(entity, scope, query), sort, size, p * size);
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