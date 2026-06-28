import { base44 } from "@/api/base44Client";

/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║           CENTER CONTROL v2 — BLOCKCHAIN-STYLE LEDGER               ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║  Customer is the single source of truth. Every record (Invoice,      ║
 * ║  Estimate, RepairOrder, Appointment, Vehicle) is a child node.       ║
 * ║                                                                      ║
 * ║  RULES (like blockchain):                                            ║
 * ║  1. VALIDATE FIRST — if customer_id is present, it must resolve.     ║
 * ║     Reject the save if it doesn't (no orphan records).               ║
 * ║  2. INWARD SYNC — every save writes back to the Customer record:     ║
 * ║     last_visit, last_vehicle_info, phone, email, name.               ║
 * ║  3. OUTWARD PROPAGATE — every save fans out the authoritative        ║
 * ║     customer name/phone/email to ALL sibling records that share      ║
 * ║     the same customer_id: Invoices, Estimates, RepairOrders,         ║
 * ║     Appointments, Vehicles.                                          ║
 * ║  4. AUDIT LOG — every change is appended to Customer.activity_log.  ║
 * ║  5. VEHICLE LINK — Vehicle.customer_id is always enforced.           ║
 * ║                                                                      ║
 * ║  Returns { ok, customer, errors[] }                                  ║
 * ║  If ok=false: caller MUST abort the save and show errors.            ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

// ── VALIDATION ────────────────────────────────────────────────────────────────
export async function validateRecord({ customerId, vehicleId, entityType, entityId }) {
  const errors = [];

  if (!customerId) {
    errors.push("Customer is required — every record must link to a customer.");
    return { ok: false, errors };
  }

  // Verify customer exists in DB
  try {
    const customer = await base44.entities.Customer.get(customerId);
    if (!customer || !customer.id) {
      errors.push(`Customer record not found (id: ${customerId}). Cannot save — fix the customer link first.`);
    }
  } catch(e) {
    errors.push(`Could not verify customer: ${e?.message || e}`);
  }

  // Verify vehicle exists and belongs to this customer
  if (vehicleId) {
    try {
      const vehicle = await base44.entities.Vehicle.get(vehicleId);
      if (!vehicle || !vehicle.id) {
        errors.push(`Vehicle record not found (id: ${vehicleId}). Cannot save.`);
      } else if (vehicle.customer_id && vehicle.customer_id !== customerId) {
        errors.push(`Vehicle belongs to a different customer. Cannot save — vehicle ownership mismatch.`);
      }
    } catch(e) {
      errors.push(`Could not verify vehicle: ${e?.message || e}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── MAIN CENTER CONTROL SYNC ──────────────────────────────────────────────────
export async function syncCustomerActivity({
  customerId,
  vehicleId,
  vehicleInfo,
  customerName,
  customerPhone,
  customerEmail,
  entityType,      // "Invoice" | "Estimate" | "RepairOrder" | "Appointment"
  entityId,        // the saved record's id
  isNewVisit = true,
  propagate = true, // fan out to all sibling records
} = {}) {
  if (!customerId) return { ok: false, errors: ["No customerId provided"] };

  const results = { ok: true, errors: [], propagated: [] };
  const today = new Date().toISOString().split("T")[0];

  try {
    // ── 1. Read authoritative Customer record ─────────────────────────────
    let customer;
    try {
      customer = await base44.entities.Customer.get(customerId);
      if (!customer?.id) throw new Error("Not found");
    } catch(e) {
      return { ok: false, errors: [`Customer ${customerId} not found — record rejected`] };
    }

    // ── 2. INWARD — update Customer with latest data ──────────────────────
    const customerUpdate = {};
    if (isNewVisit) customerUpdate.last_visit = today;
    if (vehicleInfo) customerUpdate.last_vehicle_info = vehicleInfo;
    // Only overwrite if provided AND non-empty (never blank out existing data)
    if (customerName  && customerName.trim())  customerUpdate.full_name = customerName.trim();
    if (customerPhone && customerPhone.trim())  customerUpdate.phone    = customerPhone.trim();
    if (customerEmail && customerEmail.trim())  customerUpdate.email    = customerEmail.trim();

    // Append audit log entry
    const logEntry = {
      date: today,
      time: new Date().toISOString(),
      entity: entityType || "unknown",
      entity_id: entityId || "",
      action: isNewVisit ? "new_visit" : "updated",
      fields_changed: Object.keys(customerUpdate).filter(k => k !== "last_visit"),
    };
    const existingLog = customer.activity_log || [];
    customerUpdate.activity_log = [...existingLog.slice(-99), logEntry]; // keep last 100 entries

    if (Object.keys(customerUpdate).length > 0) {
      await base44.entities.Customer.update(customerId, customerUpdate);
    }

    // ── 3. Re-read authoritative values after update ──────────────────────
    const authName  = customerUpdate.full_name  || customer.full_name  || "";
    const authPhone = customerUpdate.phone       || customer.phone       || "";
    const authEmail = customerUpdate.email       || customer.email       || "";

    // ── 4. VEHICLE LINK — enforce ownership ──────────────────────────────
    if (vehicleId) {
      try {
        await base44.entities.Vehicle.update(vehicleId, {
          customer_id:   customerId,
          customer_name: authName || undefined,
        });
        results.propagated.push(`Vehicle:${vehicleId}`);
      } catch(e) { /* non-fatal */ }
    }

    // ── 5. OUTWARD PROPAGATE — fan out to all sibling records ─────────────
    if (propagate && authName) {
      const contactPatch = {
        customer_name: authName,
        ...(authPhone ? { customer_phone: authPhone } : {}),
        ...(authEmail ? { customer_email: authEmail } : {}),
      };

      const propagateToEntity = async (entityName, skipId) => {
        try {
          const records = await base44.entities[entityName].filter({ customer_id: customerId });
          for (const rec of records) {
            if (rec.id === skipId) continue; // skip the record that just saved (already fresh)
            await base44.entities[entityName].update(rec.id, contactPatch);
            results.propagated.push(`${entityName}:${rec.id}`);
          }
        } catch(e) { /* non-fatal per entity */ }
      };

      const skipId = entityId || null;
      await Promise.all([
        propagateToEntity("Invoice",     entityType === "Invoice"     ? skipId : null),
        propagateToEntity("Estimate",    entityType === "Estimate"    ? skipId : null),
        propagateToEntity("RepairOrder", entityType === "RepairOrder" ? skipId : null),
        propagateToEntity("Appointment", entityType === "Appointment" ? skipId : null),
        propagateToEntity("Vehicle",     entityType === "Vehicle"     ? skipId : null),
      ]);
    }

  } catch(e) {
    // Non-fatal — log but don't crash the UI
    console.warn("[CENTER CONTROL v2] sync error:", e?.message || e);
    results.errors.push(e?.message || String(e));
  }

  return results;
}

// ── CUSTOMER UPDATE PROPAGATOR ─────────────────────────────────────────────────
// Call this from CustomerDetails page when customer name/phone/email is edited directly.
// Fans out the change to every linked record.
export async function propagateCustomerUpdate(customerId, updatedFields) {
  if (!customerId) return;

  const patch = {};
  if (updatedFields.full_name)  patch.customer_name  = updatedFields.full_name;
  if (updatedFields.phone)      patch.customer_phone = updatedFields.phone;
  if (updatedFields.email)      patch.customer_email = updatedFields.email;

  if (Object.keys(patch).length === 0) return;

  const entities = ["Invoice", "Estimate", "RepairOrder", "Appointment", "Vehicle"];
  const results = [];

  await Promise.all(entities.map(async (entityName) => {
    try {
      const records = await base44.entities[entityName].filter({ customer_id: customerId });
      for (const rec of records) {
        await base44.entities[entityName].update(rec.id, patch);
        results.push(`${entityName}:${rec.id}`);
      }
    } catch(e) { /* non-fatal */ }
  }));

  return results;
}
