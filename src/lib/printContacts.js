// Whitelisted contact projections for printed documents. Never invents values.
const s = (v) => (v == null ? "" : String(v).trim());

export function shopContact(shop) {
  if (!shop) return null;
  return {
    business_name: s(shop.business_name),
    business_logo: s(shop.business_logo || shop.logo_url),
    phone: s(shop.phone),
    // Configured public business email; falls back to the shop account (tenant) email.
    email: s(shop.business_email || shop.email),
    address: s(shop.address),
    gst_number: s(shop.gst_number),
  };
}

export function customerContact(customer, invoice) {
  return {
    name: s(invoice?.customer_name) || s(customer?.full_name),
    phone: s(customer?.phone),
    email: s(customer?.email),
    address: s(customer?.address),
  };
}

// Load contacts for one invoice; `isCurrent` guards against stale responses.
export async function loadInvoiceContacts({ invoice, me, getCustomer, getVehicle }) {
  const user = await me();
  const customer = invoice?.customer_id ? await getCustomer(invoice.customer_id) : null;
  const vehicle = invoice?.vehicle_id ? await getVehicle(invoice.vehicle_id).catch(() => null) : null;
  return { user, customer, vehicle };
}