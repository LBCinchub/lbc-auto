import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { upsertLineItems } from '../../shared/lineItemLibrary.ts';

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
const calculate = (lines, taxRate, taxAppliesTo, discount, discountType, paid = 0) => {
  const labor = r2(lines.filter((x) => x.type === 'labor' && x.quantity > 0).reduce((sum, x) => sum + x.quantity * x.unit_price, 0));
  const parts = r2(lines.filter((x) => x.type !== 'labor' && x.quantity > 0).reduce((sum, x) => sum + x.quantity * x.unit_price, 0));
  const subtotal = r2(labor + parts);
  const discountAmount = normalizeDiscount(discountType) === '%' ? r2(subtotal * Math.max(0, Number(discount) || 0) / 100) : r2(Math.max(0, Number(discount) || 0));
  // Normalize tax target — line `type` is "part" (singular) but the stored
  // setting can be "parts" (plural). Without this, "parts" never matched any
  // line and tax computed to $0. Default to "both" when missing/invalid.
  const appliesTo = String(taxAppliesTo || 'both').toLowerCase();
  const lineIsTaxable = (x) => {
    if (appliesTo === 'none') return false;
    if (appliesTo === 'both' || appliesTo === 'all') return true;
    if (appliesTo === 'labor') return x.type === 'labor';
    if (appliesTo === 'parts' || appliesTo === 'part') return x.type !== 'labor';
    return true;
  };
  const taxable = lines.filter((x) => x.quantity > 0 && x.taxable !== false && lineIsTaxable(x)).reduce((sum, x) => sum + x.quantity * x.unit_price, 0);
  const taxableBase = (appliesTo === 'both' || appliesTo === 'all') ? Math.max(0, taxable - discountAmount) : taxable;
  const tax = r2(taxableBase * Math.max(0, Number(taxRate) || 0) / 100);
  const total = r2(Math.max(0, subtotal - discountAmount + tax));
  return { labor, parts, subtotal, discountAmount, tax, total, balance: r2(Math.max(0, total - paid)) };
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
      if (invoice && !owns(invoice)) throw new Error('Linked invoice belongs to another shop');
    }
    if (!invoice && body.invoice_id) invoice = await getOwned('Invoice', body.invoice_id, 'Invoice');

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
    const repairOrder = invoice?.repair_order_id ? await getOwned('RepairOrder', invoice.repair_order_id, 'Repair Order') : sourceType === 'repair_order' ? source : null;
    const estimate = invoice?.estimate_id ? await getOwned('Estimate', invoice.estimate_id, 'Estimate') : sourceType === 'estimate' ? source : repairOrder?.estimate_id ? await getOwned('Estimate', repairOrder.estimate_id, 'Estimate') : null;

    const initialLines = invoice ? cleanLines(invoice.line_items || [], 'Invoice') : sourceLines(sourceType, source);
    const defaultTaxRate = invoice?.tax_rate ?? source?.tax_rate ?? user.tax_rate ?? 0;
    const defaultTaxTarget = invoice?.tax_applies_to || source?.tax_applies_to || user.tax_applies_to || 'both';
    const context = { source_type: sourceType, source_id: sourceId, source_number: invoice?.invoice_number || source?.estimate_number || source?.order_number || '', source_status: invoice?.status || source?.status || 'draft' };
    if (action === 'load') return Response.json({ invoice, customer, vehicle, estimate, repair_order: repairOrder, context, shop: { business_name: user.business_name || 'LBC Auto', logo_url: user.logo_url || '', phone: user.phone || '', address: user.address || '' }, draft: { line_items: initialLines, tax_rate: defaultTaxRate, tax_applies_to: defaultTaxTarget, discount: invoice?.discount ?? source?.discount ?? 0, discount_type: invoice?.discount_type || source?.discount_type || '$', due_date: invoice?.due_date || '', invoice_date: invoice?.invoice_date || new Date().toISOString().slice(0, 10), customer_note: invoice?.customer_note || source?.notes || '', service_reason: invoice?.service_reason || source?.service_reason || source?.description || '' } });

    const intent = body.intent || {};
    let lines = cleanLines(intent.line_items || initialLines);
    const paid = Number(invoice?.amount_paid) || 0;
    const taxRate = Number(intent.tax_rate ?? defaultTaxRate);
    if (taxRate < 0 || taxRate > 100) throw new Error('Tax rate is invalid');
    const taxTarget = ['both', 'labor', 'parts', 'none'].includes(intent.tax_applies_to) ? intent.tax_applies_to : defaultTaxTarget;
    const totals = calculate(lines, taxRate, taxTarget, intent.discount ?? invoice?.discount ?? 0, intent.discount_type || invoice?.discount_type || '$', paid);

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
      const prior = await base44.asServiceRole.entities.FinancialWorkflowEvent.filter({ shop_owner_email: tenant, idempotency_key: key, action: 'create' }, '-created_date', 1);
      if (prior[0]?.invoice_id) invoice = await getOwned('Invoice', prior[0].invoice_id, 'Invoice');
      if (!invoice) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${tenant}:${key}`));
        const suffix = Array.from(new Uint8Array(digest)).slice(0, 5).map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
        const invoiceNumber = `INV-${suffix}`;
        const existing = await base44.asServiceRole.entities.Invoice.filter({ invoice_number: invoiceNumber }, '-created_date', 1);
        invoice = existing.find(owns) || null;
        if (!invoice) invoice = await base44.entities.Invoice.create({ invoice_number: invoiceNumber, customer_id: customer.id, customer_name: customer.full_name, vehicle_id: vehicle.id, vehicle_info: [vehicle.year, vehicle.make, vehicle.model, vehicle.engine_liters, vehicle.trim].filter(Boolean).join(' '), estimate_id: estimate?.id || '', repair_order_id: repairOrder?.id || '', status: 'unpaid', amount_paid: 0, payment_history: [], line_items: lines.map((x) => ({ ...x, total: r2(x.quantity * x.unit_price) })), parts_used: lines.filter((x) => x.type !== 'labor').map((x) => ({ name: x.name || x.description || '', part_number: '', quantity: x.quantity, unit_price: x.unit_price, total: r2(x.quantity * x.unit_price) })), labor_total: totals.labor, parts_total: totals.parts, tax_rate: taxRate, tax_applies_to: taxTarget, tax_amount: totals.tax, discount: Number(intent.discount) || 0, discount_type: normalizeDiscount(intent.discount_type), total: totals.total, balance_due: totals.balance, invoice_date: intent.invoice_date || new Date().toISOString().slice(0, 10), due_date: intent.due_date || '', customer_note: intent.customer_note || '', service_reason: intent.service_reason || '' });
        try {
          if (estimate) await base44.entities.Estimate.update(estimate.id, { status: 'invoiced', linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number });
          if (repairOrder) await base44.entities.RepairOrder.update(repairOrder.id, { linked_invoice_id: invoice.id, linked_invoice_number: invoice.invoice_number });
        } catch (linkError) {
          await base44.entities.Invoice.delete(invoice.id).catch(() => null);
          throw new Error(`Invoice link failed: ${linkError.message}`);
        }
        await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'create', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: key, created_at: new Date().toISOString(), actor_email: tenant, metadata: { total: totals.total } });
      }
    } else if (['update', 'finalize', 'sync_source'].includes(action)) {
      if (!invoice) throw new Error('No linked invoice exists');
      const update = { line_items: lines.map((x) => ({ ...x, total: r2(x.quantity * x.unit_price) })), parts_used: lines.filter((x) => x.type !== 'labor').map((x) => ({ name: x.name || x.description || '', part_number: '', quantity: x.quantity, unit_price: x.unit_price, total: r2(x.quantity * x.unit_price) })), labor_total: totals.labor, parts_total: totals.parts, tax_rate: taxRate, tax_applies_to: taxTarget, tax_amount: totals.tax, discount: Number(intent.discount ?? invoice.discount) || 0, discount_type: normalizeDiscount(intent.discount_type || invoice.discount_type), total: totals.total, balance_due: totals.balance, due_date: intent.due_date ?? invoice.due_date, invoice_date: intent.invoice_date ?? invoice.invoice_date, customer_note: intent.customer_note ?? invoice.customer_note, service_reason: intent.service_reason ?? invoice.service_reason };
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
      const additions = (intent.payments || []).map((p) => ({ date: new Date().toISOString().slice(0, 10), amount: r2(p.amount), method: String(p.method || 'other'), note: String(p.note || '') }));
      const added = r2(additions.reduce((sum, p) => sum + p.amount, 0));
      if (added <= 0 || added > (Number(invoice.balance_due ?? invoice.total) || 0) + 0.01) throw new Error('Payment amount exceeds the balance or is invalid');
      const amountPaid = r2((Number(invoice.amount_paid) || 0) + added);
      const balance = r2(Math.max(0, (Number(invoice.total) || 0) - amountPaid));
      invoice = await base44.entities.Invoice.update(invoice.id, { amount_paid: amountPaid, balance_due: balance, status: balance === 0 ? 'paid' : 'partial', paid_date: balance === 0 ? new Date().toISOString().slice(0, 10) : invoice.paid_date, payment_history: [...(invoice.payment_history || []), ...additions], payment_method: [...new Set([...(invoice.payment_history || []).map((p) => p.method), ...additions.map((p) => p.method)].filter(Boolean))].join('+') });
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'record_payment', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, idempotency_key: body.idempotency_key || '', created_at: new Date().toISOString(), actor_email: tenant, metadata: { amount: added } });
    } else if (action === 'send') {
      if (!invoice) throw new Error('Save the invoice before sending');
      if (!customer.email) throw new Error('No email on file');
      await base44.functions.invoke('sendLBCAutoEmail', { type: 'invoice', to: customer.email, customer_name: customer.full_name, record: invoice });
      await base44.asServiceRole.entities.FinancialWorkflowEvent.create({ shop_owner_email: tenant, action: 'send', invoice_id: invoice.id, source_type: sourceType, source_id: sourceId, created_at: new Date().toISOString(), actor_email: tenant, metadata: { delivery: 'email' } });
    } else throw new Error('Unsupported financial action');

    if (["create", "update", "finalize", "sync_source"].includes(action) && lines.length) {
      try { await upsertLineItems(base44, tenant, lines); } catch (_) {}
    }
    const refreshed = invoice ? await getOwned('Invoice', invoice.id, 'Invoice') : null;
    return Response.json({ success: true, invoice: refreshed, customer, vehicle, estimate, repair_order: repairOrder, context });
  } catch (error) {
    const message = error?.message || 'Financial action failed';
    const status = /another shop|not found in this shop|Owner or admin/.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}