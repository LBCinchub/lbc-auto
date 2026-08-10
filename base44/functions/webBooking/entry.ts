import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DEFAULT_SERVICES = [
  "Oil Change",
  "Brake Service",
  "Diagnostic",
  "Tire Service",
  "Engine Repair",
  "Transmission",
  "Electrical",
  "AC Service",
  "Inspection",
  "Other",
];

const RATE_LIMIT_BOOKINGS_PER_HOUR = 20;
const RATE_LIMIT_MESSAGES_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;

const norm = (s) => String(s ?? "").trim();
const normPhone = (s) => String(s ?? "").replace(/[\s\-().]/g, "");

/**
 * Look up the WebBookingKey by api_key. The key is the ONLY authentication
 * mechanism (no user session), so all entity access uses the service role and
 * every created record is explicitly stamped with the shop's tenant email.
 */
async function getKey(base44, rawKey) {
  const apiKey = norm(rawKey);
  if (!apiKey) return { error: "Missing shop API key", status: 401 };
  let rows = [];
  try {
    rows = await base44.asServiceRole.entities.WebBookingKey.filter({ api_key: apiKey }, "-created_date", 1);
  } catch (_) {
    return { error: "Invalid shop API key", status: 401 };
  }
  const key = rows[0];
  if (!key || key.is_active === false) return { error: "Invalid shop API key", status: 401 };
  return { key };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "create_booking";

    // ── get_shop_services ────────────────────────────────────────────────
    if (action === "get_shop_services") {
      const { key, error, status } = await getKey(base44, body.shop_api_key);
      if (error) return Response.json({ error }, { status });
      let services = DEFAULT_SERVICES;
      try {
        const users = await base44.asServiceRole.entities.User.filter({ email: key.shop_owner_email }, "-created_date", 1);
        const shopUser = users[0];
        if (shopUser && Array.isArray(shopUser.web_booking_services) && shopUser.web_booking_services.length) {
          services = shopUser.web_booking_services.map(String).filter(Boolean);
        }
      } catch (_) {}
      return Response.json({ success: true, shop_name: key.shop_name, services });
    }

    // ── check_status ─────────────────────────────────────────────────────
    if (action === "check_status") {
      const { key, error, status } = await getKey(base44, body.shop_api_key);
      if (error) return Response.json({ error }, { status });
      const bookingId = norm(body.booking_id);
      if (!bookingId) return Response.json({ error: "booking_id is required" }, { status: 400 });

      const appt = await base44.asServiceRole.entities.Appointment.get(bookingId).catch(() => null);
      if (!appt) return Response.json({ error: "Booking not found" }, { status: 404 });
      if (norm(appt.shop_email).toLowerCase() !== norm(key.shop_owner_email).toLowerCase()) {
        return Response.json({ error: "Booking not found" }, { status: 404 });
      }

      let estimate = null;
      try {
        const ests = await base44.asServiceRole.entities.Estimate.filter(
          { customer_id: appt.customer_id, vehicle_id: appt.vehicle_id },
          "-created_date",
          1
        );
        estimate = ests[0] || null;
      } catch (_) {}

      const apptStatus = appt.status || "scheduled";
      const estStatus = estimate?.status || "draft";
      let label;
      if (apptStatus === "cancelled") label = "Cancelled";
      else if (apptStatus === "completed") label = "Completed";
      else if (apptStatus === "in_progress") label = "In Progress";
      else if (apptStatus === "confirmed") label = "Booking Confirmed";
      else if (estStatus === "sent") label = "Estimate Sent";
      else if (estStatus === "approved") label = "Estimate Approved";
      else label = "Booking Received — Estimate Being Prepared";

      // Chat session is deterministically linked to the booking (web_<appointment_id>).
      const chatSessionId = `web_${appt.id}`;
      let unreadShopReplies = 0;
      try {
        const chatMsgs = await base44.asServiceRole.entities.ChatMessage.filter(
          { shop_email: key.shop_owner_email, session_id: chatSessionId },
          "-created_date",
          100
        );
        unreadShopReplies = chatMsgs.filter((m) => m.sender_type === "owner" && !m.is_read).length;
      } catch (_) {}

      return Response.json({
        success: true,
        booking_id: appt.id,
        appointment_status: apptStatus,
        estimate_status: estStatus,
        status_label: label,
        service_type: appt.service_type,
        preferred_date: appt.date,
        chat_session_id: chatSessionId,
        unread_shop_replies: unreadShopReplies,
      });
    }

    // ── send_chat_message ────────────────────────────────────────────────
    if (action === "send_chat_message") {
      const { key, error, status } = await getKey(base44, body.shop_api_key);
      if (error) return Response.json({ error }, { status });
      const tenant = key.shop_owner_email;
      const sessionId = norm(body.session_id);
      const senderName = norm(body.sender_name);
      const message = norm(body.message);
      if (!sessionId || !message) return Response.json({ error: "session_id and message are required" }, { status: 400 });

      // Rate limit: 30 customer messages per session per hour.
      let recent = [];
      try {
        recent = await base44.asServiceRole.entities.ChatMessage.filter(
          { shop_email: tenant, session_id: sessionId },
          "-created_date",
          100
        );
      } catch (_) {}
      const now = Date.now();
      const recentCustomerCount = recent.filter(
        (m) => m.sender_type === "customer" && new Date(m.created_date).getTime() > now - HOUR_MS
      ).length;
      if (recentCustomerCount >= RATE_LIMIT_MESSAGES_PER_HOUR) {
        return Response.json({ error: "Rate limit exceeded. Maximum 30 messages per hour." }, { status: 429 });
      }

      // Carry customer/vehicle context from the session's first message.
      const first = recent.find((m) => m.customer_phone || m.customer_name) || {};
      const msg = await base44.asServiceRole.entities.ChatMessage.create({
        shop_email: tenant,
        session_id: sessionId,
        sender_type: "customer",
        sender_name: senderName || first.customer_name || "Customer",
        message,
        customer_name: first.customer_name || senderName || "",
        customer_phone: first.customer_phone || "",
        customer_email: first.customer_email || "",
        vehicle_info: first.vehicle_info || "",
        service_requested: first.service_requested || "",
        status: "active",
        is_read: false,
        source: "website",
      });
      return Response.json({ success: true, message_id: msg.id });
    }

    // ── get_chat_messages ────────────────────────────────────────────────
    if (action === "get_chat_messages") {
      const { key, error, status } = await getKey(base44, body.shop_api_key);
      if (error) return Response.json({ error }, { status });
      const tenant = key.shop_owner_email;
      const sessionId = norm(body.session_id);
      if (!sessionId) return Response.json({ error: "session_id is required" }, { status: 400 });

      let msgs = [];
      try {
        msgs = await base44.asServiceRole.entities.ChatMessage.filter(
          { shop_email: tenant, session_id: sessionId },
          "created_date",
          200
        );
      } catch (_) {}

      // Customer is viewing the thread — mark shop replies as read.
      const hasUnreadShop = msgs.some((m) => m.sender_type === "owner" && !m.is_read);
      if (hasUnreadShop) {
        try {
          await base44.asServiceRole.entities.ChatMessage.updateMany(
            { session_id: sessionId, sender_type: "owner", is_read: false },
            { $set: { is_read: true } }
          );
        } catch (_) {}
      }

      return Response.json({
        success: true,
        messages: msgs.map((m) => ({
          id: m.id,
          sender_type: m.sender_type,
          sender_name: m.sender_name,
          message: m.message,
          sent_at: m.created_date,
          is_read: m.is_read,
        })),
      });
    }

    // ── resume_session ────────────────────────────────────────────────────
    if (action === "resume_session") {
      const { key, error, status } = await getKey(base44, body.shop_api_key);
      if (error) return Response.json({ error }, { status });
      const tenant = key.shop_owner_email;
      const phone = normPhone(body.customer_phone);
      if (!phone) return Response.json({ error: "customer_phone is required" }, { status: 400 });
      let msgs = [];
      try {
        msgs = await base44.asServiceRole.entities.ChatMessage.filter(
          { shop_email: tenant, customer_phone: phone, source: "website" },
          "-created_date",
          1
        );
      } catch (_) {}
      const latest = msgs[0];
      if (!latest) return Response.json({ success: true, session_id: null });
      return Response.json({
        success: true,
        session_id: latest.session_id,
        customer_name: latest.customer_name,
        vehicle_info: latest.vehicle_info,
        service_requested: latest.service_requested,
      });
    }

    if (action !== "create_booking") {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    // ── create_booking ───────────────────────────────────────────────────
    const { key, error, status } = await getKey(base44, body.shop_api_key);
    if (error) return Response.json({ error }, { status });
    const tenant = norm(key.shop_owner_email).toLowerCase();

    // Booking rate limit: max 20 per shop per hour (tracked on the key record).
    const now = Date.now();
    const recentBookings = (Array.isArray(key.recent_booking_times) ? key.recent_booking_times : [])
      .filter((t) => now - new Date(t).getTime() < HOUR_MS);
    if (recentBookings.length >= RATE_LIMIT_BOOKINGS_PER_HOUR) {
      return Response.json({ error: "Rate limit exceeded. Maximum 20 bookings per hour." }, { status: 429 });
    }
    recentBookings.push(new Date(now).toISOString());
    await base44.asServiceRole.entities.WebBookingKey.update(key.id, { recent_booking_times: recentBookings });

    const customer_name = norm(body.customer_name);
    const customer_phone = normPhone(body.customer_phone);
    const service_type = norm(body.service_type);
    const preferred_date = norm(body.preferred_date);
    const vehicle_make = norm(body.vehicle_make);
    const vehicle_model = norm(body.vehicle_model);
    const vehicle_year = body.vehicle_year ? Number(body.vehicle_year) : null;
    const vehicle_plate = norm(body.vehicle_plate);
    const customer_email = norm(body.customer_email);
    const notes = norm(body.notes);
    const time_slot = norm(body.time_slot) || "Any";

    if (!customer_name || !customer_phone || !service_type || !preferred_date || !vehicle_make || !vehicle_model || !vehicle_year) {
      return Response.json({ error: "Missing required booking fields" }, { status: 400 });
    }

    // Find or create customer — phone match is ALWAYS scoped to this tenant.
    let customer = null;
    try {
      const existing = await base44.asServiceRole.entities.Customer.filter(
        { phone: customer_phone, shop_owner_email: tenant },
        "-created_date",
        1
      );
      customer = existing[0] || null;
    } catch (_) {}
    if (!customer) {
      customer = await base44.asServiceRole.entities.Customer.create({
        full_name: customer_name,
        phone: customer_phone,
        email: customer_email,
        shop_owner_email: tenant,
        notes: notes || "",
      });
    }

    // Find or create vehicle — by plate, then by make+model+year under this customer.
    let vehicle = null;
    let vehicles = [];
    try {
      vehicles = await base44.asServiceRole.entities.Vehicle.filter({ customer_id: customer.id }, "-created_date", 50);
    } catch (_) {}
    if (vehicle_plate) {
      vehicle = vehicles.find((v) => norm(v.license_plate) === vehicle_plate) || null;
    }
    if (!vehicle) {
      vehicle = vehicles.find(
        (v) =>
          norm(v.make).toLowerCase() === vehicle_make.toLowerCase() &&
          norm(v.model).toLowerCase() === vehicle_model.toLowerCase() &&
          Number(v.year) === vehicle_year
      ) || null;
    }
    if (!vehicle) {
      vehicle = await base44.asServiceRole.entities.Vehicle.create({
        customer_id: customer.id,
        customer_name: customer.full_name,
        shop_owner_email: tenant,
        make: vehicle_make,
        model: vehicle_model,
        year: vehicle_year,
        license_plate: vehicle_plate || "",
      });
    }

    const vehicleInfo = [vehicle_year, vehicle_make, vehicle_model].filter(Boolean).join(" ");

    const appointment = await base44.asServiceRole.entities.Appointment.create({
      customer_id: customer.id,
      customer_name: customer.full_name,
      vehicle_id: vehicle.id,
      vehicle_info: vehicleInfo,
      service_type,
      date: preferred_date,
      time_slot,
      notes: notes || "",
      status: "scheduled",
      source: "web_booking",
      customer_phone: customer_phone,
      customer_email_address: customer_email,
      shop_email: tenant,
    });

    const estimate = await base44.asServiceRole.entities.Estimate.create({
      estimate_number: `EST-${Date.now().toString().slice(-6)}`,
      customer_id: customer.id,
      customer_name: customer.full_name,
      vehicle_id: vehicle.id,
      vehicle_info: vehicleInfo,
      status: "draft",
      service_reason: service_type + (notes ? ` — ${notes}` : ""),
      estimate_date: new Date().toISOString().slice(0, 10),
      notes: notes || "",
    });

    // Chat session is deterministically linked to the booking (web_<appointment_id>).
    const sessionId = `web_${appointment.id}`;
    const bookingMessage =
      `New booking request: ${service_type} for ${vehicle_make} ${vehicle_model}` +
      (notes ? `. Notes: ${notes}` : "");

    await base44.asServiceRole.entities.ChatMessage.create({
      shop_email: tenant,
      session_id: sessionId,
      sender_type: "customer",
      sender_name: customer_name,
      message: bookingMessage,
      customer_name: customer_name,
      customer_phone: customer_phone,
      customer_email: customer_email,
      vehicle_info: vehicleInfo,
      service_requested: service_type,
      status: "active",
      is_read: false,
      source: "website",
    });

    return Response.json({
      success: true,
      booking_id: appointment.id,
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      appointment_id: appointment.id,
      estimate_id: estimate.id,
      session_id: sessionId,
      message: "Booking received. The shop will confirm your appointment and send an estimate.",
    });
  } catch (error) {
    const message = error?.message || "Web booking failed";
    return Response.json({ error: message }, { status: 500 });
  }
}