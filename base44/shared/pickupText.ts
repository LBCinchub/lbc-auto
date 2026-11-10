// "Text Ready For Pickup": ONE on-demand plain SMS for one repair order, to THAT order's own customer.
// - Only ever sent by an explicit staff Send. Never from a status change, never automatically retried.
// - Browser sends only {repair_order_id, body, idempotency_key, resume}. Shop, role, order, customer,
//   phone and vehicle are resolved here from the verified session; the body is untrusted text.
// - Logged in DocumentDelivery (document_type "repair_order", channel "sms") with the Twilio message id;
//   provider acceptance ("queued"/"sent") is never shown as delivered.
// - Reads only. Never writes repair orders, invoices, payments or customers.
// - Not part of the Pro-only estimate/invoice document texting entitlement.
import { resolveStaffScope, owned } from "./staffAssistant/scope.ts";
import { sha256Hex, setStatus, statusFromTwilio, errorText } from "./documentDelivery.ts";
import { groupView, latestTextGroup, TEXT_ACTIVE } from "./documentTextDelivery.ts";
import { smsInfo, hasLink, publicShop } from "./documentText.ts";
import { toE164, isNanpMobileFormat, maskPhone } from "./phone.ts";

export const PICKUP_FOOTER = "Reply STOP To Opt Out.";
export const PICKUP_MAX_SEGMENTS = 3;
export const PICKUP_ROLES = ["owner", "staff"];          // technicians never message customers
export const READY_STATUS = "completed";                 // existing RO status meaning "ready"
export const COOLDOWN_MS = 10 * 60 * 1000;               // one pickup text per order per 10 minutes
export const SHOP_HOURLY_LIMIT = 30;
const ACCEPTED = ["queued", "sending", "sent", "delivered"];
const OPTED_OUT = "21610";

const s = (v) => (v == null ? "" : String(v).trim());
const one = (v) => s(v).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const getOrNull = (api, id) => api.get(id).catch((e) => (e?.status === 404 ? null : Promise.reject(e)));
const fail = (status, error, code) => ({ status, error, code });
const formatPhone = (e164) => { const d = e164.replace(/\D/g, "").slice(-10); return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`; };

export function vehicleLabel(vehicle, order) {
  const fromRecord = vehicle ? one([vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ")) : "";
  return (fromRecord || one(order?.vehicle_info)).replace(/\b[A-HJ-NPR-Z0-9]{17}\b/gi, "").trim().slice(0, 40);
}

// Suggested text from real saved fields only; missing optional fields drop out with their words.
export function pickupTemplate({ customer, vehicle, order, shop }) {
  const first = one(customer?.full_name).split(" ")[0].replace(/[^\p{L}'-]/gu, "").slice(0, 30);
  const car = vehicleLabel(vehicle, order);
  const ro = one(order?.order_number).replace(/[^A-Za-z0-9-]/g, "");
  return [
    `Hi${first ? ` ${first}` : ""}, Your ${car || "Vehicle"} Is Ready For Pickup At ${shop.name}.`,
    ro && `Repair Order: ${ro}.`,
    shop.address && `${shop.address.replace(/\.$/, "")}.`,
    shop.phone && `Questions? Call ${shop.phone}.`,
  ].filter(Boolean).join(" ");
}

// Staff-edited body is untrusted: plain text only, no links, emails, money amounts or codes.
export function checkBody(raw) {
  const body = s(raw).replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!body) return { error: "Write A Message Before Sending.", code: "empty_body" };
  if (hasLink(body)) return { error: "Remove Links From The Message. Pickup Texts Never Include Links.", code: "link_in_body" };
  if (/[^\s@]+@[^\s@]+\.[^\s@]+/.test(body)) return { error: "Remove Email Addresses From The Message.", code: "email_in_body" };
  if (/\$\s?\d|\d\s?\$/.test(body)) return { error: "Remove Prices Or Amounts. Pickup Texts Never Include Costs.", code: "money_in_body" };
  if (/\b[A-HJ-NPR-Z0-9]{17}\b/i.test(body)) return { error: "Remove The VIN From The Message.", code: "vin_in_body" };
  const full = `${body}\n${PICKUP_FOOTER}`;
  const info = smsInfo(full);
  if (info.segments > PICKUP_MAX_SEGMENTS) return { error: `Message Is Too Long (${info.segments} Text Segments). Keep It To ${PICKUP_MAX_SEGMENTS} Or Fewer.`, code: "too_long", info };
  return { body, full, info };
}

// Order, its own customer, phone, vehicle and the verified sending shop. Unknown/foreign ids look identical.
export async function resolvePickup(db, user, orderId, now) {
  let scope;
  try { scope = resolveStaffScope(user, now); } catch (e) { return fail(e.status || 403, e.message, e.code || "forbidden"); }
  if (!PICKUP_ROLES.includes(scope.role)) return fail(403, "Your Role Can't Text Customers.", "forbidden_role");
  const shop = publicShop(user);
  if (!shop.name) return fail(422, "Add Your Shop Name In Settings Before Texting Customers.", "shop_unresolved");
  const id = s(orderId);
  const order = id ? await getOrNull(db.RepairOrder, id) : null;
  if (!order || !owned(order, scope)) return fail(404, "Repair Order Not Found In This Shop.", "not_found");
  const customer = order.customer_id ? await getOrNull(db.Customer, order.customer_id) : null;
  if (!customer || !owned(customer, scope)) return fail(404, "This Repair Order's Customer Isn't In This Shop.", "customer_not_found");
  const v = order.vehicle_id ? await getOrNull(db.Vehicle, order.vehicle_id) : null;
  const vehicle = v && v.customer_id === customer.id && owned(v, scope) ? v : null;
  const out = { scope, shop, order, customer, vehicle, number: one(order.order_number) };
  const digits = s(customer.phone).replace(/\D/g, "");
  if (digits.length < 10) return { ...out, blocker: "This Customer Has No Phone Number On File. Add One To Their Profile First.", blocker_code: "no_phone" };
  const phone = toE164(customer.phone);
  if (!isNanpMobileFormat(phone)) return { ...out, blocker: "Pickup Texts Can Only Go To US Or Canadian Phone Numbers. Check The Customer's Saved Number.", blocker_code: "invalid_phone" };
  out.phone = phone;
  const stops = (await db.DocumentDelivery.filter({ shop_owner_email: scope.tenant, customer_id: customer.id, error_code: OPTED_OUT }, "-created_date", 1)) || [];
  if (stops.length) return { ...out, blocker: "This Customer Replied STOP To Texts From This Number. Contact Them Another Way.", blocker_code: "opted_out" };
  if (order.status === "delivered") return { ...out, blocker: "This Repair Order Is Already Marked Delivered (Picked Up).", blocker_code: "already_delivered" };
  if (order.status !== READY_STATUS) return { ...out, blocker: "Mark This Repair Order Completed First. Pickup Texts Are Only For Completed Work.", blocker_code: "not_ready" };
  return out;
}

const rowsFor = async (db, tenant, orderId) =>
  ((await db.DocumentDelivery.filter({ shop_owner_email: tenant, document_id: orderId, channel: "sms" }, "-created_date", 200)) || []).filter((r) => r.status !== "duplicate");
const order = (a, b) => String(a.requested_at).localeCompare(String(b.requested_at)) || String(a.id).localeCompare(String(b.id));

// Read-only preview for the dialog. The template is a suggestion; nothing is stored.
export async function preparePickup(deps, input) {
  const { db, user, now = Date.now } = deps;
  const r = await resolvePickup(db, user, input.repair_order_id, now());
  if (r.error) return r;
  return {
    status: 200, repair_order_number: r.number, order_status: r.order.status || "", customer_name: one(r.customer.full_name),
    to: r.phone ? formatPhone(r.phone) : "", to_masked: r.phone ? maskPhone(r.phone) : "", vehicle: vehicleLabel(r.vehicle, r.order),
    shop: { name: r.shop.name, phone: r.shop.phone, address: r.shop.address }, template: pickupTemplate(r), footer: PICKUP_FOOTER,
    max_segments: PICKUP_MAX_SEGMENTS, blocker: r.blocker || "", blocker_code: r.blocker_code || "",
    latest: await latestTextGroup(db, r.scope.tenant, r.order.id),
  };
}

// deps: { db, user, now, callbackUrl, twilio: { smsCheck(), sendSms({to, body, statusCallback}) } }
export async function sendPickup(deps, input) {
  const { db, user, now = Date.now, twilio } = deps;
  const key = s(input.idempotency_key);
  const resume = input.resume === true;
  if (!/^[\w-]{8,64}$/.test(key)) return fail(400, "Missing Send Reference. Close And Reopen The Window.", "no_key");
  const r = await resolvePickup(db, user, input.repair_order_id, now());
  if (r.error) return r;
  if (r.blocker) return fail(422, `${r.blocker} Nothing Was Sent.`, r.blocker_code);
  const checked = checkBody(input.body);
  if (checked.error) return fail(422, `${checked.error} Nothing Was Sent.`, checked.code);
  const tenant = r.scope.tenant;
  const hash = await sha256Hex(checked.full);

  const rows = await rowsFor(db, tenant, r.order.id);
  const mine = rows.filter((x) => x.group_key === key);
  if (mine.length && mine.some((x) => x.body_sha256 !== hash)) return fail(409, "This Send Already Used Different Text. Close And Reopen The Window To Send New Text. Nothing Was Sent.", "body_changed");
  if (mine.length && !resume) return { status: 200, group: groupView(rows, key), repeated: true };
  if (resume && !mine.length) return fail(400, "Nothing To Retry. Send The Text First.", "nothing_to_retry");
  let attempt = 1;
  if (resume) {
    const view = groupView(rows, key);
    if (!view.can_resume) return { status: 200, group: view, repeated: true };
    attempt = view.parts[0].attempt + 1;
  }
  const t = now();
  const others = rows.filter((x) => x.group_key !== key);
  if (others.some((x) => TEXT_ACTIVE.includes(x.status) && Date.parse(x.requested_at) >= t - COOLDOWN_MS)) {
    return fail(409, "Another Text For This Repair Order Is Still Sending Or Unconfirmed. Wait For It To Finish. Nothing Was Sent.", "in_flight");
  }
  if (others.some((x) => ACCEPTED.includes(x.status) && Date.parse(x.requested_at) >= t - COOLDOWN_MS)) {
    return fail(429, "A Pickup Text For This Repair Order Was Sent In The Last 10 Minutes. Nothing Was Sent.", "cooldown");
  }
  const hourAgo = new Date(t - 3600e3).toISOString();
  const recent = ((await db.DocumentDelivery.filter({ shop_owner_email: tenant, document_type: "repair_order", channel: "sms" }, "-created_date", SHOP_HOURLY_LIMIT + 1)) || [])
    .filter((x) => x.status !== "duplicate" && String(x.requested_at) >= hourAgo);
  if (recent.length >= SHOP_HOURLY_LIMIT) return fail(429, "Too Many Pickup Texts In The Last Hour. Try Again Later. Nothing Was Sent.", "rate_limited");

  const sender = await twilio.smsCheck();
  if (!sender.ok) return fail(503, `${sender.reason} The Text Was Not Sent.`, "sender_unavailable");

  const stamp = new Date(t).toISOString();
  const rec = await db.DocumentDelivery.create({
    shop_owner_email: tenant, shop_user_id: r.scope.userId, sent_by_email: s(user.email).toLowerCase(), document_type: "repair_order",
    document_id: r.order.id, document_number: r.number, customer_id: r.customer.id, to_masked: maskPhone(r.phone), channel: "sms",
    purpose: "pickup_ready", status: "preparing", idempotency_key: `${key}-p1-a${attempt}`, group_key: key, part_index: 1, part_count: 1,
    attempt, segments: checked.info.segments, encoding: checked.info.encoding, body_sha256: hash, callback_url: deps.callbackUrl,
    requested_at: stamp, status_updated_at: stamp,
  });
  // Double clicks / racing requests: the earliest row for this exact attempt wins; others send nothing.
  const after = await rowsFor(db, tenant, r.order.id);
  const lead = after.filter((x) => x.idempotency_key === rec.idempotency_key).sort(order)[0];
  const rival = !resume && after.filter((x) => x.group_key !== key && TEXT_ACTIVE.includes(x.status) && Date.parse(x.requested_at) >= t - COOLDOWN_MS).sort(order)[0];
  if (lead.id !== rec.id || (rival && order(rival, rec) < 0)) {
    await db.DocumentDelivery.update(rec.id, { status: "duplicate", status_updated_at: stamp });
    if (rival && lead.id === rec.id) return fail(409, "Another Text For This Repair Order Is Already Sending. Nothing Was Sent.", "in_flight");
    return { status: 200, group: groupView(await rowsFor(db, tenant, r.order.id), key), repeated: true };
  }

  const res = await twilio.sendSms({ to: r.phone, body: checked.full, statusCallback: deps.callbackUrl });
  if (res.ok) await setStatus(db, rec, { status: statusFromTwilio(res.data?.status) || "queued", message_sid: s(res.data?.sid) }, now);
  else if (res.unknown) await setStatus(db, rec, { status: "unknown", error_code: "no_answer", error_message: "Twilio Didn't Answer In Time, So This Text May Or May Not Have Been Sent. It Will Not Be Resent Automatically. Check With The Customer Before Sending Again." }, now);
  else {
    const code = res.data?.code;
    await setStatus(db, rec, { status: "failed", error_code: code ? String(code) : `http_${res.status}`, error_message: errorText(code, res.data?.message) || "Twilio Did Not Accept This Text. It Was Not Sent." }, now);
  }
  return { status: 200, group: groupView(await rowsFor(db, tenant, r.order.id), key) };
}