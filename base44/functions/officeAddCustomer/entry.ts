// officeAddCustomer — lets an office-staff member (PIN-authenticated on their own phone,
// no base44 login) add a customer + vehicle straight into the correct shop owner's data.
// Uses asServiceRole so created_by is explicitly and correctly set to the shop owner's email
// regardless of the caller's own session — same cross-tenant-safe pattern as customerLogin.
// deployed: 2026-07-05
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalizePhone(digits) {
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const sr = base44.asServiceRole;
  try {
    const body = await req.json();
    const { action, shop_email } = body;
    const shopEmail = (shop_email || "").toLowerCase().trim();

    if (!action || !shopEmail) {
      return new Response(JSON.stringify({ success: false, error: "Missing action or shop_email" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // --- findOrCreateCustomer ---------------------------------------------------
    if (action === "findOrCreateCustomer") {
      const { full_name, phone, email, address } = body;
      const cleaned = (phone || "").replace(/\D/g, "");
      if (!full_name || cleaned.length < 7) {
        return new Response(JSON.stringify({ success: false, error: "Name and a valid phone are required" }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      const cleanedNorm = normalizePhone(cleaned);

      const existing = await sr.entities.Customer.filter({ created_by: shopEmail }, "full_name", 5000);
      const match = existing.find((c) => {
        const cp = (c.phone || "").replace(/\D/g, "");
        return cp && normalizePhone(cp) === cleanedNorm;
      });

      if (match) {
        return new Response(JSON.stringify({
          success: true, existed: true,
          customer: { id: match.id, full_name: match.full_name, phone: match.phone, email: match.email || null }
        }), { headers: { "Content-Type": "application/json" } });
      }

      const created = await sr.entities.Customer.create({
        full_name: full_name.trim(),
        phone: cleaned,
        email: email ? email.trim() : undefined,
        address: address ? address.trim() : undefined,
        created_by: shopEmail,
      });

      return new Response(JSON.stringify({
        success: true, existed: false,
        customer: { id: created.id, full_name: created.full_name, phone: created.phone, email: created.email || null }
      }), { headers: { "Content-Type": "application/json" } });
    }

    // --- addVehicle ---------------------------------------------------------------
    if (action === "addVehicle") {
      const { customer_id, customer_name, vin, make, model, year, engine_type, color, license_plate } = body;
      if (!customer_id || !make || !model || !year) {
        return new Response(JSON.stringify({ success: false, error: "customer_id, make, model, and year are required" }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      const vehicle = await sr.entities.Vehicle.create({
        customer_id,
        customer_name: customer_name || "",
        vin: vin || undefined,
        make, model, year: Number(year),
        engine_type: engine_type || undefined,
        color: color || undefined,
        license_plate: license_plate || undefined,
        created_by: shopEmail,
      });

      // Center Control: keep the customer record's summary fields in sync.
      const today = new Date().toISOString().slice(0, 10);
      const customer = await sr.entities.Customer.get(customer_id);
      if (customer) {
        await sr.entities.Customer.update(customer_id, {
          last_visit: today,
          last_vehicle_info: `${year} ${make} ${model}`,
          total_visits: (customer.total_visits || 0) + 1,
        });
      }

      return new Response(JSON.stringify({ success: true, vehicle: { id: vehicle.id, ...vehicle } }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Unknown action" }), {
      status: 400, headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
