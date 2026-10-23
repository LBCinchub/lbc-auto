// Single financial policy for Estimate / Repair Order / Invoice (frontend, backend, print).
// Plain JS syntax on purpose: imported by Deno functions, Vite and node tests alike.
//
// Authoritative (Estimate) policy, preserved exactly:
// - Discount is computed from the PRE-TAX subtotal of billable lines (qty > 0), never from tax or grand total.
// - Discount is clamped to [0, subtotal]; a negative discount is 0.
// - Tax target "both": tax base = taxable lines - discount (floored at 0).
//   Tax target "labor"/"parts": tax base = that group's taxable lines, NOT reduced by the discount.
//   Tax target "none" (or apply_tax === false): tax is always 0.
// - Lines with taxable === false are exempt.
// - Discount, tax and total are each rounded to cents (round half away from zero on the cent value).

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Carries only an EXPLICIT line exemption across handoffs. Missing flags are never guessed or written.
export const taxFlag = (x) => (x && x.taxable === false ? { taxable: false } : {});

// Estimate/RO line -> invoice line (allowed fields only).
export const laborToInvoiceLine = (x) => ({ type: 'labor', name: x.description || '', description: x.details || '', quantity: Number(x.hours) || 0, unit_price: Number(x.rate) || 0, part_number: '', ...taxFlag(x) });
export const partToInvoiceLine = (x) => ({ type: 'part', name: x.name || '', description: x.details || '', quantity: Number(x.quantity) || 0, unit_price: Number(x.unit_price) || 0, part_number: x.part_number || '', ...taxFlag(x) });

const TARGETS = { both: 'both', all: 'both', labor: 'labor', parts: 'parts', part: 'parts', none: 'none' };

// Returns 'both' | 'labor' | 'parts' | 'none', or null when the record holds no tax target.
// Legacy apply_tax === false always wins (No Tax); a canonical 'none' is never re-enabled by apply_tax === true.
export function canonicalTaxTarget(doc) {
  if (!doc) return null;
  if (doc.apply_tax === false) return 'none';
  return TARGETS[String(doc.tax_applies_to ?? '').toLowerCase()] || null;
}

// Returns '$' | '%' | 'none', or null when the type is missing/unknown.
export function canonicalDiscountType(type) {
  const t = String(type ?? '').toLowerCase();
  if (t === '$' || t === 'fixed' || t === 'amount') return '$';
  if (t === '%' || t === 'percent' || t === 'percentage') return '%';
  if (t === 'none') return 'none';
  return null;
}

// Reads Estimate/Invoice (discount + $/%) and Repair Order (discount_value + fixed/percentage) shapes.
// Presence-based: an explicit 0 is kept. Returns null fields when the record holds nothing.
export function readDiscount(doc) {
  if (!doc) return { type: null, value: null };
  const type = canonicalDiscountType(doc.discount_type);
  const raw = doc.discount ?? doc.discount_value;
  const value = raw == null || raw === '' ? null : Number(raw) || 0;
  return { type, value: type === 'none' ? 0 : value };
}

export const toRepairOrderDiscount = ({ type, value }) => ({
  discount_type: type === '%' ? 'percentage' : type === '$' ? 'fixed' : 'none',
  discount_value: type === '%' || type === '$' ? Number(value) || 0 : 0,
});

export const toDocumentDiscount = ({ type, value }) => ({
  discount_type: type === '%' ? '%' : '$',
  discount: type === '%' || type === '$' ? Number(value) || 0 : 0,
});

// lines: [{ type: 'labor' | 'part', quantity, unit_price, taxable? }]
export function computeTotals(lines, { taxRate = 0, taxTarget = 'both', discountType = 'none', discountValue = 0 } = {}) {
  const billable = (lines || []).map((x) => ({ type: x.type === 'labor' ? 'labor' : 'part', q: Number(x.quantity) || 0, p: Number(x.unit_price) || 0, taxable: x.taxable !== false })).filter((x) => x.q > 0);
  const sum = (xs) => xs.reduce((s, x) => s + x.q * x.p, 0);
  const labor = r2(sum(billable.filter((x) => x.type === 'labor')));
  const parts = r2(sum(billable.filter((x) => x.type === 'part')));
  const subtotal = r2(labor + parts);
  const dType = canonicalDiscountType(discountType) || 'none';
  const dValue = Math.max(0, Number(discountValue) || 0);
  const rawDiscount = dType === '%' ? subtotal * dValue / 100 : dType === '$' ? dValue : 0;
  const discount = r2(Math.min(subtotal, rawDiscount));
  const target = TARGETS[String(taxTarget ?? '').toLowerCase()] || 'both';
  const inTarget = (x) => x.taxable && (target === 'both' || (target === 'labor' && x.type === 'labor') || (target === 'parts' && x.type === 'part'));
  const taxable = target === 'none' ? 0 : r2(sum(billable.filter(inTarget)));
  const taxBase = target === 'both' ? Math.max(0, taxable - discount) : taxable;
  const rate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  const tax = target === 'none' ? 0 : r2(taxBase * rate / 100);
  const total = r2(Math.max(0, subtotal - discount + tax));
  return { labor, parts, subtotal, discount, taxTarget: target, taxRate: rate, taxBase: r2(taxBase), tax, total };
}

// Repair Order form/record -> policy lines (labor rate falls back like the RO form: blank -> default, 0 kept).
export function repairOrderLines(ro, defaultRate = 120) {
  const rate = (r) => (r.rate === '' || r.rate == null ? defaultRate : Number(r.rate) || 0);
  return [
    ...(ro.labor_items || []).map((r) => ({ type: 'labor', quantity: Number(r.hours) || 0, unit_price: rate(r), ...taxFlag(r) })),
    ...(ro.parts_used || []).map((p) => ({ type: 'part', quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, ...taxFlag(p) })),
  ];
}

// Invoice action inputs. Precedence is presence-based (??): explicit intent > saved invoice > immutable
// source (Estimate/RO) > shop default. A source with No Tax (none / apply_tax=false) is never re-enabled.
// Missing discount type keeps the invoice action's historical '$' fallback.
export function resolveInvoiceInputs({ intent = {}, invoice = null, source = null, user = {} } = {}) {
  const pick = (...xs) => xs.find((x) => x != null);
  const taxRate = Number(pick(intent.tax_rate, invoice?.tax_rate, source?.tax_rate, user?.tax_rate, 0));
  const taxTarget = pick(TARGETS[String(intent.tax_applies_to ?? '').toLowerCase()], canonicalTaxTarget(invoice), canonicalTaxTarget(source), canonicalTaxTarget(user), 'both');
  const src = readDiscount(source);
  const discount = Number(pick(intent.discount, invoice?.discount, src.value, 0)) || 0;
  const discountType = pick(canonicalDiscountType(intent.discount_type), canonicalDiscountType(invoice?.discount_type), src.type, '$');
  return { taxRate, taxTarget, discount: discountType === 'none' ? 0 : discount, discountType: discountType === '%' ? '%' : '$' };
}

// Explicit tax/discount policy carried from an Estimate into a new Repair Order (no invented values).
export function estimatePolicyForRepairOrder(est) {
  const target = canonicalTaxTarget(est);
  const disc = readDiscount(est);
  const out = { ...toRepairOrderDiscount({ type: disc.type ?? 'none', value: disc.value }) };
  if (est.tax_rate != null) out.tax_rate = Number(est.tax_rate) || 0;
  if (target) { out.tax_applies_to = target; out.apply_tax = target !== 'none'; }
  if (est.tax_amount != null) out.tax_amount = r2(est.tax_amount);
  return out;
}