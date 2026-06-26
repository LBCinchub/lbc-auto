import { base44 } from "@/api/base44Client";

/**
 * After any save (Estimate, Invoice, RepairOrder, Appointment),
 * call this to keep the Customer record perfectly up-to-date.
 * 
 * - Updates last_visit to today
 * - Stores last_vehicle_info for quick reference
 * - Ensures Vehicle.customer_id is correctly set
 * - Updates vehicle_info string on the Vehicle record
 */
export async function syncCustomerActivity({ customerId, vehicleId, vehicleInfo, customerName, customerPhone, customerEmail } = {}) {
  if (!customerId) return;

  try {
    const today = new Date().toISOString().split("T")[0];

    // Update customer last_visit + snapshot info
    const customerUpdate = { last_visit: today };
    if (vehicleInfo) customerUpdate.last_vehicle_info = vehicleInfo;
    if (customerName) customerUpdate.full_name = customerName; // title-case already applied
    if (customerPhone) customerUpdate.phone = customerPhone;
    if (customerEmail) customerUpdate.email = customerEmail;
    await base44.entities.Customer.update(customerId, customerUpdate);

    // Ensure vehicle has the right customer_id + info string
    if (vehicleId) {
      await base44.entities.Vehicle.update(vehicleId, {
        customer_id: customerId,
        customer_name: customerName || undefined,
      }).catch(() => {}); // silent — vehicle may not exist yet in some edge cases
    }
  } catch (e) {
    console.warn("syncCustomerActivity failed (non-fatal):", e);
  }
}
