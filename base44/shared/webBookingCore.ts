// Core web-booking pipeline logic. All entity access goes through the
// `entities` dependency (service-role in production, fakes in tests), so this
// module is fully unit-testable. No HTTP or secrets here.
import {
  sha256Hex, randomToken, canonicalizePhone, aliasLookupKeys,
  localToUtc, isValidTimeZone, draftHash, requestStatus, newCorrelationId,
} from "./bookingPrimitives.ts";

export { newCorrelationId } from "./bookingPrimitives.ts";

const RATE_LIMIT_BOOKINGS_PER_HOUR = 20;
const RATE_LIMIT_MESSAGES_PER_HOUR = 30;
const HOUR_MS = 60 * 60 * 1000;
const PENDING_LOCK_MS = 120 * 1000;

const norm = (s) => String(s ?? "").trim();
const legacyPhone = (s) => String(s ?? "").replace(/[\s\-().]/g, "");

export function fail(code, correlationId, status) {
  return Response.json({ error: code, correlation_id: correlationId }, { status });
}

// ── Authentication / tenant resolution ──────────────────────────────────────
// Three modes:
//  - "key":        legacy shared shop key (existing widget integrations)
//  - "credential": new hashed server-to-server credential bound to an alias
//  - "alias_public": public phone-alias page — booking intake ONLY, no private reads
export async function resolveAuth(entities, body) {
  const cid = newCorrelationId();
  const apiKey = norm(body.shop_api_key);
  const aliasParam = norm(body.public_alias);

  if (!apiKey && !aliasParam) return { blocked: { code: "AUTH_REQUIRED", status: 401, cid } };

  let alias = null;
  if (aliasParam) {
    const lookup = aliasLookupKeys(aliasParam);
    if (!lookup) return { blocked: { code: "ALIAS_UNKNOWN", status: 404, cid } };
    let aliases = [];
    try {
      aliases = await entities.ShopBookingAlias.filter({ is_active: true }, "-created_date", 100);
    } catch (_) {}
    const matched = aliases.filter(
      (a) => a.public_phone_e164 === lookup.e164 || (lookup.local && a.local_alias === lookup.local)
    );
    if (matched.length === 0) return { blocked: { code: "ALIAS_UNKNOWN", status: 404, cid } };
    if (matched.length > 1) return { blocked: { code: "ALIAS_AMBIGUOUS", status: 409, cid } };
    alias = matched[0];

    // A browser-supplied shop_email must match the resolved shop or be rejected.
    if (norm(body.shop_email)) {
      const claimed = norm(body.shop_email).toLowerCase();
      if (claimed !== norm(alias.shop_owner_email).toLowerCase()) {
        return { blocked: { code: "FORGED_TENANT", status: 403, cid } };
      }
    }
  }

  if (apiKey) {
    let keys = [];
    try {
      keys = await entities.WebBookingKey.filter({ api_key: apiKey }, "-created_date", 1);
    } catch (_) {}
    const key = keys[0];
    if (!key || key.is_active === false) return { blocked: { code: "AUTH_INVALID", status: 401, cid } };
    if (alias && norm(key.shop_owner_email).toLowerCase() !== norm(alias.shop_owner_email).toLowerCase()) {
      return { blocked: { code: "TENANT_KEY_MISMATCH", status: 403, cid } };
    }
    return { mode: "key", tenant: norm(key.shop_owner_email).toLowerCase(), key, alias };
  }

  // Alias with a credential claim — verify the hashed server-to-server secret.
  const credential = norm(body.shop_credential);
  if (credential) {
    if (!alias.credential_hash) return { blocked: { code: "AUTH_INVALID", status: 401, cid } };
    const hash = await sha256Hex(credential);
    if (hash !== alias.credential_hash) return { blocked: { code: "AUTH_INVALID", status: 401, cid } };
    return { mode: "credential", tenant: norm(alias.shop_owner_email).toLowerCase(), alias };
  }

  // Public intake: allowed to request a booking, never to read private data.
  return { mode: "alias_public", tenant: norm(alias.shop_owner_email).toLowerCase(), alias };
}

async function getShopServices(entities, tenant) {
  try {
    const users = await entities.User.filter({ email: tenant }, "-created_date", 1);
    const shopUser = users[0];
    if (shopUser && Array.isArray(shopUser.web_booking_services) && shopUser.web_booking_services.length) {
      return shopUser.web_booking_services.map(String).filter(Boolean);
    }
  } catch (_) {}
  return [
    "Oil Change", "Brake Service", "Diagnostic", "Tire Service", "Engine Repair",
    "Transmission", "Electrical", "AC Service", "Inspection", "Other",
  ];
}

function matchService(services, requested) {
  const req = norm(requested).toLowerCase();
  return services.find((s) => s.toLowerCase() === req) || null;
}

// ── Rate limiting (per shop, per hour) ──────────────────────────────────────
async function rateLimit(entities, auth, cid) {
  const now = Date.now();
  if (auth.mode === "key") {
    const key = auth.key;
    const recent = (Array.isArray(key.recent_booking_times) ? key.recent_booking_times : [])
      .filter((t) => now - new Date(t).getTime() < HOUR_MS);
    if (recent.length >= RATE_LIMIT_BOOKINGS_PER_HOUR) {
      return { blocked: { code: "RATE_LIMITED", status: 429, cid } };
    }
    recent.push(new Date(now).toISOString());
    await entities.WebBookingKey.update(key.id, { recent_booking_times: recent });
    return { ok: true };
  }
  const alias = auth.alias;
  const recent = (Array.isArray(alias.recent_booking_times) ? alias.recent_booking_times : [])
    .filter((t) => now - new Date(t).getTime() < HOUR_MS);
  if (recent.length >= RATE_LIMIT_BOOKINGS_PER_HOUR) {
    return { blocked: { code: "RATE_LIMITED", status: 429, cid } };
  }
  recent.push(new Date(now).toISOString());
  await entities.ShopBookingAlias.update(alias.id, { recent_booking_times: recent });
  return { ok: true };
}

// ── Validation ──────────────────────────────────────────────────────────────
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export async function validateDraft(entities, auth, body, cid) {
  const alias = auth.alias || null;
  const tz = alias && alias.timezone ? alias.timezone : null;
  const country = alias && alias.country ? alias.country : null;
  const strict = !!tz;

  const customer_name = norm(body.customer_name);
  const customer_phone = country
    ? canonicalizePhone(body.customer_phone, country)
    : (legacyPhone(body.customer_phone).length >= 10 ? legacyPhone(body.customer_phone) : null);
  const customer_email = norm(body.customer_email);
  const service_type = norm(body.service_type);
  const preferred_date = norm(body.preferred_date);
  const vehicle_make = norm(body.vehicle_make);
  const vehicle_model = norm(body.vehicle_model);
  const vehicle_year = Number(body.vehicle_year);
  const vehicle_plate = norm(body.vehicle_plate).toUpperCase();
  const notes = norm(body.notes);
  let time_slot = norm(body.time_slot);

  if (!customer_name || !customer_phone || !service_type || !preferred_date || !vehicle_make || !vehicle_model || !vehicle_year) {
    return { blocked: { code: "FIELDS_REQUIRED", status: 400, cid } };
  }
  if (body.customer_confirmed !== true) {
    return { blocked: { code: "CONFIRMATION_REQUIRED", status: 400, cid } };
  }
  if (!/^\d{4}$/.test(String(body.vehicle_year || "")) || vehicle_year < 1981 || vehicle_year > 2040) {
    return { blocked: { code: "YEAR_INVALID", status: 400, cid } };
  }
  if (!validDate(preferred_date)) return { blocked: { code: "DATE_INVALID", status: 400, cid } };

  let requested_start_utc = null;
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time_slot)) {
    if (tz) {
      requested_start_utc = localToUtc(preferred_date, time_slot, tz);
      if (requested_start_utc === null) return { blocked: { code: "TIME_INVALID", status: 400, cid } };
      if (requested_start_utc < Date.now() - 5 * 60 * 1000) {
        return { blocked: { code: "DATE_PAST", status: 400, cid } };
      }
    }
  } else if (strict) {
    return { blocked: { code: "TIME_INVALID", status: 400, cid } };
  } else if (/^(any|morning|afternoon|evening)$/i.test(time_slot)) {
    time_slot = time_slot[0].toUpperCase() + time_slot.slice(1).toLowerCase();
  } else {
    time_slot = "Any";
  }

  const services = await getShopServices(entities, auth.tenant);
  const canonicalService = matchService(services, service_type);
  if (!canonicalService) return { blocked: { code: "SERVICE_INVALID", status: 400, cid } };

  const idempotency_key = norm(body.idempotency_key);
  if (!idempotency_key) return { blocked: { code: "IDEMPOTENCY_REQUIRED", status: 400, cid } };

  const draft = {
    customer_name, customer_phone, customer_email, service_type: canonicalService,
    preferred_date, time_slot, vehicle_make, vehicle_model, vehicle_year, vehicle_plate, notes,
  };
  return { draft, requested_start_utc, tz, idempotency_key };
}

// ── Idempotent receipt handling ─────────────────────────────────────────────
async function findOrCreatePendingReceipt(entities, tenant, draft, idempotencyKey, requestedStartUtc, tz, cid) {
  const idemHash = await sha256Hex(`${tenant}|${idempotencyKey}`);
  const draftHashVal = await draftHash(tenant, draft);
  let existing = [];
  try {
    existing = await entities.WebBookingReceipt.filter(
      { shop_owner_email: tenant, idempotency_hash: idemHash }, "created_date", 5
    );
  } catch (_) {}
  const completed = existing.find((r) => r.status === "completed");
  if (completed) {
    if (completed.draft_hash !== draftHashVal) {
      return { blocked: { code: "IDEMPOTENCY_CONFLICT", status: 409, cid } };
    }
    // Replay after a lost response: rotate the receipt token.
    const receiptToken = randomToken("wbk_");
    await entities.WebBookingReceipt.update(completed.id, {
      receipt_hash: await sha256Hex(receiptToken),
    });
    return { replay: true, receiptToken, receipt: completed };
  }
  const pending = existing.find((r) => r.status === "pending");
  if (pending && new Date(pending.created_date).getTime() > Date.now() - PENDING_LOCK_MS) {
    return { blocked: { code: "IN_PROGRESS", status: 409, cid } };
  }
  if (pending) {
    await entities.WebBookingReceipt.update(pending.id, { status: "failed" });
  }
  const created = await entities.WebBookingReceipt.create({
    shop_owner_email: tenant,
    idempotency_hash: idemHash,
    draft_hash: draftHashVal,
    status: "pending",
    requested_start_utc: requestedStartUtc ? new Date(requestedStartUtc).toISOString() : "",
    requested_timezone: tz || "",
  });
  // Race guard: only the earliest pending receipt for this idempotency hash wins.
  let recheck = [];
  try {
    recheck = await entities.WebBookingReceipt.filter(
      { shop_owner_email: tenant, idempotency_hash: idemHash, status: "pending" }, "created_date", 5
    );
  } catch (_) {}
  if (recheck.length > 1 && recheck[0].id !== created.id) {
    await entities.WebBookingReceipt.update(created.id, { status: "failed" });
    return { blocked: { code: "IN_PROGRESS", status: 409, cid } };
  }
  return { replay: false, receipt: created, receiptToken: null };
}

// ── create_booking ──────────────────────────────────────────────────────────
export async function handleCreateBooking(entities, auth, body, cid) {
  const tenant = auth.tenant;
  const rl = await rateLimit(entities, auth, cid);
  if (rl.blocked) return { blocked: rl.blocked };

  const v = await validateDraft(entities, auth, body, cid);
  if (v.blocked) return { blocked: v.blocked };
  const { draft, requested_start_utc, tz, idempotency_key } = v;

  const receiptRes = await findOrCreatePendingReceipt(
    entities, tenant, draft, idempotency_key, requested_start_utc, tz, cid
  );
  if (receiptRes.blocked) return { blocked: receiptRes.blocked };

  if (receiptRes.replay) {
    const r = receiptRes.receipt;
    return {
      response: {
        success: true, booking_id: r.appointment_id || "", appointment_id: r.appointment_id || "",
        customer_id: r.customer_id || "", vehicle_id: r.vehicle_id || "",
        session_id: r.session_id || "", receipt_token: receiptRes.receiptToken,
        request_status: "request_received", replayed: true,
        message: "Booking already received. The shop will confirm your appointment and send an estimate.",
      },
    };
  }
  const receipt = receiptRes.receipt;

  // Find or create customer — phone match is ALWAYS scoped to this tenant.
  let customer = null;
  try {
    const existing = await entities.Customer.filter(
      { phone: draft.customer_phone, shop_owner_email: tenant }, "-created_date", 1
    );
    customer = existing[0] || null;
  } catch (_) {}
  if (!customer) {
    customer = await entities.Customer.create({
      full_name: draft.customer_name,
      phone: draft.customer_phone,
      email: draft.customer_email,
      shop_owner_email: tenant,
      notes: draft.notes || "",
    });
  }
  await entities.WebBookingReceipt.update(receipt.id, { customer_id: customer.id });

  // Find or create vehicle — scoped via the customer (tenant chain).
  let vehicle = null;
  let vehicles = [];
  try {
    vehicles = await entities.Vehicle.filter({ customer_id: customer.id }, "-created_date", 50);
  } catch (_) {}
  if (draft.vehicle_plate) {
    vehicle = vehicles.find((x) => norm(x.license_plate).toUpperCase() === draft.vehicle_plate) || null;
  }
  if (!vehicle) {
    vehicle = vehicles.find(
      (x) =>
        norm(x.make).toLowerCase() === draft.vehicle_make.toLowerCase() &&
        norm(x.model).toLowerCase() === draft.vehicle_model.toLowerCase() &&
        Number(x.year) === draft.vehicle_year
    ) || null;
  }
  if (!vehicle) {
    vehicle = await entities.Vehicle.create({
      customer_id: customer.id,
      customer_name: customer.full_name,
      shop_owner_email: tenant,
      make: draft.vehicle_make,
      model: draft.vehicle_model,
      year: draft.vehicle_year,
      license_plate: draft.vehicle_plate || "",
    });
  }
  await entities.WebBookingReceipt.update(receipt.id, { vehicle_id: vehicle.id });

  const vehicleInfo = [draft.vehicle_year, draft.vehicle_make, draft.vehicle_model].filter(Boolean).join(" ");

  const appointment = await entities.Appointment.create({
    customer_id: customer.id,
    customer_name: customer.full_name,
    vehicle_id: vehicle.id,
    vehicle_info: vehicleInfo,
    service_type: draft.service_type,
    date: draft.preferred_date,
    time_slot: draft.time_slot,
    notes: draft.notes || "",
    status: "scheduled",
    source: "web_booking",
    customer_phone: draft.customer_phone,
    customer_email_address: draft.customer_email,
    shop_email: tenant,
  });
  await entities.WebBookingReceipt.update(receipt.id, { appointment_id: appointment.id });

  const estimate = await entities.Estimate.create({
    estimate_number: `EST-${Date.now().toString().slice(-6)}`,
    customer_id: customer.id,
    customer_name: customer.full_name,
    vehicle_id: vehicle.id,
    vehicle_info: vehicleInfo,
    status: "draft",
    service_reason: draft.service_type + (draft.notes ? ` — ${draft.notes}` : ""),
    estimate_date: new Date().toISOString().slice(0, 10),
    notes: draft.notes || "",
  });

  const sessionId = `web_${appointment.id}`;
  const preferredDateLabel = draft.preferred_date
    ? new Date(draft.preferred_date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const bookingMessage =
    `New booking: ${draft.service_type} for ${draft.vehicle_make} ${draft.vehicle_model} ${draft.vehicle_year}.` +
    ` Preferred date: ${preferredDateLabel}. Preferred time: ${draft.time_slot}.` +
    ` Customer: ${draft.customer_name}, Phone: ${draft.customer_phone}.` +
    (draft.notes ? ` Notes: ${draft.notes}` : "");

  await entities.ChatMessage.create({
    shop_email: tenant,
    session_id: sessionId,
    sender_type: "customer",
    sender_name: draft.customer_name,
    message: bookingMessage,
    customer_name: draft.customer_name,
    customer_phone: draft.customer_phone,
    customer_email: draft.customer_email,
    vehicle_info: vehicleInfo,
    service_requested: draft.service_type,
    related_appointment_id: appointment.id,
    status: "active",
    is_read: false,
    source: "website",
  });

  const receiptToken = randomToken("wbk_");
  await entities.WebBookingReceipt.update(receipt.id, {
    status: "completed",
    session_id: sessionId,
    receipt_hash: await sha256Hex(receiptToken),
  });

  return {
    response: {
      success: true,
      booking_id: appointment.id,
      appointment_id: appointment.id,
      customer_id: customer.id,
      vehicle_id: vehicle.id,
      estimate_id: estimate.id,
      session_id: sessionId,
      receipt_token: receiptToken,
      request_status: "request_received",
      message: "Booking received. The shop will confirm your appointment and send an estimate.",
    },
  };
}

// ── Receipt-bound authorization for status / chat ───────────────────────────
// A scoped shop credential alone is NOT customer ownership: private reads and
// writes always require the opaque receipt token issued to that customer.
export async function receiptAuth(entities, tenant, rawToken, cid) {
  const token = norm(rawToken);
  if (!token) return { blocked: { code: "RECEIPT_REQUIRED", status: 401, cid } };
  const hash = await sha256Hex(token);
  let rows = [];
  try {
    rows = await entities.WebBookingReceipt.filter(
      { shop_owner_email: tenant, receipt_hash: hash }, "-created_date", 1
    );
  } catch (_) {}
  const receipt = rows[0];
  if (!receipt || receipt.status !== "completed" || !receipt.appointment_id) {
    return { blocked: { code: "RECEIPT_INVALID", status: 401, cid } };
  }
  return { appointment_id: receipt.appointment_id, session_id: receipt.session_id };
}

async function loadBookingForReceipt(entities, tenant, authz, cid) {
  const appt = await entities.Appointment.get(authz.appointment_id).catch(() => null);
  if (!appt || norm(appt.shop_email).toLowerCase() !== tenant) {
    return { blocked: { code: "BOOKING_NOT_FOUND", status: 404, cid } };
  }
  return { appt, sessionId: authz.session_id };
}

export async function handleCheckStatus(entities, auth, body, cid) {
  const tenant = auth.tenant;
  const authz = await receiptAuth(entities, tenant, body.receipt_token, cid);
  if (authz.blocked) return { blocked: authz.blocked };
  const loaded = await loadBookingForReceipt(entities, tenant, authz, cid);
  if (loaded.blocked) return { blocked: loaded.blocked };
  const appt = loaded.appt;

  let estimate = null;
  try {
    const vehicles = await entities.Vehicle.filter({ id: appt.vehicle_id }, "-created_date", 1);
    const vehicle = vehicles[0];
    if (vehicle && norm(vehicle.shop_owner_email).toLowerCase() === tenant) {
      const ests = await entities.Estimate.filter(
        { customer_id: appt.customer_id, vehicle_id: appt.vehicle_id }, "-created_date", 1
      );
      estimate = ests[0] || null;
    }
  } catch (_) {}

  const apptStatus = appt.status || "scheduled";
  const estStatus = estimate?.status || "draft";
  const src = requestStatus(apptStatus);
  let label;
  if (apptStatus === "cancelled") label = "Cancelled";
  else if (apptStatus === "completed") label = "Completed";
  else if (apptStatus === "in_progress") label = "In Progress";
  else if (apptStatus === "confirmed") label = "Booking Confirmed";
  else if (estStatus === "sent") label = "Estimate Sent";
  else if (estStatus === "approved") label = "Estimate Approved";
  else label = "Booking Received — Estimate Being Prepared";

  let unreadShopReplies = 0;
  try {
    const chatMsgs = await entities.ChatMessage.filter(
      { shop_email: tenant, session_id: authz.session_id }, "-created_date", 100
    );
    unreadShopReplies = chatMsgs.filter((m) => m.sender_type === "owner" && !m.is_read).length;
  } catch (_) {}

  return {
    response: {
      success: true,
      booking_id: appt.id,
      appointment_status: apptStatus,
      estimate_status: estStatus,
      status_label: label,
      request_status: src.request_status,
      slot_confirmed: src.slot_confirmed,
      service_type: appt.service_type,
      preferred_date: appt.date,
      chat_session_id: authz.session_id,
      unread_shop_replies: unreadShopReplies,
    },
  };
}

export async function handleSendChatMessage(entities, auth, body, cid) {
  const tenant = auth.tenant;
  const authz = await receiptAuth(entities, tenant, body.receipt_token, cid);
  if (authz.blocked) return { blocked: authz.blocked };
  const loaded = await loadBookingForReceipt(entities, tenant, authz, cid);
  if (loaded.blocked) return { blocked: loaded.blocked };
  const sessionId = authz.session_id;
  const senderName = norm(body.sender_name);
  const message = norm(body.message);
  if (!message) return { blocked: { code: "MESSAGE_REQUIRED", status: 400, cid } };

  let recent = [];
  try {
    recent = await entities.ChatMessage.filter(
      { shop_email: tenant, session_id: sessionId }, "-created_date", 100
    );
  } catch (_) {}
  const now = Date.now();
  const recentCustomerCount = recent.filter(
    (m) => m.sender_type === "customer" && new Date(m.created_date).getTime() > now - HOUR_MS
  ).length;
  if (recentCustomerCount >= RATE_LIMIT_MESSAGES_PER_HOUR) {
    return { blocked: { code: "RATE_LIMITED", status: 429, cid } };
  }

  const first = recent.find((m) => m.customer_phone || m.customer_name) || {};
  const msg = await entities.ChatMessage.create({
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
    related_appointment_id: first.related_appointment_id || "",
    status: "active",
    is_read: false,
    source: "website",
  });
  return { response: { success: true, message_id: msg.id } };
}

export async function handleGetChatMessages(entities, auth, body, cid) {
  const tenant = auth.tenant;
  const authz = await receiptAuth(entities, tenant, body.receipt_token, cid);
  if (authz.blocked) return { blocked: authz.blocked };
  const loaded = await loadBookingForReceipt(entities, tenant, authz, cid);
  if (loaded.blocked) return { blocked: loaded.blocked };
  const sessionId = authz.session_id;

  let msgs = [];
  try {
    msgs = await entities.ChatMessage.filter(
      { shop_email: tenant, session_id: sessionId }, "created_date", 200
    );
  } catch (_) {}

  const hasUnreadShop = msgs.some((m) => m.sender_type === "owner" && !m.is_read);
  if (hasUnreadShop) {
    try {
      await entities.ChatMessage.updateMany(
        { shop_email: tenant, session_id: sessionId, sender_type: "owner", is_read: false },
        { $set: { is_read: true } }
      );
    } catch (_) {}
  }

  return {
    response: {
      success: true,
      messages: msgs.map((m) => ({
        id: m.id, sender_type: m.sender_type, sender_name: m.sender_name,
        message: m.message, sent_at: m.created_date, is_read: m.is_read,
      })),
    },
  };
}

// ── resume_session: receipt-only. Phone-only resume is disabled — a phone
// number must never grant access to a customer conversation.
export async function handleResumeSession(entities, auth, body, cid) {
  if (norm(body.customer_phone) && !norm(body.receipt_token)) {
    return { blocked: { code: "PHONE_RESUME_DISABLED", status: 400, cid } };
  }
  const tenant = auth.tenant;
  const authz = await receiptAuth(entities, tenant, body.receipt_token, cid);
  if (authz.blocked) return { blocked: authz.blocked };
  const loaded = await loadBookingForReceipt(entities, tenant, authz, cid);
  if (loaded.blocked) return { blocked: loaded.blocked };
  let msgs = [];
  try {
    msgs = await entities.ChatMessage.filter(
      { shop_email: tenant, session_id: authz.session_id }, "-created_date", 1
    );
  } catch (_) {}
  const latest = msgs[0];
  if (!latest) return { response: { success: true, session_id: authz.session_id } };
  return {
    response: {
      success: true,
      session_id: authz.session_id,
      customer_name: latest.customer_name,
      vehicle_info: latest.vehicle_info,
      service_requested: latest.service_requested,
    },
  };
}

// ── Public alias resolution — allowlisted data ONLY ─────────────────────────
export async function handleResolvePublicAlias(entities, auth, cid) {
  if (auth.mode !== "alias_public" && auth.mode !== "credential") {
    // Key holders may also resolve (their key already identifies the shop).
  }
  const alias = auth.alias;
  if (!alias) return { blocked: { code: "ALIAS_UNKNOWN", status: 404, cid } };
  if (!isValidTimeZone(alias.timezone)) {
    return { blocked: { code: "ALIAS_MISCONFIGURED", status: 503, cid } };
  }
  const services = await getShopServices(entities, auth.tenant);
  return {
    response: {
      success: true,
      shop_name: alias.display_name || "",
      services,
      timezone: alias.timezone,
      country: alias.country,
      // No shop_owner_email, no internal IDs, no API keys — by design.
    },
  };
}

// get_shop_services — available to key and credential modes.
export async function handleGetShopServices(entities, auth, cid) {
  if (auth.mode === "alias_public") {
    return { blocked: { code: "AUTH_REQUIRED", status: 401, cid } };
  }
  const alias = auth.alias;
  const services = await getShopServices(entities, auth.tenant);
  const key = auth.key;
  const out = { success: true, services };
  if (alias) out.shop_name = alias.display_name || "";
  else if (key) out.shop_name = key.shop_name || "";
  return { response: out };
}