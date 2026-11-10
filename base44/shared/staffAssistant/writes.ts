// Write capabilities. prepare() builds a preview (no writes); execute() runs only after the staff
// member confirms a single-use server-bound action, re-verifies ownership and the record version.
// Not offered (by design): payments, refunds, deletes, sending messages, converting documents.
import { ToolError, getOwned, ownedPage, writerFor, todayIn } from './scope.ts';
import { NeedsInput, resolveCustomer, resolveVehicle, resolveByNumber, vLabel } from './resolve.ts';
import { textQuery } from './validate.ts';
import { ESTIMATE_CREATE } from './estimateCreate.ts';

const digits = (p: any) => String(p || '').replace(/\D/g, '');
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const show = (v: any) => (v === undefined || v === null || v === '' ? '—' : String(v));

// Generic field update with before/after preview and optimistic version check.
function makeUpdate(o: any) {
  return {
    name: o.name, module: o.module, kind: 'update', label: o.label, description: o.description, args: { ...o.findArgs, ...o.fields },
    async prepare(ctx: any, a: any) {
      const rec = await o.find(ctx, a);
      const changes: any = {};
      for (const k of Object.keys(o.fields)) if (a[k] !== undefined && a[k] !== rec[k]) changes[k] = a[k];
      if (o.check) o.check(ctx, rec, changes);
      if (!Object.keys(changes).length) throw new NeedsInput([`What should change on ${o.describe(rec)}? Nothing new was given.`]);
      return {
        title: `${o.label}: ${o.describe(rec)}`, params: { changes },
        target: { entity: o.entity, id: rec.id, version: rec.updated_date || null },
        fields: Object.entries(changes).map(([k, v]) => ({ label: o.labels[k] || k, before: show(rec[k]), after: show(v) })),
        impact: o.impact ? o.impact(rec, changes) : [],
      };
    },
    async execute(ctx: any, action: any) {
      const rec = await getOwned(ctx.svc, o.entity, action.target_id, ctx.scope, o.entityLabel);
      if ((rec.updated_date || null) !== action.target_version) throw new ToolError('stale', `${o.describe(rec)} changed since this preview. Ask again for a fresh preview.`, 409);
      await writerFor(ctx, rec)[o.entity].update(rec.id, action.params.changes);
      const fresh = await ctx.svc[o.entity].get(rec.id);
      const ok = Object.entries(action.params.changes).every(([k, v]) => fresh?.[k] === v);
      if (!ok) throw new ToolError('save_unconfirmed', 'The change could not be confirmed. Open the record to check it.', 503);
      return { receipt: { kind: o.entity, id: rec.id, label: o.describe(fresh), open_path: o.path(fresh) }, summary: `Updated ${o.describe(fresh)}.`, refresh: o.refresh };
    },
  };
}

async function findAppointment(ctx: any, a: any) {
  if (a.appointment_id) return getOwned(ctx.svc, 'Appointment', a.appointment_id, ctx.scope, 'Appointment');
  const customer = await resolveCustomer(ctx, a);
  const res = await ownedPage(ctx.svc, 'Appointment', ctx.scope, { customer_id: customer.id, ...(a.on_date ? { date: a.on_date } : { date: { $gte: todayIn(ctx.scope.timezone, ctx.now) } }) }, { sort: 'date', limit: 5 });
  if (res.rows.length === 1) return res.rows[0];
  if (!res.rows.length) throw new NeedsInput([`No upcoming appointment found for ${customer.full_name}.`]);
  throw new NeedsInput([`${customer.full_name} has more than one appointment. Which one?`], res.rows.map((x: any) => ({ label: `${x.date} ${x.time_slot} · ${x.service_type}`, appointment_id: x.id })));
}

const custFind = { customer: { type: 'string', max: 60 }, customer_id: { type: 'id' } };
const apptPath = () => '/Appointments';

export const WRITES: any[] = [
  ESTIMATE_CREATE,
  { name: 'customers.create', module: 'Customers', kind: 'create', label: 'Add Customer', description: 'Add a new customer (name and phone required).',
    args: { full_name: { type: 'string', max: 80, required: true }, phone: { type: 'string', max: 30, required: true }, email: { type: 'string', max: 120 }, address: { type: 'string', max: 160 } },
    async prepare(ctx: any, a: any) {
      if (digits(a.phone).length < 10) throw new NeedsInput(['Need a full phone number (10 digits).']);
      if (a.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) throw new NeedsInput(['That email address does not look valid.']);
      const dup = await ownedPage(ctx.svc, 'Customer', ctx.scope, textQuery(['phone'], digits(a.phone).slice(-4)), { limit: 25 });
      const same = dup.rows.find((c: any) => digits(c.phone).slice(-10) === digits(a.phone).slice(-10));
      if (same) throw new NeedsInput([`${same.full_name} already uses this phone number. Open their profile instead of adding a duplicate.`], [{ label: same.full_name, customer_id: same.id }]);
      const params = { full_name: a.full_name, phone: a.phone, email: a.email || '', address: a.address || '' };
      return { title: `Add Customer ${a.full_name}`, params, target: { entity: 'Customer', id: null, version: null },
        fields: [{ label: 'Name', after: a.full_name }, { label: 'Phone', after: a.phone }, ...(a.email ? [{ label: 'Email', after: a.email }] : []), ...(a.address ? [{ label: 'Address', after: a.address }] : [])],
        impact: ['Adds the customer to Customers. No message is sent.'] };
    },
    async execute(ctx: any, action: any) {
      const c = await ctx.userDb.Customer.create({ ...action.params, shop_owner_email: ctx.scope.tenant, last_visit: ctx.today, total_visits: 0 });
      const fresh = await getOwned(ctx.svc, 'Customer', c.id, ctx.scope, 'Customer');
      return { receipt: { kind: 'Customer', id: fresh.id, label: fresh.full_name, open_path: `/CustomerProfile/${fresh.id}` }, summary: `Added customer ${fresh.full_name}.`, refresh: ['customers'] };
    } },
  { name: 'vehicles.create', module: 'Vehicles', kind: 'create', label: 'Add Vehicle', description: "Add a vehicle to a customer's profile (year, make, model required).",
    args: { ...custFind, year: { type: 'int', min: 1950, max: 2100, required: true }, make: { type: 'string', max: 40, required: true }, model: { type: 'string', max: 40, required: true }, trim: { type: 'string', max: 40 }, vin: { type: 'string', max: 17 }, license_plate: { type: 'string', max: 12 }, mileage: { type: 'int', min: 0, max: 2000000 } },
    async prepare(ctx: any, a: any) {
      const customer = await resolveCustomer(ctx, a);
      const vin = a.vin ? a.vin.toUpperCase() : '';
      if (vin && !VIN.test(vin)) throw new NeedsInput(['That VIN is not 17 valid characters. Check it and try again.']);
      if (vin) { const d = await ownedPage(ctx.svc, 'Vehicle', ctx.scope, { vin }, { limit: 1 }); if (d.rows.length) throw new NeedsInput([`VIN ${vin} is already on file (${vLabel(d.rows[0])}).`]); }
      const params = { customer_id: customer.id, customer_name: customer.full_name, year: a.year, make: a.make, model: a.model, trim: a.trim || '', vin, license_plate: a.license_plate ? a.license_plate.toUpperCase() : '', ...(a.mileage != null ? { mileage: a.mileage } : {}) };
      return { title: `Add Vehicle For ${customer.full_name}`, params, target: { entity: 'Customer', id: customer.id, version: null },
        fields: [{ label: 'Customer', after: customer.full_name }, { label: 'Vehicle', after: vLabel(params) }, ...(vin ? [{ label: 'VIN', after: vin }] : []), ...(params.license_plate ? [{ label: 'Plate', after: params.license_plate }] : []), ...(a.mileage != null ? [{ label: 'Mileage', after: String(a.mileage) }] : [])],
        impact: ['Adds the vehicle to the customer profile.'] };
    },
    async execute(ctx: any, action: any) {
      const customer = await getOwned(ctx.svc, 'Customer', action.params.customer_id, ctx.scope, 'Customer');
      const v = await ctx.userDb.Vehicle.create({ ...action.params, customer_name: customer.full_name, shop_owner_email: ctx.scope.tenant });
      const fresh = await getOwned(ctx.svc, 'Vehicle', v.id, ctx.scope, 'Vehicle');
      return { receipt: { kind: 'Vehicle', id: fresh.id, label: vLabel(fresh), open_path: `/VehicleTimeline/${fresh.id}` }, summary: `Added ${vLabel(fresh)} for ${customer.full_name}.`, refresh: ['vehicles', 'customers'] };
    } },
  { name: 'appointments.create', module: 'Appointments', kind: 'create', label: 'Book Appointment', description: 'Book an appointment for a customer vehicle (date YYYY-MM-DD and time required).',
    args: { ...custFind, vehicle: { type: 'string', max: 60 }, vehicle_id: { type: 'id' }, service_type: { type: 'string', max: 80, required: true }, date: { type: 'date', required: true }, time_slot: { type: 'string', max: 20, required: true }, notes: { type: 'string', max: 300 } },
    async prepare(ctx: any, a: any) {
      if (a.date < todayIn(ctx.scope.timezone, ctx.now)) throw new NeedsInput([`${a.date} is in the past. Which date?`]);
      const customer = await resolveCustomer(ctx, a);
      const vehicle = await resolveVehicle(ctx, customer, a);
      const clash = await ownedPage(ctx.svc, 'Appointment', ctx.scope, { date: a.date, time_slot: a.time_slot, status: { $ne: 'cancelled' } }, { limit: 5 });
      const params = { customer_id: customer.id, customer_name: customer.full_name, vehicle_id: vehicle.id, vehicle_info: vLabel(vehicle), service_type: a.service_type, date: a.date, time_slot: a.time_slot, notes: a.notes || '' };
      return { title: `Book ${a.service_type} For ${customer.full_name}`, params, target: { entity: 'Customer', id: customer.id, version: null },
        fields: [{ label: 'Customer', after: customer.full_name }, { label: 'Vehicle', after: params.vehicle_info }, { label: 'Service', after: a.service_type }, { label: 'When', after: `${a.date} at ${a.time_slot}${ctx.scope.timezoneVerified ? '' : ' (shop timezone not set)'}` }],
        impact: [...(clash.rows.length ? [`Heads up: ${clash.rows.length} other appointment(s) already at this time.`] : []), 'Your daily appointment reminders may notify the customer before the visit.'] };
    },
    async execute(ctx: any, action: any) {
      const customer = await getOwned(ctx.svc, 'Customer', action.params.customer_id, ctx.scope, 'Customer');
      const vehicle = await getOwned(ctx.svc, 'Vehicle', action.params.vehicle_id, ctx.scope, 'Vehicle');
      if (vehicle.customer_id !== customer.id) throw new ToolError('forbidden', 'That vehicle no longer belongs to this customer.', 403);
      const ap = await ctx.userDb.Appointment.create({ ...action.params, status: 'scheduled', source: 'dashboard', shop_email: ctx.scope.tenant });
      const fresh = await getOwned(ctx.svc, 'Appointment', ap.id, ctx.scope, 'Appointment');
      return { receipt: { kind: 'Appointment', id: fresh.id, label: `${fresh.service_type} · ${fresh.date} ${fresh.time_slot}`, open_path: apptPath() }, summary: `Booked ${fresh.service_type} for ${customer.full_name} on ${fresh.date} at ${fresh.time_slot}.`, refresh: ['appointments'] };
    } },
  makeUpdate({ name: 'customers.update', module: 'Customers', label: 'Update Customer', entity: 'Customer', entityLabel: 'Customer', description: 'Change a customer name, phone, email or address.',
    findArgs: custFind, find: resolveCustomer, fields: { full_name: { type: 'string', max: 80 }, phone: { type: 'string', max: 30 }, email: { type: 'string', max: 120 }, address: { type: 'string', max: 160 } },
    labels: { full_name: 'Name', phone: 'Phone', email: 'Email', address: 'Address' }, describe: (c: any) => c.full_name || 'Customer', path: (c: any) => `/CustomerProfile/${c.id}`, refresh: ['customers'],
    check: (_c: any, _r: any, ch: any) => { if (ch.phone && digits(ch.phone).length < 10) throw new NeedsInput(['Need a full phone number (10 digits).']); } }),
  makeUpdate({ name: 'vehicles.update', module: 'Vehicles', label: 'Update Vehicle', entity: 'Vehicle', entityLabel: 'Vehicle', description: 'Change mileage, plate, VIN or color on a customer vehicle.',
    findArgs: { ...custFind, vehicle: { type: 'string', max: 60 }, vehicle_id: { type: 'id' } }, find: async (ctx: any, a: any) => resolveVehicle(ctx, await resolveCustomer(ctx, a), a),
    fields: { mileage: { type: 'int', min: 0, max: 2000000 }, license_plate: { type: 'string', max: 12 }, vin: { type: 'string', max: 17 }, color: { type: 'string', max: 30 } },
    labels: { mileage: 'Mileage', license_plate: 'Plate', vin: 'VIN', color: 'Color' }, describe: vLabel, path: (v: any) => `/VehicleTimeline/${v.id}`, refresh: ['vehicles'],
    check: (_c: any, r: any, ch: any) => { if (ch.vin) { ch.vin = ch.vin.toUpperCase(); if (!VIN.test(ch.vin)) throw new NeedsInput(['That VIN is not 17 valid characters.']); } if (ch.license_plate) ch.license_plate = ch.license_plate.toUpperCase(); },
    impact: (r: any, ch: any) => (ch.mileage != null && r.mileage != null && ch.mileage < r.mileage ? [`New mileage is LOWER than the current ${r.mileage}.`] : []) }),
  makeUpdate({ name: 'appointments.update', module: 'Appointments', label: 'Update Appointment', entity: 'Appointment', entityLabel: 'Appointment', description: 'Reschedule (new_date/new_time), change status, service or notes. Find it by customer (+ on_date) or appointment_id.',
    findArgs: { ...custFind, appointment_id: { type: 'id' }, on_date: { type: 'date' } }, find: findAppointment,
    fields: { date: { type: 'date', desc: 'new date' }, time_slot: { type: 'string', max: 20, desc: 'new time' }, status: { type: 'enum', values: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'] }, service_type: { type: 'string', max: 80 }, notes: { type: 'string', max: 300 } },
    labels: { date: 'Date', time_slot: 'Time', status: 'Status', service_type: 'Service', notes: 'Notes' }, describe: (x: any) => `${x.customer_name || 'Appointment'} · ${x.date} ${x.time_slot}`, path: apptPath, refresh: ['appointments'],
    check: (ctx: any, _r: any, ch: any) => { if (ch.date && ch.date < todayIn(ctx.scope.timezone, ctx.now)) throw new NeedsInput([`${ch.date} is in the past.`]); } }),
  makeUpdate({ name: 'repair_orders.update_status', module: 'Repair Orders', label: 'Update Repair Order Status', entity: 'RepairOrder', entityLabel: 'Repair Order', description: 'Move a repair order to a new status, by order number.',
    findArgs: { number: { type: 'string', max: 24 }, id: { type: 'id' } }, find: (ctx: any, a: any) => resolveByNumber(ctx, 'RepairOrder', 'order_number', a, 'Repair Order'),
    fields: { status: { type: 'enum', values: ['waiting', 'in_progress', 'waiting_for_parts', 'completed', 'delivered'], required: true } },
    labels: { status: 'Status' }, describe: (o: any) => `${o.order_number || 'Repair Order'} (${o.vehicle_info || o.customer_name || ''})`, path: (o: any) => `/RepairOrderDetail/${o.id}`, refresh: ['repairOrders'],
    impact: (_r: any, ch: any) => (['completed', 'waiting_for_parts'].includes(ch.status) ? ['Your Repair Status workflow may text the customer about this status.'] : []) }),
  makeUpdate({ name: 'parts.update_stock', module: 'Parts', label: 'Update Part Stock', entity: 'Part', entityLabel: 'Part', description: 'Set the on-hand quantity of an inventory part (find by part name or number).',
    findArgs: { part: { type: 'string', max: 60, required: true } },
    find: async (ctx: any, a: any) => {
      const res = await ownedPage(ctx.svc, 'Part', ctx.scope, textQuery(['name', 'part_number'], a.part), { limit: 5 });
      if (res.rows.length === 1) return res.rows[0];
      throw new NeedsInput([res.rows.length ? `More than one part matches "${a.part}". Which one?` : `No part matching "${a.part}" in inventory.`], res.rows.map((p: any) => ({ label: `${p.name}${p.part_number ? ` (${p.part_number})` : ''}` })));
    },
    fields: { quantity: { type: 'int', min: 0, max: 100000, required: true } }, labels: { quantity: 'On Hand' }, describe: (p: any) => p.name || 'Part', path: () => '/Parts', refresh: ['parts'] }),
];