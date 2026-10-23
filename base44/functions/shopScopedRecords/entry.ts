import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { SCOPED_ENTITIES, project, stampedForTenant, customerAllowed, vehicleAllowed, appointmentAllowed, estimateAllowed } from '../../shared/shopProvenance.ts';

// Read-only, tenant-verified view of SERVICE-CREATED records (e.g. website bookings) that creator-only
// RLS hides from the shop owner. Tenant comes only from the authenticated session; any caller-supplied
// shop identity that differs is rejected. Never writes.
const lower = (v) => String(v || '').trim().toLowerCase();

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const tenant = lower(user.email);
    const body = await req.json().catch(() => ({}));
    for (const k of ['shop_email', 'shop_owner_email', 'tenant']) {
      if (body[k] !== undefined && lower(body[k]) !== tenant) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const entity = String(body.entity || '');
    if (!SCOPED_ENTITIES.includes(entity)) return Response.json({ error: 'Unsupported entity' }, { status: 400 });
    const limit = Math.min(Math.max(Number(body.limit) || 100, 1), 200);
    const skip = Math.max(Number(body.skip) || 0, 0);
    const sr = base44.asServiceRole.entities;
    const byIds = async (name, ids) => {
      const list = [...new Set(ids.filter(Boolean))];
      if (!list.length) return new Map();
      const rows = await sr[name].filter({ id: { $in: list } }, '-created_date', list.length);
      return new Map(rows.map((r) => [r.id, r]));
    };

    let page = [];
    let items = [];
    if (entity === 'Customer') {
      page = await sr.Customer.filter({ shop_owner_email: tenant }, '-created_date', limit, skip);
      items = page.filter((c) => stampedForTenant(c, tenant));
    } else if (entity === 'Vehicle') {
      const query = body.customer_id ? { customer_id: String(body.customer_id) } : { shop_owner_email: tenant };
      page = await sr.Vehicle.filter(query, '-created_date', limit, skip);
      const customers = await byIds('Customer', page.map((v) => v.customer_id));
      items = page.filter((v) => vehicleAllowed(v, customers.get(v.customer_id), tenant, user.id));
    } else if (entity === 'Appointment') {
      page = await sr.Appointment.filter({ shop_email: tenant }, '-date', limit, skip);
      const [customers, vehicles] = await Promise.all([byIds('Customer', page.map((a) => a.customer_id)), byIds('Vehicle', page.map((a) => a.vehicle_id))]);
      items = page.filter((a) => appointmentAllowed(a, customers.get(a.customer_id), vehicles.get(a.vehicle_id), tenant, user.id));
    } else {
      // Estimates: web-booking estimates carry no tenant stamp historically, so they are reached only
      // through a tenant-allowed customer (paged), plus any prospectively stamped estimates.
      page = await sr.Customer.filter({ shop_owner_email: tenant }, '-created_date', limit, skip);
      const allowedIds = page.filter((c) => customerAllowed(c, tenant, user.id)).map((c) => c.id);
      const [viaCustomers, stamped] = await Promise.all([
        allowedIds.length ? sr.Estimate.filter({ customer_id: { $in: allowedIds } }, '-created_date', 500) : [],
        skip === 0 ? sr.Estimate.filter({ shop_owner_email: tenant }, '-created_date', 200) : [],
      ]);
      const all = [...new Map([...viaCustomers, ...stamped].map((e) => [e.id, e])).values()];
      const [customers, vehicles] = await Promise.all([byIds('Customer', all.map((e) => e.customer_id)), byIds('Vehicle', all.map((e) => e.vehicle_id))]);
      items = all.filter((e) => estimateAllowed(e, customers.get(e.customer_id), vehicles.get(e.vehicle_id), tenant, user.id));
    }
    return Response.json({ items: items.map((r) => project(entity, r)), has_more: page.length === limit, next_skip: skip + limit });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}