// Staff AI estimate core — tenant-constrained evidence + validated estimate proposals.
// NOT imported by any deployed function. Saved-estimate creation is DISABLED:
//  - no canonical shop-membership/role resolver exists (business_name is self-editable;
//    platform "admin" spans every shop on this app),
//  - no canonical server Estimate creation/numbering/idempotency service exists
//    (Create Estimate is client-side), and
//  - the platform offers no atomic unique-create, so exactly-once cannot be guaranteed.
// Clients are injected: svc = server entity reads only. This module never writes.

const r2 = (v) => Math.round(v * 100) / 100;
const lc = (v) => String(v ?? '').trim().toLowerCase();
export const PAGE = 100;
export const MAX_PAGES = 5;
export const MAX_LINES = 30;
export const ELIGIBLE_INVOICE = ['paid', 'partial'];
export const ELIGIBLE_RO = ['completed', 'delivered'];
const OLD_MS = 730 * 24 * 3600 * 1000;

export const CREATE_BLOCKERS = [
  'No canonical shop membership/role authority (business_name is user-editable; admin role is app-wide)',
  'No canonical server-side Estimate creation, numbering and idempotency service',
  'No atomic unique-create primitive; concurrent or uncertain commits cannot be made exactly-once',
  'Invoice, RepairOrder and Estimate have no canonical shop field; only creator identity exists',
];

export class EstimateError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

// Identity comes only from the verified server session (auth.me()). No permission is inferred
// from business_name or any self-editable field. Read access = the session user's own records.
export function resolveStaffContext(user) {
  if (!user?.id || !user?.email) throw new EstimateError('unauthorized', 'Sign in required', 401);
  return { userId: user.id, tenant: lc(user.email), canCreate: false, createBlockers: CREATE_BLOCKERS };
}

// Fail closed: any explicit shop field must match the session; conflicting fields reject.
export function ownership(record, ctx) {
  if (!record) return 'missing';
  const explicit = [record.shop_owner_email, record.shop_email].map(lc).filter(Boolean);
  if (new Set(explicit).size > 1) return 'conflict';
  if (explicit.length && explicit[0] !== ctx.tenant) return 'foreign';
  if (record.created_by_id !== ctx.userId) return explicit.length ? 'conflict' : 'unknown';
  return 'owned';
}
async function getOwned(svc, entity, id, ctx, label) {
  if (!id) throw new EstimateError('missing', `${label} is required`);
  const rec = await svc[entity].get(id).catch(() => null);
  if (ownership(rec, ctx) !== 'owned') throw new EstimateError('forbidden', `${label} not found in this shop`, 403);
  return rec;
}
// Every list query carries the tenant constraint BEFORE retrieval; paginated per shop.
async function ownedList(svc, entity, ctx, extra) {
  const out = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await svc[entity].filter({ ...extra, created_by_id: ctx.userId }, '-created_date', PAGE, page * PAGE);
    out.push(...batch.filter((r) => ownership(r, ctx) === 'owned'));
    if (batch.length < PAGE) return { rows: out, truncated };
    truncated = page === MAX_PAGES - 1;
  }
  return { rows: out, truncated };
}

// ---------- Intent ----------
const stripQuoted = (t) => t.replace(/"[^"]*"|'[^']*'|“[^”]*”|`[^`]*`/g, ' ');
export function detectIntent(staffMessage) {
  const t = lc(stripQuoted(String(staffMessage ?? '')));
  if (!t) return 'read';
  if (/\b(do not|don't|dont|never|no need to|without|stop|cancel)\b[^.?!]*\b(create|make|save|estimate)/.test(t)) return 'read';
  if (/\b(how (do|can|would|to)|what happens|example|for instance|explain|can you show)\b/.test(t)) return 'read';
  return /^(please\s+)?(create|make|build|save|write up)\b[^.?!]*\bestimate\b/.test(t) ? 'create' : 'read';
}
// Follow-ups keep intent only through a server-held store keyed by actor; client history is ignored.
export async function resolveIntent({ intentStore, ctx, latestMessage }) {
  if (detectIntent(latestMessage) === 'create') return 'create';
  if (/\b(do not|don't|dont|never|cancel|stop)\b/.test(lc(latestMessage))) return 'read';
  const pending = intentStore ? await intentStore.get(ctx.userId) : null;
  return pending?.tenant === ctx.tenant && pending?.intent === 'create' ? 'create' : 'read';
}

// ---------- Line identity ----------
const COMPONENTS = ['pad', 'rotor', 'caliper', 'shoe', 'drum', 'hardware', 'fluid', 'oil', 'filter', 'tire', 'battery', 'strut', 'sensor'];
export function lineIdentity(name) {
  const t = lc(name);
  return { component: COMPONENTS.find((c) => t.includes(c)) || '', axle: t.includes('front') ? 'front' : t.includes('rear') ? 'rear' : '' };
}
export function requestedAxles(job) {
  const t = lc(job);
  if (/all around|all four|all 4|front and rear|rear and front|4 wheel/.test(t)) return ['front', 'rear'];
  return ['front', 'rear'].filter((a) => t.includes(a));
}
const short = (s) => String(s ?? '').replace(/[\r\n<>`]/g, ' ').slice(0, 80).trim();
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const isTest = (r) => /\b(test|sample|demo)\b/i.test(`${r.customer_name || ''} ${r.invoice_number || r.order_number || ''}`);

function evidenceLines(kind, rec) {
  const raw = kind === 'invoice'
    ? (rec.line_items || []).map((l, i) => ({ i, type: l.type === 'labor' ? 'labor' : 'part', name: l.name || l.description, quantity: l.quantity, unit_price: l.unit_price }))
    : [...(rec.labor_items || []).map((l, i) => ({ i: `l${i}`, type: 'labor', name: l.description, quantity: l.hours, unit_price: l.rate })),
       ...(rec.parts_used || []).map((p, i) => ({ i: `p${i}`, type: 'part', name: p.name, quantity: p.quantity, unit_price: p.unit_price }))];
  return raw.filter((l) => finite(l.quantity) && l.quantity > 0 && finite(l.unit_price) && l.unit_price >= 0)
    .map((l) => ({ source_line: `${kind}:${rec.id}:${l.i}`, type: l.type, name: short(l.name), quantity: l.quantity, unit_price: r2(l.unit_price), ...lineIdentity(l.name) }));
}

// ---------- (A) Evidence ----------
export async function loadEvidence({ svc, user, customerId, vehicleId, job, now = Date.now() }) {
  const ctx = resolveStaffContext(user);
  const customer = await getOwned(svc, 'Customer', customerId, ctx, 'Customer');
  const vehicle = await getOwned(svc, 'Vehicle', vehicleId, ctx, 'Vehicle');
  if (vehicle.customer_id !== customer.id) throw new EstimateError('forbidden', 'Customer and vehicle do not match', 403);
  const words = COMPONENTS.filter((c) => lc(job).includes(c));
  const brakeJob = /brake/.test(lc(job));
  let inv, ro;
  try { inv = await ownedList(svc, 'Invoice', ctx, {}); ro = await ownedList(svc, 'RepairOrder', ctx, { vehicle_id: vehicle.id }); }
  catch (_) { throw new EstimateError('read_failed', 'Shop history could not be read', 503); }
  const mm = `${lc(vehicle.make)} ${lc(vehicle.model)}`.trim();
  const billedRo = new Set();
  const items = [];
  const keep = (l) => (!words.length && !brakeJob) || words.includes(l.component) || (brakeJob && (['pad', 'rotor', 'caliper', 'shoe', 'drum', 'hardware'].includes(l.component) || /brake/.test(lc(l.name))));
  for (const i of inv.rows) {
    if (!ELIGIBLE_INVOICE.includes(i.status) || isTest(i)) continue;
    const exact = i.vehicle_id === vehicle.id;
    const comparable = !exact && mm && lc(i.vehicle_info).includes(mm) && (!vehicle.year || lc(i.vehicle_info).includes(String(vehicle.year)));
    if (!exact && !comparable) continue;
    if (i.repair_order_id) billedRo.add(i.repair_order_id);
    const date = i.invoice_date || String(i.created_date || '').slice(0, 10) || null;
    for (const l of evidenceLines('invoice', i)) if (keep(l)) items.push({ ...l, match: exact ? 'exact' : 'comparable', fitment: exact ? 'same_vehicle' : 'unverified', ref: i.invoice_number || null, date, old: date ? now - Date.parse(date) > OLD_MS : null });
  }
  for (const o of ro.rows) {
    if (!ELIGIBLE_RO.includes(o.status) || isTest(o) || billedRo.has(o.id) || o.linked_invoice_id) continue;
    const date = String(o.created_date || '').slice(0, 10) || null;
    const mileage = (vehicle.mileage_history || []).find((m) => m.ro_id === o.id)?.mileage ?? null;
    for (const l of evidenceLines('ro', o)) if (keep(l)) items.push({ ...l, match: 'exact', fitment: 'same_vehicle', ref: o.order_number || null, date, mileage, old: date ? now - Date.parse(date) > OLD_MS : null });
  }
  return {
    vehicle: { id: vehicle.id, label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ') },
    customer: { id: customer.id },
    job: short(job), axles: requestedAxles(job), history: items.slice(0, 40),
    price_memory_note: 'Last-used price memory is not an approved current price and is not used as evidence.',
    truncated: inv.truncated || ro.truncated, no_history: items.length === 0,
    tax: resolveTax(user),
  };
}

export function resolveTax(user) {
  const rate = user?.tax_rate;
  const to = user?.tax_applies_to;
  if (!finite(rate) || rate < 0 || rate > 30 || !['both', 'labor', 'parts', 'none'].includes(to)) return { verified: false };
  return { verified: true, rate, applies_to: to };
}

// Exact source-line identity: same line, same component/axle/type, same quantity AND price.
async function verifyLine(svc, ctx, line, staffPrices) {
  if (line.price_source === 'staff_typed') {
    const sp = (staffPrices || []).find((s) => s.line_key === line.line_key);
    return !!sp && sp.unit_price === line.unit_price && sp.quantity === line.quantity;
  }
  const [kind, id, idx] = String(line.price_source || '').split(':');
  const entity = { invoice: 'Invoice', ro: 'RepairOrder' }[kind];
  if (!entity || !id || idx === undefined) return false;
  const rec = await svc[entity].get(id).catch(() => null);
  if (ownership(rec, ctx) !== 'owned') return false;
  if (!(kind === 'invoice' ? ELIGIBLE_INVOICE : ELIGIBLE_RO).includes(rec.status) || isTest(rec)) return false;
  const src = evidenceLines(kind, rec).find((l) => l.source_line === line.price_source);
  if (!src) return false;
  const want = lineIdentity(line.name);
  return src.type === line.type && src.component === want.component && src.axle === want.axle && src.quantity === line.quantity && src.unit_price === line.unit_price;
}

// ---------- (B) Proposal validation. Never writes. ----------
export async function validateProposal({ svc, user, latestMessage, intentStore, proposal, staffPrices }) {
  const ctx = resolveStaffContext(user);
  const intent = await resolveIntent({ intentStore, ctx, latestMessage });
  if (intent !== 'create') return { status: 'read_only' };
  const p = proposal || {};
  const missing = [];
  const raw = Array.isArray(p.lines) ? p.lines : [];
  if (raw.length > MAX_LINES) return { status: 'invalid', errors: [`Too many lines (${raw.length} > ${MAX_LINES}); nothing was saved`] };
  const errors = [];
  const lines = raw.map((l, n) => {
    if (!['part', 'labor'].includes(l?.type)) errors.push(`Line ${n + 1}: invalid type`);
    if (!finite(l?.quantity) || l.quantity <= 0) errors.push(`Line ${n + 1}: invalid quantity`);
    if (!finite(l?.unit_price) || l.unit_price < 0) errors.push(`Line ${n + 1}: invalid price`);
    return { line_key: String(l?.line_key || n), type: l?.type, name: short(l?.name), quantity: l?.quantity, unit_price: l?.unit_price, price_source: String(l?.price_source || '') };
  });
  if (errors.length) return { status: 'invalid', errors };
  if (!p.customer_id) missing.push('Customer');
  if (!p.vehicle_id) missing.push('Vehicle');
  if (!lines.length) missing.push('Parts And Labor');
  const tax = resolveTax(user);
  if (!tax.verified) missing.push('Shop Tax Settings');
  for (const axle of requestedAxles(p.job)) {
    if (p.fitment_confirmed?.[axle] !== true) missing.push(`${axle === 'front' ? 'Front' : 'Rear'} Brake Configuration (Confirmed Fitment)`);
    else if (!lines.some((l) => lineIdentity(l.name).axle === axle)) missing.push(`${axle === 'front' ? 'Front' : 'Rear'} Parts And Labor`);
  }
  if (missing.length) return { status: 'missing_details', missing, kept: { lines } };
  const customer = await getOwned(svc, 'Customer', p.customer_id, ctx, 'Customer');
  const vehicle = await getOwned(svc, 'Vehicle', p.vehicle_id, ctx, 'Vehicle');
  if (vehicle.customer_id !== customer.id) throw new EstimateError('forbidden', 'Customer and vehicle do not match', 403);
  const unverified = [];
  for (const l of lines) if (!(await verifyLine(svc, ctx, l, staffPrices))) unverified.push(`A Verified Price And Quantity For ${l.name}`);
  if (unverified.length) return { status: 'missing_details', missing: unverified, kept: { lines } };
  return { status: 'ready_but_disabled', created: false, blockers: CREATE_BLOCKERS, resolved: { customer_id: customer.id, vehicle_id: vehicle.id, lines, tax } };
}

// Saving is disabled until the CREATE_BLOCKERS are resolved. Never writes; never claims success.
export async function createStaffEstimate(args) {
  const v = await validateProposal(args);
  return { ...v, created: false };
}

// Receipt only from an actually saved, re-read, same-shop estimate. Route verified in App.jsx: /EstimateDetail/:estimateId
export function verifiedReceipt(estimate, expectedId, user) {
  const ctx = resolveStaffContext(user);
  if (!estimate || estimate.id !== expectedId || ownership(estimate, ctx) !== 'owned' || !estimate.estimate_number) return null;
  return { id: estimate.id, estimate_number: estimate.estimate_number, status: estimate.status, vehicle: estimate.vehicle_info, work: estimate.service_reason,
    parts: (estimate.parts_items || []).map((x) => ({ name: x.name, quantity: x.quantity, total: x.total })),
    labor: (estimate.labor_items || []).map((x) => ({ name: x.description, hours: x.hours, total: x.total })),
    tax: estimate.tax_amount, total: estimate.grand_total, open_path: `/EstimateDetail/${encodeURIComponent(estimate.id)}` };
}

export function receiptCopyText(r) {
  const $ = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  return [`Estimate ${r.estimate_number}`, '', `Vehicle: ${r.vehicle}`, `Work: ${r.work}`, '',
    'Parts:', ...r.parts.map((x, i) => `${i + 1}. ${x.name} x${x.quantity} — ${$(x.total)}`), '',
    'Labor:', ...r.labor.map((x, i) => `${i + 1}. ${x.name} — ${x.hours} hr — ${$(x.total)}`), '',
    `Tax: ${$(r.tax)}`, `Total: ${$(r.total)}`].join('\n');
}