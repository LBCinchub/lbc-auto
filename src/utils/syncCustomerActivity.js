import { base44 } from "@/api/base44Client";

/**
 * syncCustomerActivity — call after ANY save (Estimate, Invoice, RepairOrder, Appointment)
 *
 * Keeps the Customer record perfectly in sync:
 *   - last_visit      → today's date
 *   - last_vehicle_info → e.g. "2018 Toyota Camry"
 *   - full_name / phone / email → kept up to date
 *
 * Keeps the Vehicle record in sync:
 *   - customer_id     → always linked
 *   - customer_name   → denormalized copy for fast display
 */
export async function syncCustomerActivity({
  customerId,
  vehicleId,
  vehicleInfo,
  customerName,
  customerPhone,
  customerEmail,
  isNewVisit = true,   // set false for Appointment (upcoming, not yet a visit)
} = {}) {
  if (!customerId) return;

  try {
    const today = new Date().toISOString().split("T")[0];

    // ── Update Customer ─────────────────────────────────────────────────
    const customerUpdate = {};
    if (isNewVisit) customerUpdate.last_visit = today;
    if (vehicleInfo) customerUpdate.last_vehicle_info = vehicleInfo;
    if (customerName) customerUpdate.full_name = customerName;
    if (customerPhone) customerUpdate.phone = customerPhone;
    if (customerEmail) customerUpdate.email = customerEmail;

    if (Object.keys(customerUpdate).length > 0) {
      await base44.entities.Customer.update(customerId, customerUpdate);
    }

    // ── Update Vehicle ──────────────────────────────────────────────────
    if (vehicleId) {
      const vehicleUpdate = { customer_id: customerId };
      if (customerName) vehicleUpdate.customer_name = customerName;
      await base44.entities.Vehicle.update(vehicleId, vehicleUpdate).catch(() => {});
    }
  } catch (e) {
    console.warn("[syncCustomerActivity] non-fatal error:", e?.message || e);
  }
}
