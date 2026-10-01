// Staff AI estimate core — evidence retrieval + one authorized saved estimate.
// Pure module: all data access goes through injected clients so it can be
// tested with synthetic fixtures. NOT imported by any deployed function yet.
//   svc  = service-role entities (reads + audit), always tenant-filtered here
//   userDb = the signed-in owner's entities (estimate create, so normal RLS/visibility apply)

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const lc = (v) => String(v || '').trim().toLowerCase();
export const MAX_HISTORY = 200;
export const RATE_LIMIT = { max: 10, windowMs: 10 * 60 * 1000 };
const OLD_MS = 730 * 24 * 3600 * 1000;

export class EstimateError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

// Same tenant rule as financialDocumentAction (canonical shop authority).
export function staffTenant(user) {
  if (!user) throw new EstimateError('unauthorized', 'Sign in required', 401);
  if (user.role !== 'admin' && !user.business_name) throw new EstimateError('forbidden', 'Owner or admin access required', 403);
  const tenant = lc(user.email);
  if (!tenant) throw new EstimateError('forbidden', 'Shop identity could not be verified', 403);
  return tenant;
}
export function owns(record, user) {
  if (!record) return false;
  const explicit = lc(record.shop_owner_email || record.shop_email || record.created_by);
  return explicit ? explicit === lc(user.email) : record.created_by_id === user.id;
}
async function getOwned(svc, entity, id, user, label) {
  if (!id) throw new EstimateError('missing', `${label} is required`);
  const rec = await svc[entity].get(id).catch(() => null);
  if (!rec || !owns(rec, user)) throw new EstimateError('forbidden', `${label} not found in this shop`, 403);
  return rec;
}

// Intent comes ONLY from the staff's own typed message — never from model output or record text.
export function detectIntent(staffMessage) {
  const t = lc(staffMessage);
  return /\b(create|make|build|write up|save)\b[^.?!]*\bestimate\b/.test(t) ? 'create' : 'read';
}
export function requestedAxles(job) {
  const t = lc(job);
  if (/all around|all four|all 4|front and rear|rear and front|4 wheel/.test(t)) return ['front', 'rear'];
  return ['front', 'rear'].filter((a) => t.includes(a));
}
const axleOf = (text) => { const t = lc(text); return t.includes('front') ? 'front' : t.includes('rear') ? 'rear' : ''; };
const JOB_WORDS = ['brake', 'pad', 'rotor', 'caliper', 'shoe', 'drum', 'oil', 'filter', 'tire', 'alignment', 'battery', 'strut', 'shock', 'sensor', 'spark', 'coolant', 'belt', 'hub', 'bearing'];
const jobTokens = (job) => JOB_WORDS.filter((w) => lc(job).includes(w));
const short = (s) => String(s || '').replace(/[\r\n<>`]/g, ' ').slice(0, 80).trim();
const vehKey = (v) => `${v.year || ''} ${lc(v.make)} ${lc(v.model)}`.trim();

function invoiceLines(inv) {
  return (inv.line_items || []).filter((l) => Number(l.quantity) > 0).map((l) => ({ type: l.type === 'labor' ? 'labor' : 'part', name: short(l.name || l.description), quantity: Number(l.quantity) || 0, unit_price: r2(l.unit_price) }));
}
function roLines(ro) {
  return [
    ...(ro.labor_items || []).map((l) => ({ type: 'labor', name: short(l.description), quantity: Number(l.hours) || 0, unit_price: r2(l.rate) })),
    ...(ro.parts_used || []).map((p) => ({ type: 'part', name: short(p.name), quantity: Number(p.quantity) || 0, unit_price: r2(p.unit_price) })),
  ].filter((l) => l.quantity > 0);
}
const isTest = (r) => /\b(test|sample|demo)\b/i.test(`${r.customer_name || ''} ${r.invoice_number || r.order_number || ''}`);

// (A) Grounded, same-shop evidence. Never includes notes, PII or other tenants.
export async function loadEvidence({ svc, user, customerId, vehicleId, job, now = Date.now() }) {
  staffTenant(user);
  const customer = await getOwned(svc, 'Customer', customerId, user, 'Customer');
  const vehicle = await getOwned(svc, 'Vehicle', vehicleId, user, 'Vehicle');
  if (vehicle.customer_id !== customer.id) throw new EstimateError('forbidden', 'Customer and vehicle do not match', 403);
  const tokens = jobTokens(job);
  const axles = requestedAxles(job);
  let invoices, ros;
  try {
    invoices = await svc.Invoice.filter({}, '-created_date', MAX_HISTORY);
    ros = await svc.RepairOrder.filter({ vehicle_id: vehicle.id }, '-created_date', MAX_HISTORY);
  } catch (_) { throw new EstimateError('read_failed', 'Shop history could not be read — no estimate was created', 503); }
  const truncated = invoices.length >= MAX_HISTORY || ros.length >= MAX_HISTORY;
  const mine = invoices.filter((i) => owns(i, user) && !isTest(i));
  const key = vehKey(vehicle);
  const items = [];
  const seenRo = new Set();
  const push = (src, lines, match) => {
    const ts = Date.parse(src.date) || 0;
    for (const l of lines) {
      if (tokens.length && !tokens.some((t) => lc(l.name).includes(t))) continue;
      items.push({ ...l, axle: axleOf(l.name), match, ref: src.ref, date: src.date || '', mileage: src.mileage ?? null, old: !ts || now - ts > OLD_MS });
    }
  };
  for (const inv of mine) {
    const exact = inv.vehicle_id === vehicle.id;
    const comparable = !exact && key && lc(inv.vehicle_info).includes(`${lc(vehicle.make)} ${lc(vehicle.model)}`);
    if (!exact && !comparable) continue;
    if (inv.repair_order_id) seenRo.add(inv.repair_order_id);
    push({ ref: inv.invoice_number || inv.id, date: inv.invoice_date || String(inv.created_date || '').slice(0, 10) }, invoiceLines(inv), exact ? 'exact' : 'comparable');
  }
  for (const ro of ros) {
    if (!owns(ro, user) || isTest(ro) || !['completed', 'delivered'].includes(ro.status)) continue;
    if (seenRo.has(ro.id) || ro.linked_invoice_id) continue; // already counted via its invoice
    const mileage = (vehicle.mileage_history || []).find((m) => m.ro_id === ro.id)?.mileage ?? null;
    push({ ref: ro.order_number || ro.id, date: String(ro.created_date || '').slice(0, 10), mileage }, roLines(ro), 'exact');
  }
  const library = (await svc.LineItemLibrary.filter({ shop_owner_email: lc(user.email) }, '-times_used', 100).catch(() => []))
    .filter((x) => owns(x, user) && (!tokens.length || tokens.some((t) => lc(x.item_name).includes(t))))
    .map((x) => ({ id: x.id, type: x.type, name: short(x.item_name), current_price: r2(x.last_unit_price) }));
  return {
    vehicle: { id: vehicle.id, label: [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' '), vin: vehicle.vin || '' },
    customer: { id: customer.id, name: customer.full_name || '' },
    job: short(job), axles, history: items.slice(0, 40), current_prices: library,
    truncated, no_history: items.length === 0,
    tax: { rate: Number(user.tax_rate) || 0, applies_to: user.tax_applies_to || 'both' },
  };
}

// Canonical estimate math (mirrors financialDocumentAction.calculate, no discount).
export function calculate(lines, taxRate, appliesTo) {
  const a = lc(appliesTo || 'both');
  const live = lines.filter((x) => x.quantity > 0);
  const labor = r2(live.filter((x) => x.type === 'labor').reduce((s, x) => s + x.quantity * x.unit_price, 0));
  const parts = r2(live.filter((x) => x.type !== 'labor').reduce((s, x) => s + x.quantity * x.unit_price, 0));
  const taxable = live.filter((x) => a === 'none' ? false : a === 'labor' ? x.type === 'labor' : (a === 'parts' || a === 'part') ? x.type !== 'labor' : true).reduce((s, x) => s + x.quantity * x.unit_price, 0);
  const tax = r2(taxable * Math.max(0, Number(taxRate) || 0) / 100);
  return { labor, parts, tax, total: r2(labor + parts + tax) };
}

async function sha(text) {
  const d = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, '0')).join('');
}

// Every price must trace to a same-shop invoice/RO/library record, or be typed by staff.
async function verifyPriceSource(svc, user, line, staffText) {
  const [kind, id] = String(line.price_source || '').split(':');
  if (kind === 'staff') return new RegExp(`\\$?\\b${String(line.unit_price).replace('.', '\\.')}\\b`).test(staffText);
  const entity = { invoice: 'Invoice', ro: 'RepairOrder', library: 'LineItemLibrary' }[kind];
  if (!entity || !id) return false;
  const rec = await svc[entity].get(id).catch(() => null);
  if (!rec || !owns(rec, user)) return false;
  const prices = kind === 'library' ? [r2(rec.last_unit_price)] : kind === 'invoice' ? invoiceLines(rec).map((l) => l.unit_price) : roLines(rec).map((l) => l.unit_price);
  return prices.includes(r2(line.unit_price));
}

// (B) Create exactly one saved estimate. Returns {created:false, missing} with zero writes when unresolved.
export async function createStaffEstimate({ svc, userDb, user, staffMessages, proposal, idempotencyKey, now = Date.now() }) {
  const tenant = staffTenant(user);
  const staffText = (staffMessages || []).join('\n');
  if (detectIntent(staffMessages?.[staffMessages.length - 1]) !== 'create') return { created: false, reason: 'read_only', missing: [] };
  if (!idempotencyKey || String(idempotencyKey).length < 16) throw new EstimateError('invalid', 'Idempotency key is required');
  const p = proposal || {};
  const missing = [...(Array.isArray(p.missing) ? p.missing.map(short) : [])];
  if (!p.customer_id) missing.push('Customer');
  if (!p.vehicle_id) missing.push('Vehicle');
  const lines = (Array.isArray(p.lines) ? p.lines : []).slice(0, 30).map((l) => ({ type: l.type === 'labor' ? 'labor' : 'part', name: short(l.name), details: short(l.details), part_number: short(l.part_number), quantity: Number(l.quantity), unit_price: Number(l.unit_price), price_source: String(l.price_source || '') }));
  if (!lines.length) missing.push('Parts And Labor');
  for (const l of lines) if (!l.name || !(l.quantity > 0) || !Number.isFinite(l.unit_price) || l.unit_price < 0) missing.push(`Valid Quantity And Price For ${l.name || 'A Line'}`);
  for (const axle of requestedAxles(p.job || staffText)) if (!lines.some((l) => axleOf(`${l.name} ${l.details}`) === axle)) missing.push(`${axle === 'front' ? 'Front' : 'Rear'} Brake Configuration And Parts`);
  if (missing.length) return { created: false, reason: 'missing_details', missing: [...new Set(missing)] };

  const customer = await getOwned(svc, 'Customer', p.customer_id, user, 'Customer');
  const vehicle = await getOwned(svc, 'Vehicle', p.vehicle_id, user, 'Vehicle');
  if (vehicle.customer_id !== customer.id) throw new EstimateError('forbidden', 'Customer and vehicle do not match', 403);
  for (const l of lines) if (!(await verifyPriceSource(svc, user, l, staffText))) return { created: false, reason: 'unverified_price', missing: [`A Confirmed Price For ${l.name}`] };

  const keyHash = await sha(`${tenant}:${idempotencyKey}`);
  const payloadHash = await sha(JSON.stringify({ c: customer.id, v: vehicle.id, lines: lines.map(({ price_source, ...x }) => x) }));
  const prior = await svc.FinancialWorkflowEvent.filter({ shop_owner_email: tenant, idempotency_key: keyHash, action: 'create' }, '-created_date', 1);
  if (prior[0]) {
    if (prior[0].metadata?.payload_hash !== payloadHash) throw new EstimateError('conflict', 'This request key was already used for a different estimate', 409);
    const existing = await svc.Estimate.get(prior[0].estimate_id).catch(() => null);
    if (existing) return { created: true, replayed: true, receipt: receiptOf(existing) };
  }
  const recent = await svc.FinancialWorkflowEvent.filter({ shop_owner_email: tenant, action: 'create', source_type: 'staff_ai_estimate' }, '-created_date', RATE_LIMIT.max);
  if (recent.filter((e) => now - Date.parse(e.created_at) < RATE_LIMIT.windowMs).length >= RATE_LIMIT.max) throw new EstimateError('rate_limited', 'Too many AI estimates — try again in a few minutes', 429);

  const estimateNumber = `EST-${keyHash.slice(0, 8).toUpperCase()}`;
  const dup = (await svc.Estimate.filter({ estimate_number: estimateNumber }, '-created_date', 1)).find((e) => owns(e, user) || e.created_by_id === user.id);
  const taxRate = Number(user.tax_rate) || 0;
  const taxTo = ['both', 'labor', 'parts', 'none'].includes(user.tax_applies_to) ? user.tax_applies_to : 'both';
  const t = calculate(lines, taxRate, taxTo);
  const today = new Date(now).toISOString().slice(0, 10);
  const estimate = dup || await userDb.Estimate.create({
    estimate_number: estimateNumber, customer_id: customer.id, customer_name: customer.full_name || '', vehicle_id: vehicle.id,
    vehicle_info: [vehicle.year, vehicle.make, vehicle.model, vehicle.engine_liters, vehicle.trim].filter(Boolean).join(' '),
    labor_items: lines.filter((l) => l.type === 'labor').map((l) => ({ description: l.name, details: l.details, hours: l.quantity, rate: r2(l.unit_price), total: r2(l.quantity * l.unit_price) })),
    parts_items: lines.filter((l) => l.type !== 'labor').map((l) => ({ name: l.name, details: l.details, part_number: l.part_number, quantity: l.quantity, unit_price: r2(l.unit_price), total: r2(l.quantity * l.unit_price) })),
    labor_total: t.labor, parts_total: t.parts, tax_rate: taxRate, tax_applies_to: taxTo, tax_amount: t.tax, discount: 0, discount_type: '$', grand_total: t.total,
    estimate_date: today, service_reason: short(p.job || ''), notes: '',
    status: 'draft', auth_status: 'none', amount_paid: 0, // normal new-estimate lifecycle (same as Create Estimate)
  });
  await svc.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'create', estimate_id: estimate.id, customer_id: customer.id, source_type: 'staff_ai_estimate', idempotency_key: keyHash, created_at: new Date(now).toISOString(), actor_email: tenant, metadata: { payload_hash: payloadHash, total: t.total, price_sources: lines.map((l) => l.price_source) } });
  const saved = await svc.Estimate.get(estimate.id);
  if (!saved) throw new EstimateError('not_saved', 'Estimate could not be confirmed — Not Created', 500);
  return { created: true, replayed: false, receipt: receiptOf(saved) };
}

function receiptOf(e) {
  return { id: e.id, estimate_number: e.estimate_number, status: e.status, vehicle: e.vehicle_info, work: e.service_reason,
    parts: (e.parts_items || []).map((x) => ({ name: x.name, quantity: x.quantity, total: x.total })),
    labor: (e.labor_items || []).map((x) => ({ name: x.description, hours: x.hours, total: x.total })),
    tax: e.tax_amount, total: e.grand_total, open_path: `/EstimateDetail/${e.id}` };
}

// Customer-safe, plain-text copy. No sources, costs or discount math.
export function receiptCopyText(r) {
  const $ = (n) => `$${(Number(n) || 0).toFixed(2)}`;
  return [
    `Estimate ${r.estimate_number}`, '',
    `Vehicle: ${r.vehicle}`, `Work: ${r.work}`, '',
    'Parts:', ...r.parts.map((x, i) => `${i + 1}. ${x.name} x${x.quantity} — ${$(x.total)}`), '',
    'Labor:', ...r.labor.map((x, i) => `${i + 1}. ${x.name} — ${x.hours} hr — ${$(x.total)}`), '',
    `Tax: ${$(r.tax)}`, `Total: ${$(r.total)}`,
  ].join('\n');
}