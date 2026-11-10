// Safe minimum fields returned to the model and the chat UI. Never: notes logs, leases, PINs, tokens,
// signatures, photos, payment card data, internal ghost/lease fields.
const r2 = (v: any) => Math.round((Number(v) || 0) * 100) / 100;
const pick = (r: any, keys: string[]) => Object.fromEntries(keys.filter((k) => r?.[k] !== undefined && r?.[k] !== null && r?.[k] !== '').map((k) => [k, r[k]]));

export const pCustomer = (c: any) => ({ ...pick(c, ['id', 'full_name', 'phone', 'email', 'last_visit', 'last_vehicle_info', 'total_visits']), open_path: `/CustomerProfile/${c.id}` });
export const pVehicle = (v: any) => ({ ...pick(v, ['id', 'customer_id', 'customer_name', 'year', 'make', 'model', 'trim', 'engine_liters', 'vin', 'license_plate', 'mileage', 'last_service_date']), open_path: `/VehicleTimeline/${v.id}` });
export const pAppointment = (a: any) => pick(a, ['id', 'date', 'time_slot', 'customer_name', 'vehicle_info', 'service_type', 'status', 'mechanic_name', 'source']);
export const pEstimate = (e: any) => ({ ...pick(e, ['id', 'estimate_number', 'customer_name', 'vehicle_info', 'status', 'auth_status', 'estimate_date', 'valid_until', 'linked_repair_order_number', 'linked_invoice_number']), grand_total: r2(e.grand_total), open_path: `/EstimateDetail/${e.id}` });
export const pRepairOrder = (o: any) => ({ ...pick(o, ['id', 'order_number', 'customer_name', 'vehicle_info', 'status', 'mechanic_name', 'estimated_completion', 'linked_invoice_number']), total_cost: r2(o.total_cost), open_path: `/RepairOrderDetail/${o.id}` });
export const balanceOf = (i: any) => r2(i.balance_due != null ? i.balance_due : Math.max(0, (Number(i.total) || 0) - (Number(i.amount_paid) || 0)));
export const pInvoice = (i: any) => ({ ...pick(i, ['id', 'invoice_number', 'customer_name', 'vehicle_info', 'status', 'invoice_date', 'due_date']), total: r2(i.total), amount_paid: r2(i.amount_paid), balance_due: balanceOf(i), open_path: `/InvoiceDetail/${i.id}` });
export const pPart = (p: any) => pick(p, ['id', 'name', 'part_number', 'category', 'quantity', 'min_stock', 'sale_price', 'supplier']);
export const pMechanic = (m: any) => pick(m, ['id', 'name', 'role', 'specialty', 'status', 'pay_type', 'hourly_rate', 'daily_rate']);

const lines = (xs: any[], f: (x: any) => any) => (xs || []).slice(0, 30).map(f);
export const estimateLines = (e: any) => [
  ...lines(e.labor_items, (l) => ({ type: 'labor', name: l.description, hours: l.hours, rate: l.rate, total: r2(l.total) })),
  ...lines(e.parts_items, (p) => ({ type: 'part', name: p.name, quantity: p.quantity, unit_price: p.unit_price, total: r2(p.total) })),
];
export const roLines = (o: any) => [
  ...lines(o.labor_items, (l) => ({ type: 'labor', name: l.description, hours: l.hours, rate: l.rate, total: r2(l.total) })),
  ...lines(o.parts_used, (p) => ({ type: 'part', name: p.name, quantity: p.quantity, unit_price: p.unit_price, total: r2(p.total) })),
];
export const invoiceLines = (i: any) => lines(i.line_items, (l) => ({ type: l.type, name: l.name || l.description, quantity: l.quantity, unit_price: l.unit_price, total: r2(l.total) }));
export const paymentHistory = (i: any) => (i.payment_history || []).slice(0, 20).map((p: any) => ({ date: p.date, amount: r2(p.amount), method: p.method }));