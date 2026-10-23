// Read-only, single-record tax inspection. Replaces the legacy bulk "recalculate" that listed every
// tenant's records and wrote updates by default. This module NEVER writes and NEVER lists.
import { computeTotals, canonicalTaxTarget, canonicalDiscountType, readDiscount, laborToInvoiceLine, partToInvoiceLine, r2 } from './financialPolicy.ts';
import { customerAllowed, stampOf } from './shopProvenance.ts';

export class InspectionError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

const FORBIDDEN_KEYS = ['apply', 'allow_paid', 'shop_id', 'shop_owner_email', 'shop_email', 'tenant', 'updates', 'record_ids', 'all'];
const lower = (v) => String(v || '').trim().toLowerCase();

const invoiceLines = (inv) => (inv.line_items || []).map((x) => ({ type: x.type === 'labor' ? 'labor' : 'part', quantity: Number(x.quantity ?? x.hours) || 0, unit_price: Number(x.unit_price ?? x.rate) || 0, ...(x.taxable === false ? { taxable: false } : {}) }));
const estimateLines = (est) => [...(est.labor_items || []).map(laborToInvoiceLine), ...(est.parts_items || []).map(partToInvoiceLine)];

const isFrozen = (type, rec) => type === 'Invoice'
  ? (Number(rec.amount_paid) || 0) > 0 || ['paid', 'partial'].includes(rec.status) || (rec.payment_history || []).length > 0
  : ['approved', 'invoiced', 'declined', 'expired', 'cancelled'].includes(rec.status) || !!rec.linked_invoice_id || !!rec.linked_repair_order_id;

export async function inspectFinancialTax({ user, body = {}, svc }) {
  if (!user) throw new InspectionError(401, 'unauthorized', 'Unauthorized');
  if (user.role !== 'admin') throw new InspectionError(403, 'forbidden', 'Admin access required');
  if (body.dry_run === false || FORBIDDEN_KEYS.some((k) => k in body)) {
    throw new InspectionError(409, 'apply_blocked', 'Applying tax corrections is disabled. This endpoint is read-only inspection of one of your own records; financial apply requires a separately authorized, reviewed-snapshot workflow. Shop and paid-record overrides are not accepted.');
  }
  const type = body.record_type;
  const id = typeof body.record_id === 'string' ? body.record_id.trim() : '';
  if (!['Invoice', 'Estimate'].includes(type) || !id) throw new InspectionError(400, 'scope_required', 'Provide record_type ("Invoice" or "Estimate") and a single record_id. Bulk listing is not supported.');

  const tenant = lower(user.email);
  const rec = await svc[type].get(id).catch(() => null);
  // Fail closed: not own-created, stamped for another shop, or customer not verifiably this shop's -> not found.
  const notFound = new InspectionError(404, 'not_found', 'Record not found');
  if (!rec || rec.created_by_id !== user.id) throw notFound;
  if (stampOf(rec) && stampOf(rec) !== tenant) throw notFound;
  const customer = rec.customer_id ? await svc.Customer.get(rec.customer_id).catch(() => null) : null;
  if (!customerAllowed(customer, tenant, user.id) || customer.id !== rec.customer_id) throw notFound;

  const target = canonicalTaxTarget(rec);
  const disc = readDiscount(rec);
  const missing = [];
  if (rec.tax_rate == null) missing.push('tax_rate');
  if (!target) missing.push('tax_applies_to');
  if (disc.value > 0 && !disc.type) missing.push('discount_type');

  const stored = type === 'Invoice'
    ? { tax_amount: rec.tax_amount ?? null, total: rec.total ?? null, balance_due: rec.balance_due ?? null, amount_paid: rec.amount_paid ?? 0 }
    : { tax_amount: rec.tax_amount ?? null, grand_total: rec.grand_total ?? null };
  const out = { read_only: true, apply_supported: false, record_type: type, record_id: rec.id, number: rec.invoice_number || rec.estimate_number || '', status: rec.status || '', frozen: isFrozen(type, rec), policy_missing: missing, stored, canonical: null, differences: null };
  if (missing.length) { out.note = 'Saved tax/discount policy is incomplete; no canonical values are guessed.'; return out; }

  const t = computeTotals(type === 'Invoice' ? invoiceLines(rec) : estimateLines(rec), { taxRate: rec.tax_rate, taxTarget: target, discountType: canonicalDiscountType(rec.discount_type) || 'none', discountValue: disc.value });
  out.canonical = type === 'Invoice'
    ? { subtotal: t.subtotal, discount: t.discount, tax_base: t.taxBase, tax_amount: t.tax, total: t.total, balance_due: r2(Math.max(0, t.total - (Number(rec.amount_paid) || 0))) }
    : { subtotal: t.subtotal, discount: t.discount, tax_base: t.taxBase, tax_amount: t.tax, grand_total: t.total };
  out.differences = Object.fromEntries(Object.keys(stored).filter((k) => k in out.canonical && r2(stored[k]) !== out.canonical[k]).map((k) => [k, { stored: stored[k], canonical: out.canonical[k] }]));
  if (out.frozen) out.note = 'Paid/issued historical record: shown for review only; saved values are preserved.';
  return out;
}