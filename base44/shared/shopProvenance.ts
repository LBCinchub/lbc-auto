// Pure provenance rules for shop-scoped reads of SERVICE-CREATED records (web bookings etc.).
// The client's own RLS already returns records the user created; this module only decides which
// service-created records belong to the verified tenant. A client can stamp any shop_owner_email
// on records it creates, but it cannot set created_by_id, so a tenant stamp is trusted ONLY on
// records whose created_by_id is a platform service identity. Conflicts fail closed.

export const SCOPED_ENTITIES = ['Appointment', 'Customer', 'Vehicle', 'Estimate'];

const SAFE_FIELDS = {
  Customer: ['full_name', 'phone', 'email', 'address', 'notes', 'shop_owner_email', 'last_visit', 'last_vehicle_info', 'total_visits'],
  Vehicle: ['customer_id', 'customer_name', 'shop_owner_email', 'vin', 'license_plate', 'make', 'model', 'year', 'trim', 'engine_liters', 'engine_type', 'fuel_type', 'drive_type', 'transmission', 'color', 'mileage', 'last_service_date', 'last_service_mileage'],
  Appointment: ['customer_id', 'customer_name', 'vehicle_id', 'vehicle_info', 'mechanic_id', 'mechanic_name', 'service_type', 'date', 'time_slot', 'notes', 'status', 'source', 'price_estimate', 'customer_phone', 'customer_email_address', 'shop_email'],
  Estimate: ['estimate_number', 'customer_id', 'customer_name', 'vehicle_id', 'vehicle_info', 'status', 'auth_status', 'linked_repair_order_id', 'linked_repair_order_number', 'linked_invoice_id', 'linked_invoice_number', 'amount_paid', 'service_reason', 'notes', 'labor_items', 'parts_items', 'labor_total', 'parts_total', 'tax_rate', 'tax_applies_to', 'tax_amount', 'discount', 'discount_type', 'grand_total', 'valid_until', 'estimate_date', 'ghost_status', 'ghost_total'],
};

const lower = (v) => String(v || '').trim().toLowerCase();
export const isServiceCreated = (r) => String(r?.created_by_id || '').startsWith('service_');
export const stampOf = (r) => lower(r?.shop_owner_email || r?.shop_email);

export function project(entity, r) {
  const out = { id: r.id, created_date: r.created_date, updated_date: r.updated_date, _shop_scoped: true };
  for (const f of SAFE_FIELDS[entity]) if (r[f] !== undefined) out[f] = r[f];
  return out;
}

// A record stamped for this tenant by a service identity.
export const stampedForTenant = (r, tenant) => isServiceCreated(r) && stampOf(r) === tenant;

// A customer the tenant is entitled to: own-created, or service-created and stamped for the tenant.
export const customerAllowed = (c, tenant, userId) => !!c && (c.created_by_id === userId ? (!stampOf(c) || stampOf(c) === tenant) : stampedForTenant(c, tenant));

// Vehicle: stamped service record, or unstamped service record whose customer is allowed.
export function vehicleAllowed(v, customer, tenant, userId) {
  if (!v || !isServiceCreated(v)) return false;
  if (stampOf(v) && stampOf(v) !== tenant) return false;
  if (!customerAllowed(customer, tenant, userId) || v.customer_id !== customer.id) return false;
  return true;
}

// Appointment: stamped service record; linked customer must be allowed, and a real linked vehicle must belong to it.
export function appointmentAllowed(a, customer, vehicle, tenant, userId) {
  if (!stampedForTenant(a, tenant)) return false;
  if (a.customer_id && !customerAllowed(customer, tenant, userId)) return false;
  if (vehicle && vehicle.customer_id !== a.customer_id) return false;
  return true;
}

// Estimate: service record (stamp must match if present); customer allowed; vehicle belongs to customer.
export function estimateAllowed(e, customer, vehicle, tenant, userId) {
  if (!isServiceCreated(e)) return false;
  if (stampOf(e) && stampOf(e) !== tenant) return false;
  if (!customerAllowed(customer, tenant, userId) || e.customer_id !== customer.id) return false;
  if (e.vehicle_id && (!vehicle || vehicle.customer_id !== customer.id)) return false;
  return true;
}