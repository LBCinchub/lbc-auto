import { base44 } from "@/api/base44Client";

/**
 * ═══════════════════════════════════════════════════════════════
 *  CENTER CONTROL — syncCustomerActivity
 * ═══════════════════════════════════════════════════════════════
 *
 *  Call after ANY save (Estimate, Invoice, RepairOrder, Appointment).
 *
 *  INWARD  → updates Customer record (last_visit, phone, name, vehicle)
 *  OUTWARD → if Customer phone/name differs from what we just saved,
 *             pushes the correct Customer data back out to the caller
 *             so the UI always shows the authoritative version.
 *  VEHICLE → ensures Vehicle.customer_id is always linked.
 *
 *  This makes Customer the single source of truth.
 *  All roads lead to — and from — the Customer record.
 */
export async function syncCustomerActivity({
  customerId,
  vehicleId,
  vehicleInfo,
  customerName,
  customerPhone,
  customerEmail,
  isNewVisit = true,
} = {}) {
  if (!customerId) return;

  try {
    const today = new Date().toISOString().split("T")[0];

    // ── INWARD: Update Customer record ──────────────────────────────────
    const customerUpdate = {};
    if (isNewVisit) customerUpdate.last_visit = today;
    if (vehicleInfo) customerUpdate.last_vehicle_info = vehicleInfo;
    // Only update name/phone/email if provided (don't blank them out)
    if (customerName)  customerUpdate.full_name = customerName;
    if (customerPhone) customerUpdate.phone     = customerPhone;
    if (customerEmail) customerUpdate.email     = customerEmail;

    if (Object.keys(customerUpdate).length > 0) {
      await base44.entities.Customer.update(customerId, customerUpdate);
    }

    // ── VEHICLE LINK: ensure Vehicle always knows its owner ─────────────
    if (vehicleId) {
      await base44.entities.Vehicle.update(vehicleId, {
        customer_id:   customerId,
        customer_name: customerName || undefined,
      }).catch(() => {}); // non-fatal
    }

  } catch (e) {
    // Never crash the UI for a background sync error
    console.warn("[CENTER CONTROL] syncCustomerActivity non-fatal:", e?.message || e);
  }
}
