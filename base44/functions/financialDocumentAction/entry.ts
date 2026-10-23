import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { upsertLineItems } from '../../shared/lineItemLibrary.ts';
import { assertInvoiceMatchesSource, applyPayments, paymentAlreadyApplied } from '../../shared/invoicePaymentGuard.ts';
import { withLease, LeaseBusyError } from '../../shared/recordLease.ts';
import { computeTotals, canonicalDiscountType, resolveInvoiceInputs } from '../../shared/financialPolicy.ts';
import { assertConsistent, resolveEstimateRepairOrder, linkPatches } from '../../shared/financialLinks.ts';

const r2 = (value) => Math.round((Number(value) || 0) * 100) / 100;
const normalizeDiscount = (type) => type === '%' || type === 'percent' || type === 'percentage' ? '%' : type === '$' || type === 'fixed' ? '$' : '$';
const cleanLines = (lines = [], source = 'Manual') => lines.filter(Boolean).map((line) => ({
  type: line.type === 'labor' ? 'labor' : 'part',
  name: String(line.name || line.description || '').trim(),
  // `description` is the per-line details (print DESCRIPTION column). For legacy
  // rows that only carried the item name in `description`, clear it so the name
  // isn't duplicated into the description; new rows keep their typed details.
  description: line.name ? String(line.description || '').trim() : '',
  quantity: Number(line.quantity ?? line.hours) || 0,
  unit_price: Number(line.unit_price ?? line.rate) || 0,
  taxable: line.taxable !== false,
  customer_note: String(line.customer_note || ''),
  part_number: String(line.part_number || ''),
  source: line.source || source,
}));
const mapLaborLine = (x) => ({ type: 'labor', name: x.description || '', description: x.details || '', quantity: Number(x.hours) || 0, unit_price: Number(x.rate) || 0, part_number: '' });
const mapPartsLine = (x) => ({ type: 'part', name: x.name || '', description: x.details || '', quantity: Number(x.quantity) || 0, unit_price: Number(x.unit_price) || 0, part_number: x.part_number || '' });
const sourceLines = (type, record) => type === 'estimate'
  ? cleanLines([...(record.labor_items || []).map(mapLaborLine), ...(record.parts_items || []).map(mapPartsLine)], 'Estimate')
  : type === 'repair_order'
    ? cleanLines([...(record.labor_items || []).map(mapLaborLine), ...(record.parts_used || []).map(mapPartsLine)], 'Repair Order')
    : [];
// Shared policy: discount from pre-tax subtotal only, No Tax always 0 (see shared/financialPolicy.ts).
const calculate = (lines, taxRate, taxAppliesTo, discount, discountType, paid = 0) => {
  const t = computeTotals(lines, { taxRate, taxTarget: taxAppliesTo, discountType: canonicalDiscountType(discountType) || '$', discountValue: discount });
  return { labor: t.labor, parts: t.parts, subtotal: t.subtotal, discountAmount: t.discount, tax: t.tax, total: t.total, balance: r2(Math.max(0, t.total - paid)) };
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && !user.business_name) return Response.json({ error: 'Owner or admin access required' }, { status: 403 });
    const body = await req.json();
    const action = body.action || 'load';
    const tenant = String(user.email || '').toLowerCase();
    const owns = (record) => {
      if (!record) return false;
      const explicit = String(record.shop_owner_email || record.shop_email || record.created_by || '').toLowerCase();
      return explicit ? explicit === tenant : record.created_by_id === user.id;
    };
    const getOwned = async (entity, id, label) => {
      const record = await base44.asServiceRole.entities[entity].get(id);
      if (!record || !owns(record)) throw new Error(`${label} not found in this shop`);
      return record;
    };
    let sourceType = body.source_type;
    let sourceId = body.source_id;
    let invoice = null;
    let source = null;
    if (sourceType === 'invoice') invoice = await getOwned('Invoice', sourceId || body.invoice_id, 'Invoice');
    else if (sourceType === 'estimate') source = await getOwned('Estimate', sourceId, 'Estimate');
    else if (sourceType === 'repair_order') source = await getOwned('RepairOrder', sourceId, 'Repair Order');
    else if (sourceType === 'vehicle') source = await getOwned('Vehicle', sourceId, 'Vehicle');
    else if (sourceType === 'customer') source = await getOwned('Customer', sourceId, 'Customer');
    else throw new Error('A valid financial source is required');

    if (!invoice && (sourceType === 'estimate' || sourceType === 'repair_order')) {
      const linkedId = source.linked_invoice_id;
      if (linkedId) invoice = await base44.asServiceRole.entities.Invoice.get(linkedId).catch(() => null);
      if (!invoice) {
        const field = sourceType === 'estimate' ? 'estimate_id' : 'repair_order_id';
        const matches = await base44.asServiceRole.entities.Invoice.filter({ [field]: source.id }, '-created_date', 1);
        invoice = matches[0] || null;
      }
      // Cross-route: an RO cashed out via its estimate (or an estimate via its RO) shares one invoice.
      if (!invoice) {
        const partnerId = sourceType === 'repair_order' ? source.estimate_id : source.linked_repair_order_id;
        const partner = partnerId ? await base44.asServiceRole.entities[sourceType === 'repair_order' ? 'Estimate' : 'RepairOrder'].get(partnerId).catch(() => null) : null;
        if (partner && owns(partner) && partner.customer_id === source.customer_id) {
          const back = sourceType === 'repair_order' ? partner.linked_repair_order_id : partner.estimate_id;
          if (!back || back === source.id) {
            if (partner.linked_invoice_id) invoice = await base44.asServiceRole.entities.Invoice.get(partner.linked_invoice_id).catch(() => null);
            if (!invoice) invoice = (await base44.asServiceRole.entities.Invoice.filter({ [sourceType === 'repair_order' ? 'estimate_id' : 'repair_order_id']: partner.id }, '-created_date', 1))[0] || null;
          }
        }
      }
      if (invoice && !owns(invoice)) throw new Error('Linked invoice belongs to another shop');
    }
    if (!invoice && body.invoice_id) invoice = await getOwned('Invoice', body.invoice_id, 'Invoice');
    assertInvoiceMatchesSource({ sourceType, source, invoice, requestedInvoiceId: body.invoice_id || '' });

    const customerId = invoice?.customer_id || source?.customer_id || (sourceType === 'customer' ? source.id : '');
    let vehicleId = invoice?.vehicle_id || source?.vehicle_id || (sourceType === 'vehicle' ? source.id : body.intent?.vehicle_id || body.vehicle_id);
    const customer = await getOwned('Customer', customerId, 'Customer');
    if (!vehicleId) {
      const candidates = (await base44.asServiceRole.entities.Vehicle.filter({ customer_id: customer.id }, '-created_date', 50)).filter(owns);
      const target = String(invoice?.vehicle_info || source?.vehicle_info || '').trim().toLowerCase();
      const matched = candidates.find((v) => `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim().toLowerCase() === target);
      vehicleId = matched?.id || (candidates.length === 1 ? candidates[0].id : '');
    }
    const vehicle = await getOwned('Vehicle', vehicleId, 'Vehicle');
    if (vehicle.customer_id !== customer.id) throw new Error('Customer and vehicle relationship is invalid');
    // Authoritative relationships: stored links first (foreign -> 403, mismatched -> 400), then the
    // estimate's verified converted RO, then the RO's estimate. Every entry route resolves the same set.
    const findOwned = async (entity, query) => (await base44.asServiceRole.entities[entity].filter(query, '-created_date', 10)).filter(owns);
    let estimate = invoice?.estimate_id ? await getOwned('Estimate', invoice.estimate_id, 'Estimate') : sourceType === 'estimate' ? source : null;
    let repairOrder = invoice?.repair_order_id ? await getOwned('RepairOrder', invoice.repair_order_id, 'Repair Order') : sourceType === 'repair_order' ? source : null;
    if (!repairOrder && estimate) repairOrder = await resolveEstimateRepairOrder({ estimate, customerId: customer.id, vehicleId: vehicle.id, getOwned, findOwned });
    if (!estimate && repairOrder?.estimate_id) estimate = await getOwned('Estimate', repairOrder.estimate_id, 'Estimate');
    if (estimate && repairOrder?.estimate_id && repairOrder.estimate_id !== estimate.id) throw new Error('Repair Order belongs to a different estimate');
    assertConsistent('Estimate', estimate, customer.id, vehicle.id);
    assertConsistent('Repair Order', repairOrder, customer.id, vehicle.id);
    assertConsistent('Invoice', invoice, customer.id, vehicle.id);
    // Idempotent link recovery on mutating actions only (load stays read-only; no bulk backfill).
    const recoverLinks = async () => {
      const p = linkPatches({ invoice, estimate, repairOrder });
      if (Object.keys(p.invoice).length) invoice = await base44.entities.Invoice.update(invoice.id, p.invoice);
      if (p.estimate) await base44.entities.Estimate.update(estimate.id, p.estimate);
      if (p.repairOrder) await base44.entities.RepairOrder.update(repairOrder.id, p.repairOrder);
    };

    const initialLines = invoice ? cleanLines(invoice.line_items || [], 'Invoice') : sourceLines(sourceType, source);
    const defaults = resolveInvoiceInputs({ invoice, source, user });
    const defaultTaxRate = defaults.taxRate;
    const defaultTaxTarget = defaults.taxTarget;
    const context = { source_type: sourceType, source_id: sourceId, source_number: invoice?.invoice_number || source?.estimate_number || source?.order_number || '', source_status: invoice?.status || source?.status || 'draft' };
    if (action === 'load') return Response.json({ invoice, customer, vehicle, estimate, repair_order: repairOrder, context, shop: { business_name: user.business_name || 'LBC Auto', logo_url: user.logo_url || '', phone: user.phone || '', address: user.address || '' }, draft: { line_items: initialLines, tax_rate: defaultTaxRate, tax_applies_to: defaultTaxTarget, discount: defaults.discount, discount_type: defaults.discountType, due_date: invoice?.due_date || '', invoice_date: invoice?.invoice_date || new Date().toISOString().slice(0, 10), customer_note: invoice?.customer_note || source?.notes || '', service_reason: invoice?.service_reason || source?.service_reason || source?.description || '' } });

    const intent = body.intent || {};
    let lines = cleanLines(intent.line_items || initialLines);
    const paid = Number(invoice?.amount_paid) || 0;
    const resolved = resolveInvoiceInputs({ intent, invoice, source, user });
    const taxRate = resolved.taxRate;
    if (!(taxRate >= 0 && taxRate <= 100)) throw new Error('Tax rate is invalid');
    const taxTarget = resolved.taxTarget;
    const totals = calculate(lines, taxRate, taxTarget, resolved.discount, resolved.discountType, paid);

    // Ghost carryover — when creating an invoice from an Estimate or Repair Order
    // that has an active ghost, the ghost moves to the new invoice (stays active),
    // recalculated using THIS invoice's tax_rate/tax_applies_to. Completed totals
    // (above) and ghost totals are calculated independently and never mixed.
    const createGhostItems = Array.isArray(source?.ghost_items) ? source.ghost_items : [];
    const createGhostActive = source?.ghost_status === 'active' && createGhostItems.length > 0;
    const createGhostTotals = createGhostActive ? calculate(cleanLines(createGhostItems), taxRate, taxTarget, 0, '$', 0) : null;

    let replayed = false;
    if (action === 'relink') {
      if (!invoice) throw new Error('Invoice is required');
      const nextVehicle = intent.vehicle_id ? await getOwned('Vehicle', intent.vehicle_id, 'Vehicle') : vehicle;
      if (nextVehicle.customer_id !== customer.id) throw new Error('Vehicle does not belong to this customer');
      let nextRepairOrder = null;
      if (intent.repair_order_id) {
        nextRepairOrder = await getOwned('RepairOrder', intent.repair_order_id, 'Repair Order');
        if (nextRepairOrder.customer_id !== customer.id || nextRepairOrder.vehicle_id !== nextVehicle.id) throw new Error('Repair Order relationship is invalid');
      }
      invoice = await base44.entities.Invoice.update(invoice.id, { vehicle_id: nextVehicle.id, repair_order_id: nextRepairOrder?.id || invoice.repair_order_id || '' });
      if (nextRepairOrder) await base44.entities.RepairOrder.update(nextRepairOrder.id, { linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number });
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'link', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: body.idempotency_key || '', created_at: new Date().toISOString(), actor_email: tenant, metadata: { vehicle_id: nextVehicle.id, repair_order_id: nextRepairOrder?.id || '' } });
    } else if ((action === 'create' || action === 'finalize') && !invoice) {
      const key = String(body.idempotency_key || '');
      if (!key) throw new Error('Idempotency key is required');
      // Serialize invoice creation per customer with a durable atomic lease, then re-check every
      // recovery path inside it: retry key event, deterministic number, and the source's links.
      await withLease(base44.asServiceRole.entities, 'Customer', customer.id, async () => {
      const prior = await base44.asServiceRole.entities.FinancialWorkflowEvent.filter({ shop_owner_email: tenant, idempotency_key: key, action: 'create' }, '-created_date', 1);
      if (prior[0]?.invoice_id) invoice = await getOwned('Invoice', prior[0].invoice_id, 'Invoice');
      if (!invoice && (estimate || repairOrder)) {
        const freshE = estimate ? await getOwned('Estimate', estimate.id, 'Estimate') : null;
        const freshR = repairOrder ? await getOwned('RepairOrder', repairOrder.id, 'Repair Order') : null;
        for (const id of [freshE?.linked_invoice_id, freshR?.linked_invoice_id].filter(Boolean)) {
          const linked = await base44.asServiceRole.entities.Invoice.get(id).catch(() => null);
          if (linked && owns(linked)) { invoice = linked; break; }
        }
        if (!invoice && estimate) invoice = (await findOwned('Invoice', { estimate_id: estimate.id }))[0] || null;
        if (!invoice && repairOrder) invoice = (await findOwned('Invoice', { repair_order_id: repairOrder.id }))[0] || null;
        if (invoice) { replayed = true; await recoverLinks(); }
      }
      if (!invoice) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${tenant}:${key}`));
        const suffix = Array.from(new Uint8Array(digest)).slice(0, 5).map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
        const invoiceNumber = `INV-${suffix}`;
        const existing = await base44.asServiceRole.entities.Invoice.filter({ invoice_number: invoiceNumber }, '-created_date', 1);
        invoice = existing.find(owns) || null;
        if (!invoice) invoice = await base44.entities.Invoice.create({ invoice_number: invoiceNumber, customer_id: customer.id, customer_name: customer.full_name, vehicle_id: vehicle.id, vehicle_info: [vehicle.year, vehicle.make, vehicle.model, vehicle.engine_liters, vehicle.trim].filter(Boolean).join(' '), estimate_id: estimate?.id || '', repair_order_id: repairOrder?.id || '', status: 'unpaid', amount_paid: 0, payment_history: [], line_items: lines.map((x) => ({ ...x, total: r2(x.quantity * x.unit_price) })), parts_used: lines.filter((x) => x.type !== 'labor').map((x) => ({ name: x.name || x.description || '', part_number: '', quantity: x.quantity, unit_price: x.unit_price, total: r2(x.quantity * x.unit_price) })), labor_total: totals.labor, parts_total: totals.parts, tax_rate: taxRate, tax_applies_to: taxTarget, tax_amount: totals.tax, discount: resolved.discount, discount_type: resolved.discountType, total: totals.total, balance_due: totals.balance, invoice_date: intent.invoice_date || new Date().toISOString().slice(0, 10), due_date: intent.due_date || '', customer_note: intent.customer_note || source?.notes || '', service_reason: intent.service_reason || source?.service_reason || source?.description || '', ghost_items: createGhostActive ? createGhostItems : [], ghost_status: createGhostActive ? 'active' : 'none', ghost_notes: source?.ghost_notes || '', ghost_total: createGhostTotals ? createGhostTotals.total : 0 });
        // Durable, recoverable linking: never delete a created invoice. If linking fails part-way the
        // invoice stays, the audit event records link_pending, and a retry (same key -> same
        // deterministic invoice number, or the source's estimate_id/repair_order_id) re-finds and re-links it.
        let linkError = null;
        try {
          if (estimate) await base44.entities.Estimate.update(estimate.id, { status: 'invoiced', linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number, ...(createGhostActive && sourceType === 'estimate' ? { ghost_status: 'converted', ghost_converted_to: invoice.id, ghost_converted_type: 'Invoice', ghost_converted_number: invoice.invoice_number } : {}) });
          if (repairOrder) await base44.entities.RepairOrder.update(repairOrder.id, { linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number, ...(createGhostActive && sourceType === 'repair_order' ? { ghost_status: 'converted', ghost_converted_to: invoice.id, ghost_converted_type: 'Invoice', ghost_converted_number: invoice.invoice_number } : {}) });
        } catch (err) { linkError = err; }
        await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'create', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: key, created_at: new Date().toISOString(), actor_email: tenant, metadata: { total: totals.total, link_status: linkError ? 'pending' : 'linked' } });
        if (linkError) throw new Error(`Invoice ${invoice.invoice_number} was saved but linking is incomplete (${linkError.message}). Retry to finish linking; no duplicate will be created.`);
      } else if (!replayed) { replayed = true; await recoverLinks(); }
      });
    } else if (action === 'create' && invoice) {
      // Replay: this source already has a verified invoice. Invoice lines/totals/payments are untouched;
      // only missing links (e.g. empty repair_order_id after an Estimate -> RO -> Cash Out) are filled in.
      replayed = true;
      await recoverLinks();
    } else if (['update', 'finalize', 'sync_source'].includes(action)) {
      if (!invoice) throw new Error('No linked invoice exists');
      // Keep the stored ghost_total in sync when tax_rate/tax_applies_to change.
      // (Display already recalculates live; this keeps the persisted snapshot correct.)
      const upGhostItems = Array.isArray(invoice?.ghost_items) ? invoice.ghost_items : [];
      const upGhostActive = invoice?.ghost_status === 'active' && upGhostItems.length > 0;
      const upGhostTotals = upGhostActive ? calculate(cleanLines(upGhostItems), taxRate, taxTarget, 0, '$', 0) : null;
      const update = { line_items: lines.map((x) => ({ ...x, total: r2(x.quantity * x.unit_price) })), parts_used: lines.filter((x) => x.type !== 'labor').map((x) => ({ name: x.name || x.description || '', part_number: '', quantity: x.quantity, unit_price: x.unit_price, total: r2(x.quantity * x.unit_price) })), labor_total: totals.labor, parts_total: totals.parts, tax_rate: taxRate, tax_applies_to: taxTarget, tax_amount: totals.tax, discount: resolved.discount, discount_type: resolved.discountType, total: totals.total, balance_due: totals.balance, due_date: intent.due_date ?? invoice.due_date, invoice_date: intent.invoice_date ?? invoice.invoice_date, customer_note: intent.customer_note ?? invoice.customer_note, service_reason: intent.service_reason ?? invoice.service_reason, ghost_total: upGhostTotals ? upGhostTotals.total : (invoice?.ghost_total || 0) };
      invoice = await base44.entities.Invoice.update(invoice.id, update);
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: action === 'finalize' ? 'finalize' : 'edit', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: body.idempotency_key || '', created_at: new Date().toISOString(), actor_email: tenant, metadata: { total: totals.total } });
    } else if (action === 'replace_payments') {
      if (!invoice) throw new Error('Invoice is required');
      const history = (intent.payment_history || []).map((p) => ({ date: String(p.date || new Date().toISOString().slice(0, 10)), amount: r2(p.amount), method: String(p.method || 'other'), note: String(p.note || '') }));
      const amountPaid = r2(history.reduce((sum, p) => sum + Math.max(0, p.amount), 0));
      if (amountPaid > (Number(invoice.total) || 0) + 0.01) throw new Error('Payment history exceeds the invoice total');
      const balance = r2(Math.max(0, (Number(invoice.total) || 0) - amountPaid));
      invoice = await base44.entities.Invoice.update(invoice.id, { payment_history: history, amount_paid: amountPaid, balance_due: balance, status: balance === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid', paid_date: balance === 0 ? (invoice.paid_date || new Date().toISOString().slice(0, 10)) : null, payment_method: [...new Set(history.map((p) => p.method).filter(Boolean))].join('+') });
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'edit', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: body.idempotency_key || '', created_at: new Date().toISOString(), actor_email: tenant, metadata: { payment_history_updated: true } });
    } else if (action === 'record_payment') {
      if (!invoice) throw new Error('Save the invoice before recording payment');
      const payKey = String(body.idempotency_key || '');
      if (!payKey) throw new Error('Idempotency key is required');
      // Lease the invoice, re-read it, and treat a payment_key already stored on the invoice as a
      // replay. The key is written in the same update as the payment, so a crash between the
      // payment write and the audit event can never cause a second charge on retry.
      await withLease(base44.asServiceRole.entities, 'Invoice', invoice.id, async () => {
        const current = await getOwned('Invoice', invoice.id, 'Invoice');
        invoice = current;
        if (paymentAlreadyApplied(current, payKey)) return;
        const priorPay = await base44.asServiceRole.entities.FinancialWorkflowEvent.filter({ shop_owner_email: tenant, idempotency_key: payKey, action: 'record_payment', invoice_id: current.id }, '-created_date', 1);
        if (priorPay.length) return;
        const { added, update } = applyPayments(current, intent.payments, new Date().toISOString().slice(0, 10), payKey);
        invoice = await base44.entities.Invoice.update(current.id, update);
        await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'record_payment', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: payKey, created_at: new Date().toISOString(), actor_email: tenant, metadata: { amount: added } });
      });
      await recoverLinks();
    } else if (action === 'send') {
      if (!invoice) throw new Error('Save the invoice before sending');
      if (!customer.email) throw new Error('No email on file');
      await base44.functions.invoke('sendLBCAutoEmail', { type: 'invoice', to: customer.email, customer_name: customer.full_name, record: invoice });
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'send', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, created_at: new Date().toISOString(), actor_email: tenant, metadata: { delivery: 'email' } });
    } else throw new Error('Unsupported financial action');

    if (!replayed && ["create", "update", "finalize", "sync_source"].includes(action) && lines.length) {
      try { await upsertLineItems(base44, tenant, lines); } catch (_) {}
    }
    const refreshed = invoice ? await getOwned('Invoice', invoice.id, 'Invoice') : null;
    return Response.json({ success: true, invoice: refreshed, customer, vehicle, estimate, repair_order: repairOrder, context });
  } catch (error) {
    const message = error?.message || 'Financial action failed';
    const status = error instanceof LeaseBusyError ? 409 : /another shop|not found in this shop|Owner or admin/.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}