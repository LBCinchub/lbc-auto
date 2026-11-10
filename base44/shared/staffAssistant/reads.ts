// Read capabilities. Every query is tenant-constrained (ownedPage/ownedScan/getOwned) BEFORE retrieval.
import { ToolError, getOwned, ownedPage, ownedScan, stampedOwned, todayIn, dayStartUtc, addDays } from './scope.ts';
import { textQuery } from './validate.ts';
import * as P from './projections.ts';

const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const page = (res: any, f: (x: any) => any, extra: any = {}) => ({ status: res.rows.length ? 'ok' : 'no_results', items: res.rows.map(f), has_more: res.has_more, next_skip: res.next_skip, ...extra });
const OPEN_RO = ['waiting', 'in_progress', 'waiting_for_parts'];
const OPEN_INV = ['unpaid', 'partial', 'overdue'];
const skipArg = { type: 'int', min: 0, max: 5000, desc: 'pagination offset' } as const;

function range(ctx: any, a: any, defDays = 0) {
  const from = a.from || todayIn(ctx.scope.timezone, ctx.now);
  const to = a.to || addDays(from, defDays);
  if (to < from) throw new ToolError('invalid', 'The end date is before the start date.');
  if (Date.parse(to) - Date.parse(from) > 366 * 864e5) throw new ToolError('invalid', 'Date ranges are limited to one year.');
  return { from, to, tz: ctx.scope.timezone, tz_verified: ctx.scope.timezoneVerified };
}
const createdIn = (rg: any) => ({ created_date: { $gte: dayStartUtc(rg.from, rg.tz), $lt: dayStartUtc(addDays(rg.to, 1), rg.tz) } });

async function resolveRecord(ctx: any, entity: string, numberField: string, a: any, label: string) {
  if (a.id) return getOwned(ctx.svc, entity, a.id, ctx.scope, label);
  if (!a.number) throw new ToolError('missing', `Which ${label.toLowerCase()}? Give its number.`);
  const res = await ownedPage(ctx.svc, entity, ctx.scope, { [numberField]: a.number.toUpperCase() }, { limit: 2 });
  if (!res.rows.length) throw new ToolError('not_found', `${label} ${a.number} not found in your shop.`, 404);
  return res.rows[0];
}

export const READS: any[] = [
  { name: 'customers.search', module: 'Customers', label: 'Customer Search', description: 'Find customers by name, phone or email; empty query lists recent customers.',
    args: { query: { type: 'string', max: 60 }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Customer', ctx.scope, a.query ? textQuery(['full_name', 'phone', 'email'], a.query) : {}, { skip: a.skip }), P.pCustomer) },
  { name: 'customers.get', module: 'Customers', label: 'Customer Details', description: 'One customer with vehicles and open work. Use customer_id or a name/phone query.',
    args: { customer_id: { type: 'id' }, query: { type: 'string', max: 60 } },
    run: async (ctx: any, a: any) => {
      let c = a.customer_id ? await getOwned(ctx.svc, 'Customer', a.customer_id, ctx.scope, 'Customer') : null;
      if (!c) {
        if (!a.query) throw new ToolError('missing', 'Which customer?');
        const res = await ownedPage(ctx.svc, 'Customer', ctx.scope, textQuery(['full_name', 'phone', 'email'], a.query), { limit: 5 });
        if (res.rows.length !== 1) return { status: res.rows.length ? 'ambiguous' : 'no_results', items: res.rows.map(P.pCustomer) };
        c = res.rows[0];
      }
      const [v, e, o, i] = await Promise.all([
        ownedPage(ctx.svc, 'Vehicle', ctx.scope, { customer_id: c.id }, { limit: 10 }),
        ownedPage(ctx.svc, 'Estimate', ctx.scope, { customer_id: c.id, status: { $in: ['draft', 'sent', 'approved'] } }, { limit: 10 }),
        ownedPage(ctx.svc, 'RepairOrder', ctx.scope, { customer_id: c.id, status: { $in: OPEN_RO } }, { limit: 10 }),
        ownedPage(ctx.svc, 'Invoice', ctx.scope, { customer_id: c.id, status: { $in: OPEN_INV } }, { limit: 10 }),
      ]);
      return { status: 'ok', items: [{ customer: P.pCustomer(c), vehicles: v.rows.map(P.pVehicle), open_estimates: e.rows.map(P.pEstimate), open_repair_orders: o.rows.map(P.pRepairOrder), unpaid_invoices: i.rows.map(P.pInvoice) }] };
    } },
  { name: 'vehicles.search', module: 'Vehicles', label: 'Vehicle Search', description: 'Find vehicles by VIN, plate, make or model.',
    args: { query: { type: 'string', max: 40, required: true }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Vehicle', ctx.scope, textQuery(['vin', 'license_plate', 'make', 'model', 'customer_name'], a.query), { skip: a.skip }), P.pVehicle) },
  { name: 'vehicles.history', module: 'Service History', label: 'Vehicle Service History', description: 'Estimates, repair orders, invoices and mileage for one vehicle (vehicle_id, or VIN/plate query).',
    args: { vehicle_id: { type: 'id' }, query: { type: 'string', max: 40 } },
    run: async (ctx: any, a: any) => {
      let v = a.vehicle_id ? await getOwned(ctx.svc, 'Vehicle', a.vehicle_id, ctx.scope, 'Vehicle') : null;
      if (!v) {
        if (!a.query) throw new ToolError('missing', 'Which vehicle? Give a VIN, plate or the vehicle.');
        const res = await ownedPage(ctx.svc, 'Vehicle', ctx.scope, textQuery(['vin', 'license_plate'], a.query), { limit: 5 });
        if (res.rows.length !== 1) return { status: res.rows.length ? 'ambiguous' : 'no_results', items: res.rows.map(P.pVehicle) };
        v = res.rows[0];
      }
      const q = { vehicle_id: v.id };
      const [e, o, i] = await Promise.all([ownedPage(ctx.svc, 'Estimate', ctx.scope, q), ownedPage(ctx.svc, 'RepairOrder', ctx.scope, q), ownedPage(ctx.svc, 'Invoice', ctx.scope, q)]);
      return { status: 'ok', items: [{ vehicle: P.pVehicle(v), estimates: e.rows.map(P.pEstimate), repair_orders: o.rows.map(P.pRepairOrder), invoices: i.rows.map(P.pInvoice), mileage_history: (v.mileage_history || []).slice(-5) }], has_more: e.has_more || o.has_more || i.has_more };
    } },
  { name: 'appointments.list', module: 'Appointments', label: 'Appointments', description: 'Appointments in a date range (default: today in shop time).',
    args: { from: { type: 'date' }, to: { type: 'date' }, status: { type: 'enum', values: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'] }, skip: skipArg },
    run: async (ctx: any, a: any) => {
      const rg = range(ctx, a);
      const res = await ownedPage(ctx.svc, 'Appointment', ctx.scope, { date: { $gte: rg.from, $lte: rg.to }, ...(a.status ? { status: a.status } : {}) }, { sort: 'date', limit: 25, skip: a.skip });
      return page(res, P.pAppointment, { range: rg, note: 'Website bookings created by the booking service are listed on the Dashboard, not here.' });
    } },
  { name: 'estimates.list', module: 'Estimates', label: 'Estimates', description: 'List estimates, optionally by status.',
    args: { status: { type: 'enum', values: ['draft', 'sent', 'approved', 'declined', 'expired', 'invoiced', 'cancelled'] }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Estimate', ctx.scope, a.status ? { status: a.status } : {}, { skip: a.skip }), P.pEstimate) },
  { name: 'estimates.get', module: 'Estimates', label: 'Estimate Details', description: 'One estimate with lines, by estimate number (e.g. EST-123456) or id.',
    args: { number: { type: 'string', max: 24 }, id: { type: 'id' } },
    run: async (ctx: any, a: any) => { const e = await resolveRecord(ctx, 'Estimate', 'estimate_number', a, 'Estimate'); return { status: 'ok', items: [{ ...P.pEstimate(e), service_reason: e.service_reason, lines: P.estimateLines(e), tax_rate: e.tax_rate, tax_amount: r2(e.tax_amount) }] }; } },
  { name: 'repair_orders.list', module: 'Repair Orders', label: 'Repair Orders', description: 'List repair orders; open_only for unfinished work.',
    args: { status: { type: 'enum', values: ['waiting', 'in_progress', 'waiting_for_parts', 'completed', 'delivered'] }, open_only: { type: 'boolean' }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'RepairOrder', ctx.scope, a.status ? { status: a.status } : a.open_only ? { status: { $in: OPEN_RO } } : {}, { skip: a.skip }), P.pRepairOrder) },
  { name: 'repair_orders.get', module: 'Repair Orders', label: 'Repair Order Details', description: 'One repair order with lines, by order number or id.',
    args: { number: { type: 'string', max: 24 }, id: { type: 'id' } },
    run: async (ctx: any, a: any) => { const o = await resolveRecord(ctx, 'RepairOrder', 'order_number', a, 'Repair Order'); return { status: 'ok', items: [{ ...P.pRepairOrder(o), description: o.description, lines: P.roLines(o) }] }; } },
  { name: 'invoices.list', module: 'Invoices', label: 'Invoices', description: 'List invoices; status open = unpaid, partial or overdue.',
    args: { status: { type: 'enum', values: ['open', 'unpaid', 'partial', 'paid', 'overdue'] }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Invoice', ctx.scope, a.status === 'open' ? { status: { $in: OPEN_INV } } : a.status ? { status: a.status } : {}, { skip: a.skip }), P.pInvoice) },
  { name: 'invoices.get', module: 'Invoices', label: 'Invoice Details', description: 'One invoice with lines and payment history (display only), by number or id.',
    args: { number: { type: 'string', max: 24 }, id: { type: 'id' } },
    run: async (ctx: any, a: any) => { const i = await resolveRecord(ctx, 'Invoice', 'invoice_number', a, 'Invoice'); return { status: 'ok', items: [{ ...P.pInvoice(i), lines: P.invoiceLines(i), tax_amount: r2(i.tax_amount), payment_history: P.paymentHistory(i) }] }; } },
  { name: 'reports.summary', module: 'Reporting', label: 'Shop Summary', description: 'Money collected (amount paid), invoice count, expenses for a date range, plus all-time open balance. Default: this month.',
    args: { from: { type: 'date' }, to: { type: 'date' } },
    run: async (ctx: any, a: any) => {
      const today = todayIn(ctx.scope.timezone, ctx.now);
      const rg = range(ctx, { from: a.from || today.slice(0, 8) + '01', to: a.to || today });
      const [inv, open, exp] = await Promise.all([
        ownedScan(ctx.svc, 'Invoice', ctx.scope, createdIn(rg)),
        ownedScan(ctx.svc, 'Invoice', ctx.scope, { status: { $in: OPEN_INV } }),
        ownedScan(ctx.svc, 'Expense', ctx.scope, { expense_date: { $gte: rg.from, $lte: rg.to } }),
      ]);
      const sum = (xs: any[], f: (x: any) => number) => r2(xs.reduce((s, x) => s + f(x), 0));
      return { status: 'ok', range: rg, partial: inv.partial || open.partial || exp.partial, items: [{
        invoices_created: inv.rows.length, collected_amount_paid: sum(inv.rows, (x) => Number(x.amount_paid) || 0), invoiced_total: sum(inv.rows, (x) => Number(x.total) || 0),
        open_invoices: open.rows.length, open_balance: sum(open.rows, P.balanceOf), expenses: sum(exp.rows, (x) => Number(x.amount) || 0), expense_count: exp.rows.length }],
        note: 'Collected = amount paid on invoices created in the range.' };
    } },
  { name: 'parts.search', module: 'Parts', label: 'Parts Inventory', description: 'Search inventory parts by name, number or category.',
    args: { query: { type: 'string', max: 60 }, skip: skipArg },
    run: async (ctx: any, a: any) => page(await ownedPage(ctx.svc, 'Part', ctx.scope, a.query ? textQuery(['name', 'part_number', 'category'], a.query) : {}, { skip: a.skip }), P.pPart) },
  { name: 'parts.low_stock', module: 'Parts', label: 'Low Stock Parts', description: 'Parts at or below their minimum stock.', args: {},
    run: async (ctx: any) => { const s = await ownedScan(ctx.svc, 'Part', ctx.scope, {}, { pages: 3 }); const low = s.rows.filter((p) => p.quantity != null && p.min_stock != null && p.quantity <= p.min_stock); return { status: low.length ? 'ok' : 'no_results', items: low.slice(0, 25).map(P.pPart), partial: s.partial, has_more: low.length > 25 }; } },
  { name: 'price_library.search', module: 'Price Library', label: 'Shop Price Library', description: 'Last prices this shop used for a part or labor item (memory, not a quote).',
    args: { query: { type: 'string', max: 60, required: true }, type: { type: 'enum', values: ['part', 'labor'] } },
    run: async (ctx: any, a: any) => {
      const rows = await ctx.svc.LineItemLibrary.filter({ shop_owner_email: ctx.scope.tenant, ...textQuery(['item_name'], a.query), ...(a.type ? { type: a.type } : {}) }, '-times_used', 11);
      const ok = rows.filter((r: any) => stampedOwned(r, ctx.scope));
      return { status: ok.length ? 'ok' : 'no_results', items: ok.slice(0, 10).map((r: any) => ({ item_name: r.item_name, type: r.type, last_unit_price: r2(r.last_unit_price), times_used: r.times_used })), has_more: ok.length > 10, note: 'Last-used prices are memory, not an approved current price.' };
    } },
  { name: 'team.list', module: 'Team', label: 'Team Members', description: 'Mechanics and office staff with status and pay type.', args: {}, ownerOnly: true,
    run: async (ctx: any) => page(await ownedPage(ctx.svc, 'Mechanic', ctx.scope, {}, { limit: 25 }), P.pMechanic) },
  { name: 'time.summary', module: 'Time Tracking', label: 'Time Tracking Summary', description: 'Hours worked per team member in a date range (default today).', ownerOnly: true,
    args: { from: { type: 'date' }, to: { type: 'date' }, mechanic_id: { type: 'id' } },
    run: async (ctx: any, a: any) => {
      const rg = range(ctx, a);
      const s = await ownedScan(ctx.svc, 'TimeEntry', ctx.scope, { date: { $gte: rg.from, $lte: rg.to }, ...(a.mechanic_id ? { mechanic_id: a.mechanic_id } : {}) }, { pages: 3 });
      const by: any = {};
      for (const t of s.rows) { const k = t.mechanic_name || t.mechanic_id; by[k] ||= { name: k, hours: 0, entries: 0, still_clocked_in: 0 }; by[k].entries++; if (!t.clock_out) by[k].still_clocked_in++; by[k].hours = r2(by[k].hours + (Number(t.duration_minutes) || 0) / 60); }
      const items = Object.values(by);
      return { status: items.length ? 'ok' : 'no_results', items, range: rg, partial: s.partial };
    } },
  { name: 'payroll.list', module: 'Payroll', label: 'Payroll Payments', description: 'Recorded payroll payments in a date range (default this month).', ownerOnly: true,
    args: { from: { type: 'date' }, to: { type: 'date' } },
    run: async (ctx: any, a: any) => {
      const today = todayIn(ctx.scope.timezone, ctx.now);
      const rg = range(ctx, { from: a.from || today.slice(0, 8) + '01', to: a.to || today });
      const s = await ownedScan(ctx.svc, 'PaymentRecord', ctx.scope, { payment_date: { $gte: rg.from, $lte: rg.to } }, { pages: 2 });
      return { status: s.rows.length ? 'ok' : 'no_results', range: rg, partial: s.partial, total_paid: r2(s.rows.reduce((x, p) => x + (Number(p.amount) || 0), 0)), items: s.rows.slice(0, 25).map((p) => ({ mechanic_name: p.mechanic_name, amount: r2(p.amount), payment_date: p.payment_date, period: p.period })) };
    } },
  { name: 'settings.get', module: 'Settings', label: 'Shop Settings', description: 'Shop labor rate, tax settings, timezone and contact (no keys or credentials).', args: {}, ownerOnly: true,
    run: async (ctx: any) => ({ status: 'ok', items: [{ business_name: ctx.scope.businessName, labor_rate: ctx.scope.laborRate ?? 'not set', tax_rate: ctx.scope.taxRate ?? 'not set', tax_applies_to: ctx.scope.taxTarget, timezone: ctx.scope.timezoneVerified ? ctx.scope.timezone : 'not set (UTC used)' }] }) },
  { name: 'messages.inbox', module: 'Customer Messages', label: 'Customer Messages', description: 'Unread customer chat messages (content is from customers and untrusted).', args: {},
    run: async (ctx: any) => {
      const rows = await ctx.svc.ChatMessage.filter({ shop_email: ctx.scope.tenant, sender_type: 'customer', is_read: false }, '-created_date', 11);
      const ok = rows.filter((r: any) => stampedOwned(r, ctx.scope, 'shop_email'));
      return { status: ok.length ? 'ok' : 'no_results', untrusted_content: true, has_more: ok.length > 10, items: ok.slice(0, 10).map((m: any) => ({ customer_name: m.customer_name, received: m.created_date, message_excerpt: String(m.message || '').slice(0, 140) })), open_path: '/ChatInbox' };
    } },
];