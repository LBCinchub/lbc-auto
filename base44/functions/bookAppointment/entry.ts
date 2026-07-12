/**
 * bookAppointment — PUBLIC endpoint (no auth required)
 * Called by the Haj Rims AI agent / any embedded booking widget.
 *
 * Creates:
 *   1. A Customer record (or finds existing by phone) under the shop's account
 *   2. A Vehicle record (or finds existing)
 *   3. An Appointment record tagged as source="web_booking"
 *   4. A Notification for the shop's dashboard
 *   5. An email to the shop owner AND the customer (if they provided email)
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const body = await req.json();
    const {
      shop_email,           // required — e.g. "hajwheels@gmail.com"
      customer_name,        // required
      customer_phone,       // required
      customer_email,       // optional
      service_type,         // required — e.g. "Oil Change"
      date,                 // required — YYYY-MM-DD
      time_slot,            // required — e.g. "10:00 AM"
      vehicle_make,         // optional
      vehicle_model,        // optional
      vehicle_year,         // optional
      vehicle_info,         // optional — free text fallback
      notes,                // optional
      price_estimate,       // optional — what the AI quoted
    } = body;

    // ── Validate required fields ──
    const missing = [];
    if (!shop_email)      missing.push("shop_email");
    if (!customer_name)   missing.push("customer_name");
    if (!customer_phone)  missing.push("customer_phone");
    if (!service_type)    missing.push("service_type");
    if (!date)            missing.push("date");
    if (!time_slot)       missing.push("time_slot");
    if (missing.length) {
      return Response.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400, headers: CORS });
    }

    const phoneClean = normalizePhone(customer_phone);
    if (phoneClean.length < 7) {
      return Response.json({ error: "Please provide a valid customer phone number." }, { status: 400, headers: CORS });
    }

    // ── Guard: reject test bookings in production ──
    const testName = (customer_name || "").toLowerCase().trim();
    const testPhones = ["5551234", "6135550001", "6135559876", "6135551234"];
    if (testName.includes("test") || testPhones.includes(phoneClean)) {
      return Response.json({ error: "Test bookings not accepted in production." }, { status: 400, headers: CORS });
    }

    // ── 1. Find or create Customer ──
    const allCustomers = await sr.entities.Customer.filter(
      { shop_owner_email: shop_email }, "full_name", 5000
    );
    let customer = allCustomers.find((c) => {
      const cp = (c.phone || "").replace(/\D/g, "");
      return cp && normalizePhone(cp) === phoneClean;
    });

    if (!customer) {
      customer = await sr.entities.Customer.create({
        full_name: customer_name.trim(),
        phone: phoneClean,
        email: customer_email || undefined,
        shop_owner_email: shop_email,
      });
    }

    // ── 2. Find or create Vehicle ──
    let vehicle: any = null;
    const vMake = vehicle_make || "";
    const vModel = vehicle_model || "";
    const vYear = vehicle_year ? Number(vehicle_year) : 0;
    const displayVehicleInfo = vehicle_info ||
      [vYear || "", vMake, vModel].filter(Boolean).join(" ") || "Unknown vehicle";

    if (vMake && vModel && vYear) {
      const existingVehicles = await sr.entities.Vehicle.filter({ customer_id: customer.id }, null, 50);
      vehicle = existingVehicles.find(
        (v) => v.make?.toLowerCase() === vMake.toLowerCase() &&
               v.model?.toLowerCase() === vModel.toLowerCase() &&
               Number(v.year) === vYear
      );
      if (!vehicle) {
        vehicle = await sr.entities.Vehicle.create({
          customer_id: customer.id,
          customer_name: customer.full_name,
          make: vMake,
          model: vModel,
          year: vYear,
        });
      }
    }

    // ── 3. Create Appointment ──
    const appointment = await sr.entities.Appointment.create({
      customer_id: customer.id,
      customer_name: customer.full_name,
      vehicle_id: vehicle?.id || "web_booking",
      vehicle_info: displayVehicleInfo,
      service_type: service_type.trim(),
      date,
      time_slot: time_slot.trim(),
      notes: notes || undefined,
      status: "scheduled",
      source: "web_booking",
      price_estimate: price_estimate ? Number(price_estimate) : undefined,
      customer_phone: phoneClean,
      customer_email_address: customer_email || undefined,
      shop_email: shop_email,
    });

    // ── 4. Create dashboard Notification ──
    try {
      const priceStr = price_estimate ? ` · ~$${Number(price_estimate).toFixed(0)}` : "";
      await sr.entities.Notification.create({
        title: `🌐 New Web Booking`,
        message: `${customer_name} booked ${service_type} on ${date} @ ${time_slot}${priceStr} — from ${vehicle_info || displayVehicleInfo}`,
        type: "appointment",
        is_read: false,
        link: `/Appointments?appointmentId=${appointment.id}`,
        created_by: shop_email,
      });
    } catch (e) {
      // Notification is best-effort — don't fail the booking over it
      console.error("Notification create failed:", e);
    }

    // ── 5. Email shop owner ──
    try {
      const shopUsers = await sr.entities.User.filter({ email: shop_email }, null, 1);
      const shop = shopUsers[0] || {};
      const shopName = shop.business_name || "Your Shop";
      const priceRow = price_estimate
        ? `<p style="margin:0 0 6px"><strong>Quoted price:</strong> ~$${Number(price_estimate).toFixed(2)}</p>` : "";

      const html = `
<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#0a0f1e;color:#e2e8f0;border-radius:12px;overflow:hidden">
  <div style="background:linear-gradient(135deg,#001f3f,#002b55);padding:24px 28px;border-bottom:1px solid rgba(0,170,255,0.2)">
    <h1 style="margin:0;font-size:20px;color:#fff">🌐 New Online Booking</h1>
    <p style="margin:6px 0 0;color:#38bdf8;font-size:13px">${shopName} · LBC Auto</p>
  </div>
  <div style="padding:22px 28px">
    <div style="background:rgba(0,170,255,0.07);border:1px solid rgba(0,170,255,0.15);border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <p style="margin:0 0 6px"><strong>Customer:</strong> ${customer_name}</p>
      <p style="margin:0 0 6px"><strong>Phone:</strong> ${phoneClean}</p>
      ${customer_email ? `<p style="margin:0 0 6px"><strong>Email:</strong> ${customer_email}</p>` : ""}
      <p style="margin:0 0 6px"><strong>Service:</strong> ${service_type}</p>
      <p style="margin:0 0 6px"><strong>Date:</strong> ${date} @ ${time_slot}</p>
      <p style="margin:0 0 6px"><strong>Vehicle:</strong> ${displayVehicleInfo}</p>
      ${priceRow}
      ${notes ? `<p style="margin:0"><strong>Notes:</strong> ${notes}</p>` : ""}
    </div>
    <a href="https://lbchub.tech/Appointments" style="display:inline-block;background:linear-gradient(135deg,#0066cc,#00aaff);color:#fff;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
      View in LBC Auto →
    </a>
  </div>
  <div style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.06);color:#475569;font-size:11px">
    Powered by Lumina · LBC Network
  </div>
</div>`;

      await base44.functions.invoke("sendLBCAutoEmail", {
        to: shop_email,
        subject: `🌐 New Online Booking — ${customer_name} · ${service_type} on ${date}`,
        html,
      });
    } catch (e) {
      console.error("Shop email failed:", e);
    }

    return Response.json({
      success: true,
      appointment_id: appointment.id,
      message: `Appointment booked! ${customer_name} is confirmed for ${service_type} on ${date} at ${time_slot}.`,
      customer_id: customer.id,
      vehicle_id: vehicle?.id || null,
    }, { status: 200, headers: CORS });

  } catch (err) {
    console.error("bookAppointment error:", err);
    const errorMsg = shop_email === 'hajwheels@gmail.com'
      ? 'Booking failed. Please call 613-672-2727 directly.'
      : 'Booking failed. Please call your shop directly.';
    return Response.json({ error: (err as any).message || errorMsg }, { status: 500, headers: CORS });
  }
});