// Customer-safe projection of ONE saved estimate or invoice for the PDF sent by text.
// Mirrors the printed document (PrintTemplate via EstimatePrintView / InvoicePrintView) using only
// whitelisted fields and the exact SAVED totals: nothing is recalculated into the record, and
// internal data (technician notes, suppliers, lease/ghost bookkeeping, payment notes, tokens) never appears.
// Qty-0 lines are "Recommended": shown, but at $0 and outside the totals (shop preference).

const s = (v) => (v == null ? "" : String(v).trim());
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const r2 = (v) => Math.round(num(v) * 100) / 100;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Date-only values print as written; timestamps print as their UTC calendar date.
export function formatDocDate(value) {
  const v = s(value);
  if (!v) return "";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && v.length <= 10) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function normalizeDiscountType(type) {
  if (!type || type === "none" || type === "null") return "none";
  if (type === "$" || type === "fixed") return "fixed";
  if (type === "%" || type === "percent" || type === "percentage") return "percent";
  return "none";
}

export function shopIdentity(user) {
  return {
    business_name: s(user?.business_name) || "LBC Auto Services",
    phone: s(user?.phone),
    email: s(user?.business_email || user?.email),
    address: s(user?.address),
    gst_number: s(user?.gst_number),
  };
}

export function vehicleBlock(vehicle, fallbackInfo) {
  const v = vehicle || {};
  const info = [v.year, v.make, v.model, v.engine_liters, v.trim_level || v.trim].map(s).filter(Boolean).join(" ") || s(fallbackInfo);
  return {
    info,
    make: s(v.make), model: s(v.model), year: s(v.year), color: s(v.color), engine_type: s(v.engine_type),
    engine_liters: s(v.engine_liters), trim: s(v.trim), mileage: v.mileage ? Number(v.mileage) : null,
    license_plate: s(v.license_plate).toUpperCase(), vin: s(v.vin).toUpperCase(),
  };
}

function line({ name, description, type, unitPrice, qty, savedTotal }) {
  const q = num(qty);
  const recommended = !q;
  const unit = r2(unitPrice);
  // The saved line total wins; like the print views, only a missing/zero total falls back to price x qty.
  const amount = recommended ? 0 : r2(num(savedTotal) || unit * q);
  return { name: s(name), description: s(description), type, unitPrice: unit, qty: recommended ? 0 : q, amount, recommended };
}

// Same rule as the print views: a line that only repeats the visit reason / note lives in its own box.
function dropDuplicates(lines, ...texts) {
  const norm = (t) => s(t).toLowerCase().replace(/\s+/g, " ");
  const skip = texts.map(norm).filter(Boolean);
  return lines.filter((l) => !skip.includes(norm(l.name || l.description)));
}

function ghostBlock(doc) {
  if (doc?.ghost_status !== "active" || !(doc.ghost_items || []).length) return null;
  return {
    items: doc.ghost_items.map((g) => ({ name: s(g.name || g.description), description: g.name ? s(g.description) : "", type: s(g.type), unitPrice: r2(g.unit_price), qty: num(g.quantity), amount: r2(g.total || num(g.unit_price) * num(g.quantity)) })),
    notes: s(doc.ghost_notes),
    total: r2(doc.ghost_total),
  };
}

function totals(doc, { grandTotal, amountPaid, balanceDue }) {
  const partsTotal = r2(doc.parts_total);
  const laborTotal = r2(doc.labor_total);
  const subtotal = r2(partsTotal + laborTotal);
  const discountType = normalizeDiscountType(doc.discount_type || "$");
  const discountValue = num(doc.discount);
  const discountAmount = discountType === "percent" ? r2(subtotal * discountValue / 100) : discountType === "fixed" ? r2(discountValue) : 0;
  return {
    partsTotal, laborTotal, subtotal, discountType, discountValue, discountAmount,
    taxRate: doc.tax_rate == null ? null : num(doc.tax_rate), taxAmount: r2(doc.tax_amount), taxAppliesTo: s(doc.tax_applies_to) || "both",
    grandTotal: r2(grandTotal), amountPaid: r2(amountPaid), balanceDue: r2(balanceDue),
  };
}

const contact = (doc, customer) => ({ name: s(doc.customer_name) || s(customer?.full_name), phone: s(customer?.phone), email: s(customer?.email), address: s(customer?.address) });

// Every saved line (parts first, then labor), exactly as the printed document lists them.
export function invoiceLines(inv) {
  const items = inv.line_items || [];
  const unifiedParts = items.filter((li) => li.type === "part" || li.type === "parts");
  const parts = (unifiedParts.length ? unifiedParts : inv.parts_used || []).map((p) => line({
    name: p.name || p.description, description: [p.name ? p.description : "", p.part_number ? `Part #: ${p.part_number}` : ""].filter(Boolean).join(" · "),
    type: "part", unitPrice: p.unit_price, qty: p.quantity ?? 1, savedTotal: p.total,
  }));
  const unifiedLabor = items.filter((li) => li.type === "labor");
  const laborRows = unifiedLabor.length ? unifiedLabor : inv.labor_items || [];
  const labor = laborRows.map((l) => {
    const hours = l.hours || l.quantity || 0;
    const rate = l.rate || l.unit_price || 0;
    const auto = hours ? `${hours}h @ $${rate}/h` : "";
    return line({ name: l.name || l.description, description: l.name ? (l.description || auto) : auto, type: "labor", unitPrice: rate, qty: hours || 1, savedTotal: l.total });
  });
  if (!laborRows.length && num(inv.labor_total) > 0) labor.push(line({ name: "Labor cost", description: "", type: "labor", unitPrice: inv.labor_total, qty: 1, savedTotal: inv.labor_total }));
  return [...parts, ...labor];
}

export function estimateLines(est) {
  const parts = (est.parts_items || []).map((p) => line({ name: p.name, description: p.details || (p.part_number ? `Part #: ${p.part_number}` : ""), type: "part", unitPrice: p.unit_price, qty: p.quantity ?? 1, savedTotal: p.total }));
  const labor = (est.labor_items || []).map((l) => line({ name: l.description, description: l.details || (l.hours ? `${l.hours}h @ $${l.rate || 0}/h` : ""), type: "labor", unitPrice: l.rate, qty: l.hours, savedTotal: l.total }));
  return [...parts, ...labor];
}

export function invoiceModel(inv, customer, vehicle, shop) {
  const total = num(inv.total);
  const paid = num(inv.amount_paid);
  return {
    type: "Invoice", number: s(inv.invoice_number), date: formatDocDate(inv.invoice_date || inv.created_date),
    shop: shopIdentity(shop), customer: contact(inv, customer), vehicle: vehicleBlock(vehicle, inv.vehicle_info),
    serviceReason: s(inv.service_reason), notes: s(inv.customer_note),
    lines: dropDuplicates(invoiceLines(inv), inv.service_reason, inv.customer_note),
    payments: (inv.payment_history || []).map((p) => ({ date: formatDocDate(p.date), receipt: s(p.receipt_number || inv.receipt_number), method: s(p.method || inv.payment_method), amount: r2(p.amount) })),
    totals: totals(inv, { grandTotal: total, amountPaid: paid, balanceDue: inv.balance_due ?? Math.max(0, total - paid) }),
    ghost: ghostBlock(inv),
  };
}

export function estimateModel(est, customer, vehicle, shop) {
  const total = num(est.grand_total);
  const paid = num(est.amount_paid);
  return {
    type: "Estimate", number: s(est.estimate_number), date: formatDocDate(est.estimate_date || est.created_date),
    shop: shopIdentity(shop), customer: contact(est, customer), vehicle: vehicleBlock(vehicle, est.vehicle_info),
    serviceReason: s(est.service_reason), notes: s(est.notes),
    lines: dropDuplicates(estimateLines(est), est.service_reason, est.notes),
    payments: [],
    totals: totals(est, { grandTotal: total, amountPaid: paid, balanceDue: total - paid }),
    ghost: ghostBlock(est),
  };
}

export const buildDocumentModel = (type, doc, customer, vehicle, shop) =>
  (type === "invoice" ? invoiceModel : estimateModel)(doc, customer, vehicle, shop);