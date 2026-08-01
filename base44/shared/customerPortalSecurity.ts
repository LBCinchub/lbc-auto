import { secrets } from "base44:runtime";
import { listAllRecords } from "./entityPagination.ts";
import { classifyRelatedOwnership } from "./legacyPortalMigration.ts";
import { normalizePortalTenant } from "./portalIdentity.ts";

export const GENERIC_AUTH_ERROR = "Invalid credentials or access unavailable";
const PASSCODE_ITERATIONS = 100000;
const encoder = new TextEncoder();

export const normalizeTenantEmail = normalizePortalTenant;

export function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 ? digits : "";
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return bytesToHex(data);
}

export function randomActivationCode() {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return String(100000 + (data[0] % 900000));
}

export async function sha256(value) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value)))));
}

export async function hashPasscode(passcode, salt = randomToken(16)) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(String(passcode)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSCODE_ITERATIONS }, key, 256);
  return { hash: bytesToHex(new Uint8Array(bits)), salt };
}

function constantTimeEqual(a, b) {
  const left = encoder.encode(String(a));
  const right = encoder.encode(String(b));
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) mismatch |= (left[i % left.length] || 0) ^ (right[i % right.length] || 0);
  return mismatch === 0;
}

export async function verifyPasscode(passcode, salt, expectedHash) {
  const result = await hashPasscode(passcode, salt);
  return constantTimeEqual(result.hash, expectedHash);
}

export function validateNewPasscode(passcode) {
  const value = String(passcode || "");
  if (!/^\d{6,12}$/.test(value)) return false;
  if (/^(\d)\1+$/.test(value)) return false;
  const sequences = "01234567890123456789 98765432109876543210";
  if (sequences.includes(value)) return false;
  if (/^(\d{2,3})\1+$/.test(value)) return false;
  return true;
}

export function getRequestMeta(req) {
  const forwarded = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
  return {
    ip: forwarded.split(",")[0].trim().slice(0, 128),
    userAgent: (req.headers.get("user-agent") || "").slice(0, 512),
  };
}

export function getBearerToken(req) {
  const cookie = req.headers.get("cookie") || "";
  const cookieMatch = cookie.match(/(?:^|;\s*)lbc_customer_session=([^;]+)/);
  if (cookieMatch) return decodeURIComponent(cookieMatch[1]);
  const auth = req.headers.get("authorization") || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function auditEvent(sr, req, eventType, details = {}) {
  const meta = getRequestMeta(req);
  const payload = {
    event_type: eventType,
    shop_owner_email: normalizeTenantEmail(details.shopOwnerEmail) || "unknown@invalid.local",
    created_at: new Date().toISOString(),
    metadata: details.metadata || {},
  };
  if (details.customerId) payload.customer_id = details.customerId;
  if (details.sessionId) payload.session_id = details.sessionId;
  if (meta.ip) payload.ip = meta.ip;
  if (meta.userAgent) payload.user_agent = meta.userAgent;
  await sr.entities.CustomerSecurityEvent.create(payload);
}

export async function customerIsQuarantined(sr, customerId) {
  if (!customerId) return false;
  const records = await sr.entities.PortalOwnershipQuarantine.filter({ customer_id: customerId, active: true }, "-created_at", 1);
  return records.length > 0;
}

export async function assertCustomerNotQuarantined(sr, customerId) {
  if (await customerIsQuarantined(sr, customerId)) throw new Error("CUSTOMER_HARD_QUARANTINED");
}

export async function resolveCustomerFromEvidence(sr, req, customer, evidence, actorEmail) {
  const tenant = normalizeTenantEmail(evidence.supported_tenant);
  if (!tenant || evidence.tenants.length !== 1 || evidence.relationship_conflicts.length) throw new Error("AUTHORITATIVE_EVIDENCE_REQUIRED");
  await sr.entities.Customer.update(customer.id, { shop_owner_email: tenant });
  const active = await sr.entities.PortalOwnershipResolution.filter({ customer_id: customer.id, active: true }, "-resolved_at", 50);
  if (active.length) await sr.entities.PortalOwnershipResolution.bulkUpdate(active.map((item) => ({ id: item.id, active: false })));
  await sr.entities.PortalOwnershipResolution.create({ customer_id: customer.id, resolved_tenant: tenant, resolution_type: "relationship_evidence", resolved_by: normalizeTenantEmail(actorEmail), resolved_at: new Date().toISOString(), active: true });
  const quarantines = await sr.entities.PortalOwnershipQuarantine.filter({ customer_id: customer.id, active: true }, "-created_at", 50);
  if (quarantines.length) await sr.entities.PortalOwnershipQuarantine.bulkUpdate(quarantines.map((item) => ({ id: item.id, active: false, reviewed_at: new Date().toISOString() })));
  await auditEvent(sr, req, "ownership_resolved", { customerId: customer.id, shopOwnerEmail: tenant, metadata: { action: "relationship_evidence", evidence: evidence.evidence_summary } });
  return tenant;
}

export async function hardQuarantineCustomer(sr, req, customerId, reason, evidenceSummary, actorEmail, reviewNotes = "") {
  const now = new Date().toISOString();
  const active = await sr.entities.PortalOwnershipQuarantine.filter({ customer_id: customerId, active: true }, "-created_at", 50);
  const payload = { reason, evidence_summary: evidenceSummary, active: true, reviewed_at: null, review_notes: String(reviewNotes || "").slice(0, 1000) || null };
  if (active.length) {
    await sr.entities.PortalOwnershipQuarantine.update(active[0].id, payload);
    if (active.length > 1) await sr.entities.PortalOwnershipQuarantine.bulkUpdate(active.slice(1).map((item) => ({ id: item.id, active: false, reviewed_at: now })));
  } else await sr.entities.PortalOwnershipQuarantine.create({ customer_id: customerId, ...payload, created_at: now, created_by_admin: normalizeTenantEmail(actorEmail) });
  const [sessions, passcodes] = await Promise.all([listAllRecords(sr.entities.CustomerPortalSession, { customer_id: customerId, revoked: false }), listAllRecords(sr.entities.CustomerPasscode, { customer_id: customerId })]);
  if (sessions.length) await sr.entities.CustomerPortalSession.bulkUpdate(sessions.map((item) => ({ id: item.id, revoked: true, revoked_at: now })));
  const enabled = passcodes.filter((item) => item.portal_access_enabled !== false);
  if (enabled.length) await sr.entities.CustomerPasscode.bulkUpdate(enabled.map((item) => ({ id: item.id, portal_access_enabled: false, updated_at: now })));
  await auditEvent(sr, req, "authorization_denied", { customerId, shopOwnerEmail: normalizeTenantEmail(actorEmail), metadata: { action: "hard_quarantine", reason } });
  return { sessions_revoked: sessions.length, passcodes_disabled: enabled.length };
}

export async function assertCustomerTenantOwnership(sr, customerId, tenantEmail) {
  const tenant = normalizeTenantEmail(tenantEmail);
  if (!customerId || !tenant) throw new Error("AUTHORIZATION_DENIED");
  await assertCustomerNotQuarantined(sr, customerId);
  const customer = await sr.entities.Customer.get(customerId);
  if (!customer) throw new Error("AUTHORIZATION_DENIED");
  const explicit = normalizeTenantEmail(customer.shop_owner_email);
  let creator = normalizeTenantEmail(customer.created_by);
  if (!creator && customer.created_by_id) {
    const creatorUser = await sr.entities.User.get(customer.created_by_id);
    const isShopProfile = creatorUser && (creatorUser.business_name || creatorUser.subscription_status || creatorUser.trial_started_date || creatorUser.setup_fee_paid || creatorUser.plan_tier);
    if (isShopProfile) creator = normalizeTenantEmail(creatorUser.email);
  }
  let owner = explicit || creator;
  if (explicit && creator && explicit !== creator) {
    const resolutions = await sr.entities.PortalOwnershipResolution.filter({ customer_id: customerId, resolved_tenant: tenant, active: true }, "-resolved_at", 2);
    if (resolutions.length !== 1) throw new Error("AUTHORIZATION_DENIED");
    owner = normalizeTenantEmail(resolutions[0].resolved_tenant);
  }
  if (!owner || owner !== tenant) throw new Error("AUTHORIZATION_DENIED");
  return customer;
}

export async function findTenantCustomersByPhone(sr, tenantEmail, phone) {
  const tenant = normalizeTenantEmail(tenantEmail);
  const normalizedPhone = normalizePhone(phone);
  if (!tenant || !normalizedPhone) return [];
  const tenantUsers = await sr.entities.User.filter({ email: tenant }, null, 10);
  const creatorIds = tenantUsers.map((user) => user.id);
  const [explicit, legacyEmail, legacyId] = await Promise.all([
    listAllRecords(sr.entities.Customer, { shop_owner_email: tenant }, "-created_date"),
    listAllRecords(sr.entities.Customer, { created_by: tenant }, "-created_date"),
    creatorIds.length ? listAllRecords(sr.entities.Customer, { created_by_id: { $in: creatorIds } }, "-created_date") : [],
  ]);
  const unique = new Map([...explicit, ...legacyEmail, ...legacyId].map((customer) => [customer.id, customer]));
  const matches = [];
  for (const customer of unique.values()) {
    if (normalizePhone(customer.phone) !== normalizedPhone) continue;
    try {
      await assertCustomerTenantOwnership(sr, customer.id, tenant);
      matches.push(customer);
    } catch {
      continue;
    }
  }
  return matches;
}

export function sessionIsActive(session, now = Date.now()) {
  return Boolean(session && !session.revoked && new Date(session.expires_at).getTime() > now);
}

export async function requireCustomerSession(base44, req) {
  const token = getBearerToken(req);
  if (!token) throw new Error("SESSION_REQUIRED");
  const sr = base44.asServiceRole;
  const tokenHash = await sha256(token);
  const sessions = await sr.entities.CustomerPortalSession.filter({ token_hash: tokenHash }, "-created_at", 2);
  if (sessions.length !== 1) throw new Error("SESSION_REQUIRED");
  const session = sessions[0];
  if (!sessionIsActive(session)) throw new Error("SESSION_REQUIRED");
  const passcodes = await sr.entities.CustomerPasscode.filter({ customer_id: session.customer_id, shop_owner_email: session.shop_owner_email }, "-updated_at", 2);
  if (passcodes.length !== 1 || passcodes[0].portal_access_enabled === false) throw new Error("SESSION_REQUIRED");
  const customer = await assertCustomerTenantOwnership(sr, session.customer_id, session.shop_owner_email);
  await sr.entities.CustomerPortalSession.update(session.id, { last_validated_at: new Date().toISOString() });
  return { sr, session, customer };
}

export async function revokeSessions(sr, customerId, tenantEmail, exceptSessionId = "") {
  const sessions = await sr.entities.CustomerPortalSession.filter({ customer_id: customerId, shop_owner_email: normalizeTenantEmail(tenantEmail), revoked: false }, "-created_at", 500);
  const now = new Date().toISOString();
  const updates = sessions.filter((item) => item.session_id !== exceptSessionId).map((item) => ({ id: item.id, revoked: true, revoked_at: now }));
  if (updates.length) await sr.entities.CustomerPortalSession.bulkUpdate(updates);
  return updates.length;
}

export async function issueSession(sr, req, customerId, tenantEmail) {
  await assertCustomerNotQuarantined(sr, customerId);
  const token = randomToken(32);
  const sessionId = randomToken(24);
  const now = new Date();
  const meta = getRequestMeta(req);
  await sr.entities.CustomerPortalSession.create({
    session_id: sessionId,
    token_hash: await sha256(token),
    customer_id: customerId,
    shop_owner_email: normalizeTenantEmail(tenantEmail),
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString(),
    revoked: false,
    ip: meta.ip,
    user_agent: meta.userAgent,
    last_validated_at: now.toISOString(),
  });
  return { token, sessionId, expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString() };
}

export async function sendActivationSms(phone, code, shopName) {
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  const authToken = secrets.get("TWILIO_AUTH_TOKEN");
  const serviceSid = secrets.get("TWILIO_MESSAGING_SERVICE_SID");
  if (!sid || !authToken || !serviceSid) return false;
  const form = new URLSearchParams({ To: `+1${normalizePhone(phone)}`, MessagingServiceSid: serviceSid, Body: `${shopName || "Your auto shop"} portal activation code: ${code}. It expires in 10 minutes.` });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${btoa(`${sid}:${authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  return response.ok;
}

export function projectSafeRecord(record, keys) {
  const result = {};
  for (const key of keys) if (record?.[key] !== undefined) result[key] = record[key];
  return result;
}

function pick(record, keys) {
  return projectSafeRecord(record, keys);
}

export async function buildCustomerPortalData(sr, customer, tenantEmail) {
  const tenant = normalizeTenantEmail(tenantEmail);
  const customerId = customer.id;
  const [vehiclesRaw, tenantUsers] = await Promise.all([listAllRecords(sr.entities.Vehicle, { customer_id: customerId }), sr.entities.User.filter({ email: tenant }, null, 10)]);
  const ownership = new Map([[customerId, { status: "safe", tenant }]]);
  const baseContext = { Customer: new Map([[customerId, customer]]), Vehicle: new Map(vehiclesRaw.map((row) => [row.id, row])), RepairOrder: new Map(), Estimate: new Map(), Invoice: new Map(), UserById: new Map(tenantUsers.map((user) => [user.id, tenant])) };
  const vehicles = vehiclesRaw.filter((record) => ["safe", "backfill"].includes(classifyRelatedOwnership("Vehicle", record, baseContext, ownership).status));
  const vehicleIds = vehicles.map((item) => item.id);
  const relatedQuery = (extra = []) => ({ $or: [{ customer_id: customerId }, ...(vehicleIds.length ? [{ vehicle_id: { $in: vehicleIds } }] : []), ...extra] });
  const [ordersRaw, estimatesRaw, appointmentsRaw, messagesRaw, notificationsRaw, recommendationsRaw, reviewsRaw, diagnosticsInitial] = await Promise.all([
    listAllRecords(sr.entities.RepairOrder, relatedQuery()),
    listAllRecords(sr.entities.Estimate, relatedQuery()),
    listAllRecords(sr.entities.Appointment, relatedQuery(), "date"),
    listAllRecords(sr.entities.CustomerMessage, { customer_id: customerId }, "sent_at"),
    listAllRecords(sr.entities.CustomerNotification, { customer_id: customerId }, "sent_at"),
    listAllRecords(sr.entities.CarRecommendation, relatedQuery()),
    listAllRecords(sr.entities.CustomerReview, { customer_id: customerId }),
    listAllRecords(sr.entities.DiagnosticScan, relatedQuery(), "scan_timestamp"),
  ]);
  const estimateIds = estimatesRaw.map((item) => item.id);
  const ordersLinked = estimateIds.length ? await listAllRecords(sr.entities.RepairOrder, { estimate_id: { $in: estimateIds } }) : [];
  const allOrdersRaw = [...ordersRaw, ...ordersLinked];
  const orderIds = allOrdersRaw.map((item) => item.id);
  const invoiceExtra = [...(orderIds.length ? [{ repair_order_id: { $in: orderIds } }] : []), ...(estimateIds.length ? [{ estimate_id: { $in: estimateIds } }] : [])];
  const invoicesRaw = await listAllRecords(sr.entities.Invoice, relatedQuery(invoiceExtra));
  const invoiceIds = invoicesRaw.map((item) => item.id);
  const diagnosticExtra = [...(orderIds.length ? [{ repair_order_id: { $in: orderIds } }] : []), ...(estimateIds.length ? [{ estimate_id: { $in: estimateIds } }] : [])];
  const diagnosticsLinked = diagnosticExtra.length ? await listAllRecords(sr.entities.DiagnosticScan, { $or: diagnosticExtra }, "scan_timestamp") : [];
  const unique = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];
  const context = { ...baseContext, RepairOrder: new Map(allOrdersRaw.map((row) => [row.id, row])), Estimate: new Map(estimatesRaw.map((row) => [row.id, row])), Invoice: new Map(invoicesRaw.map((row) => [row.id, row])) };
  const safe = (name, rows) => unique(rows).filter((record) => {
    const result = classifyRelatedOwnership(name, record, context, ownership);
    return ["safe", "backfill"].includes(result.status) && result.customerId === customerId;
  });
  const orders = safe("RepairOrder", allOrdersRaw);
  const estimates = safe("Estimate", estimatesRaw);
  const invoices = safe("Invoice", invoicesRaw);
  const appointments = safe("Appointment", appointmentsRaw);
  const messages = safe("CustomerMessage", messagesRaw);
  const notifications = safe("CustomerNotification", notificationsRaw);
  const recommendations = safe("CarRecommendation", recommendationsRaw);
  const reviews = safe("CustomerReview", reviewsRaw);
  const diagnostics = safe("DiagnosticScan", [...diagnosticsInitial, ...diagnosticsLinked]);
  const offers = await listAllRecords(sr.entities.ShopOffer, { shop_owner_email: tenant, is_active: true });
  const shop = tenantUsers[0] || {};
  return {
    customer: pick(customer, ["id", "full_name"]),
    shop: pick(shop, ["business_name", "phone", "address", "city", "province", "logo_url", "google_review_link"]),
    vehicles: vehicles.map((v) => pick(v, ["id", "customer_id", "year", "make", "model", "trim", "vin", "license_plate", "engine_type", "fuel_type", "drive_type", "color", "mileage", "mileage_history", "intake_photos", "last_service_date"])),
    orders: orders.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "estimate_id", "order_number", "vehicle_info", "description", "status", "estimated_completion", "created_date"])),
    invoices: invoices.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "repair_order_id", "estimate_id", "invoice_number", "vehicle_info", "total", "amount_paid", "balance_due", "status", "due_date", "paid_date", "customer_note", "payment_history", "line_items", "created_date"])),
    estimates: estimates.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "linked_invoice_id", "linked_invoice_number", "estimate_number", "vehicle_info", "status", "auth_status", "grand_total", "amount_paid", "payment_history", "valid_until", "service_reason", "labor_items", "parts_items", "created_date"])),
    appointments: appointments.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "vehicle_info", "service_type", "date", "time_slot", "status", "created_date"])),
    messages: messages.map((r) => pick(r, ["id", "customer_id", "sender", "message", "read_by_customer", "read_by_shop", "sent_at"])),
    notifications: notifications.map((r) => pick(r, ["id", "customer_id", "type", "title", "body", "is_read", "action_url", "sent_at"])),
    offers: offers.map((r) => ({ ...pick(r, ["id", "shop_name", "title", "description", "image_url", "valid_until", "reactions", "created_date"]), comments: (r.comments || []).map((c) => pick(c, ["customer_name", "text", "created_at"])) })),
    recommendations: recommendations.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "vehicle_info", "title", "description", "urgency", "estimated_cost", "is_resolved", "created_date"])),
    reviews: reviews.map((r) => pick(r, ["id", "customer_id", "rating", "review_text", "is_published", "shop_reply", "shop_replied_at", "created_date"])),
    diagnostics: diagnostics.map((r) => pick(r, ["id", "customer_id", "vehicle_id", "repair_order_id", "estimate_id", "vehicle_info", "scan_timestamp", "dtc_codes", "status", "created_date"])),
  };
}