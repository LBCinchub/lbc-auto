import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { listAllRecords } from '../../shared/entityPagination.ts';

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

// Subtotal from the unified line_items array (type "labor"/"part", quantity, unit_price).
const invoiceSubtotal = (inv) => (inv.line_items || []).reduce(
  (s, x) => s + (Number(x.quantity) || 0) * (Number(x.unit_price) || 0), 0
);

// Subtotal from the estimate's split labor_items + parts_items arrays.
const estimateSubtotal = (est) => {
  const labor = (est.labor_items || []).reduce((s, x) => s + (Number(x.hours) || 0) * (Number(x.rate) || 0), 0);
  const parts = (est.parts_items || []).reduce((s, x) => s + (Number(x.quantity) || 0) * (Number(x.unit_price) || 0), 0);
  return labor + parts;
};

const discountAmount = (subtotal, discount, discountType) => {
  const d = Number(discount) || 0;
  return discountType === '%' || discountType === 'percent' ? r2(subtotal * Math.max(0, d) / 100) : r2(Math.max(0, d));
};

// Recalculates tax_amount + total for every invoice and estimate that has a
// tax_rate > 0 but tax_amount === 0 (the symptom of the parts/labor tax bug).
// Tax is applied to the FULL subtotal (parts + labor) per business requirement;
// only tax_amount, total, balance_due (invoices) and grand_total (estimates)
// are written — no other fields are touched.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const allInvoices = await listAllRecords(base44.asServiceRole.entities.Invoice, {}, '-created_date');
    const invoiceUpdates = [];
    for (const inv of allInvoices) {
      const rate = Number(inv.tax_rate) || 0;
      if (rate <= 0) continue;
      if (Number(inv.tax_amount) > 0) continue;            // already taxed — leave alone
      if (!Array.isArray(inv.line_items) || inv.line_items.length === 0) continue;
      const subtotal = invoiceSubtotal(inv);
      if (subtotal <= 0) continue;
      const disc = discountAmount(subtotal, inv.discount, inv.discount_type);
      const tax = r2(subtotal * rate / 100);
      const total = r2(Math.max(0, subtotal - disc + tax));
      const balance = r2(Math.max(0, total - (Number(inv.amount_paid) || 0)));
      invoiceUpdates.push({ id: inv.id, tax_amount: tax, total, balance_due: balance });
    }

    const allEstimates = await listAllRecords(base44.asServiceRole.entities.Estimate, {}, '-created_date');
    const estimateUpdates = [];
    for (const est of allEstimates) {
      const rate = Number(est.tax_rate) || 0;
      if (rate <= 0) continue;
      if (Number(est.tax_amount) > 0) continue;
      if (!Array.isArray(est.labor_items) && !Array.isArray(est.parts_items)) continue;
      if ((est.labor_items || []).length === 0 && (est.parts_items || []).length === 0) continue;
      const subtotal = estimateSubtotal(est);
      if (subtotal <= 0) continue;
      const disc = discountAmount(subtotal, est.discount, est.discount_type);
      const tax = r2(subtotal * rate / 100);
      const grandTotal = r2(Math.max(0, subtotal - disc + tax));
      estimateUpdates.push({ id: est.id, tax_amount: tax, grand_total: grandTotal });
    }

    if (dryRun) {
      return Response.json({
        dry_run: true,
        invoices_to_correct: invoiceUpdates.length,
        estimates_to_correct: estimateUpdates.length,
        invoice_ids: invoiceUpdates.map((u) => u.id),
        estimate_ids: estimateUpdates.map((u) => u.id),
      });
    }

    // Apply in batches of 500 (bulkUpdate cap).
    for (let i = 0; i < invoiceUpdates.length; i += 500) {
      await base44.asServiceRole.entities.Invoice.bulkUpdate(invoiceUpdates.slice(i, i + 500));
    }
    for (let i = 0; i < estimateUpdates.length; i += 500) {
      await base44.asServiceRole.entities.Estimate.bulkUpdate(estimateUpdates.slice(i, i + 500));
    }

    console.log(`[recalculateFinancialTax] Corrected ${invoiceUpdates.length} invoice(s) and ${estimateUpdates.length} estimate(s).`);
    return Response.json({
      success: true,
      invoices_corrected: invoiceUpdates.length,
      estimates_corrected: estimateUpdates.length,
      invoice_ids: invoiceUpdates.map((u) => u.id),
      estimate_ids: estimateUpdates.map((u) => u.id),
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Tax recalculation failed' }, { status: 500 });
  }
}