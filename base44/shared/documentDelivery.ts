// Texts ONE saved estimate/invoice to ITS customer as a PDF attachment (Twilio MMS).
// - The browser sends only {document_type, document_id}; the shop, document, customer and phone are
//   all resolved here from the signed-in shop and verified ownership. Unknown/foreign IDs look identical.
// - The PDF is stored privately; Twilio fetches it through documentMedia with a single-delivery,
//   unguessable, expiring token (only its SHA-256 is stored). The token is revoked once Twilio is done.
// - Never touches financial records: no totals, approval, payment or link fields are written.
// - "Delivered" is shown only when Twilio reports delivered (signed callback or a status read).
import { ownsRecord } from "./shopStripe.ts";
import { toE164, isNanpMobileFormat, maskPhone } from "./phone.ts";

export const ENTITY = { estimate: "Estimate", invoice: "Invoice" };
export const MEDIA_TTL_MS = 60 * 60 * 1000;          // Twilio fetches at send time; 1h covers its retries
export const MAX_PDF_BYTES = 4_500_000;              // Twilio MMS limit is 5 MB combined
export const IN_FLIGHT_WINDOW_MS = 10 * 60 * 1000;
const IN_FLIGHT = ["preparing", "queued", "sending"];
// unknown = Twilio's answer never arrived (may or may not be sent); not_sent = stopped before sending.
const RANK = { preparing: 0, queued: 1, sending: 2, sent: 3, delivered: 4, undelivered: 4, failed: 4, canceled: 4, duplicate: 4, unknown: 4, not_sent: 4 };
export const isFinal = (status) => RANK[status] === 4;
const MEDIA_DONE = ["sent", "delivered", "undelivered", "failed", "canceled", "duplicate"];

const enc = new TextEncoder();
const lower = (v) => String(v || "").trim().toLowerCase();
const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
export const sha256Hex = async (data) => toHex(await crypto.subtle.digest("SHA-256", typeof data === "string" ? enc.encode(data) : data));
export const newMediaToken = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const safeEqual = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
const getOrNull = (api, id) => api.get(id).catch((e) => (e?.status === 404 ? null : Promise.reject(e)));

// ASCII, <= 20 characters including ".pdf" (Twilio/handset friendly).
export function pdfFileName(type, number) {
  const base = String(number || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 16) || (type === "invoice" ? "Invoice" : "Estimate");
  return `${base}.pdf`;
}

// Customer text: shop identity + what's attached. Never a link of any kind.
const URLISH = /(https?:\/\/\S*|www\.\S*|\b[\w-]+(\.[\w-]+)*\.(com|ca|net|org|app|tech|io|co|ly|link|me|biz|info|us)\b\S*)/gi;
export const containsUrl = (text) => new RegExp(URLISH.source, "i").test(String(text || ""));
export function messageBody(shopName, type, number) {
  const shop = String(shopName || "").replace(URLISH, "").replace(/\s+/g, " ").trim().slice(0, 60) || "Your auto shop";
  const ref = String(number || "").replace(/[^A-Za-z0-9-]/g, "");
  return `${shop}: Your ${type === "invoice" ? "invoice" : "estimate"}${ref ? ` ${ref}` : ""} is attached as a PDF. Reply STOP to opt out.`;
}

export function statusFromTwilio(s) {
  const v = lower(s);
  if (["accepted", "scheduled", "queued"].includes(v)) return "queued";
  if (v === "sending") return "sending";
  if (v === "sent") return "sent";
  if (v === "delivered" || v === "read") return "delivered";
  if (v === "undelivered") return "undelivered";
  if (v === "failed") return "failed";
  if (v === "canceled") return "canceled";
  return "";
}
// Status only moves forward; a late "sent" can never overwrite "delivered" or a failure.
export const nextStatus = (current, incoming) => (incoming && !isFinal(current) && (RANK[incoming] ?? -1) > (RANK[current] ?? -1) ? incoming : current);

const ERRORS = {
  21610: "The customer has opted out of texts from this number (they replied STOP). Nothing was sent.",
  21606: "The shop's Twilio number can't send this message type. Nothing was sent.",
  21612: "Twilio can't route a message from the shop's number to this customer's number.",
  21614: "The customer's number isn't a mobile number that can receive texts.",
  21408: "Texting to this region isn't enabled on the shop's Twilio account.",
  21211: "The customer's phone number is not valid.",
  11200: "Twilio couldn't download the PDF attachment.",
  11751: "The PDF is larger than this phone carrier accepts.",
  12300: "Twilio rejected the attachment type.",
  30019: "The PDF is larger than the customer's carrier accepts.",
  30007: "The customer's carrier filtered the message.",
  30003: "The customer's phone is unreachable.",
  30005: "The customer's number is unknown to their carrier.",
  30006: "The customer's number can't receive picture messages (landline or carrier limit).",
  30008: "The carrier reported an unknown delivery error.",
};
export const errorText = (code, fallback) => ERRORS[Number(code)] || (fallback ? String(fallback).slice(0, 200) : code ? `Twilio error ${code}.` : "");

// Twilio request signature: HMAC-SHA1(auth token, exact URL + each POST param name+value sorted by name).
export async function twilioSignature(authToken, url, params) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)))));
}
export async function verifyTwilioSignature(authToken, url, params, signature) {
  if (!authToken || !signature || !url) return false;
  return safeEqual(await twilioSignature(authToken, url, params), String(signature));
}

export function deliveryView(d) {
  if (!d) return null;
  return {
    id: d.id, document_type: d.document_type, document_number: d.document_number || "", status: d.status,
    delivered: d.status === "delivered", to: d.to_masked || "", file_name: d.file_name || "", file_kb: d.file_bytes ? Math.ceil(d.file_bytes / 1024) : 0,
    error: d.error_message || "", error_code: d.error_code || "", requested_at: d.requested_at, status_updated_at: d.status_updated_at || d.requested_at,
  };
}

// The document, its own customer and (optional) that customer's vehicle, all inside this shop.
export async function resolveDocument(db, type, id, tenant, userId, what = "PDF texts") {
  const entity = ENTITY[type];
  if (!entity || !id || typeof id !== "string") return { status: 400, error: "Choose a saved estimate or invoice." };
  const doc = await getOrNull(db[entity], id);
  if (!doc || !ownsRecord(doc, tenant, userId)) return { status: 404, error: `${entity} not found in this shop.` };
  const customer = doc.customer_id ? await getOrNull(db.Customer, doc.customer_id) : null;
  if (!customer || !ownsRecord(customer, tenant, userId)) return { status: 404, error: `This ${type}'s customer isn't in this shop.` };
  const v = doc.vehicle_id ? await getOrNull(db.Vehicle, doc.vehicle_id) : null;
  const vehicle = v && v.customer_id === customer.id && ownsRecord(v, tenant, userId) ? v : null;
  const phone = toE164(customer.phone);
  const digits = String(customer.phone || "").replace(/\D/g, "");
  if (digits.length < 10) return { status: 400, error: "This customer has no phone number on file. Add one to their profile first." };
  if (!isNanpMobileFormat(phone)) return { status: 400, error: `${what} can only go to US or Canadian phone numbers. This customer's number is outside that.` };
  return { doc, customer, vehicle, phone, number: String(doc[type === "invoice" ? "invoice_number" : "estimate_number"] || "") };
}

// PDF (MMS) sends only: "Send As Text" records (channel sms) never block or shadow a PDF send.
const recentFor = async (db, tenant, documentId) =>
  ((await db.DocumentDelivery.filter({ shop_owner_email: tenant, document_id: documentId }, "-created_date", 50)) || []).filter((r) => r.channel !== "sms");

export async function latestDelivery(db, tenant, documentId) {
  const rows = await recentFor(db, tenant, documentId);
  return rows.filter((r) => r.status !== "duplicate").sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)))[0] || null;
}

export async function setStatus(db, d, patch, now) {
  const status = patch.status ? nextStatus(d.status, patch.status) : d.status;
  const update = { ...patch, status, status_updated_at: new Date(now()).toISOString() };
  if (MEDIA_DONE.includes(status)) update.media_expires_at = new Date(now()).toISOString(); // revoke media
  return db.DocumentDelivery.update(d.id, update);
}

// deps: { db, tenant, user, now, render(model)->Uint8Array, buildModel, storeFile(bytes,name)->uri,
//         twilio: { senderCheck(), send({to, body, mediaUrl, statusCallback}) }, mediaBase, callbackUrl }
export async function sendDocument(deps, input) {
  const { db, tenant, user, now = Date.now, twilio } = deps;
  const type = String(input.document_type || "");
  const key = String(input.idempotency_key || "");
  if (!/^[\w-]{8,80}$/.test(key)) return { status: 400, error: "Missing send reference. Close and reopen the send window." };
  const found = await resolveDocument(db, type, String(input.document_id || ""), tenant, user.id);
  if (found.error) return found;
  const { doc, customer, vehicle, phone, number } = found;

  // Same click/retry: answer with what already happened, never send again.
  const prior = (await recentFor(db, tenant, doc.id)).find((r) => r.idempotency_key === key && r.status !== "duplicate");
  if (prior) return { status: 200, delivery: deliveryView(prior), repeated: true };

  const sender = await twilio.senderCheck();
  if (!sender.ok) return { status: 503, error: `${sender.reason} The PDF was not sent.` };

  const stamp = new Date(now()).toISOString();
  const mine = await db.DocumentDelivery.create({
    shop_owner_email: tenant, shop_user_id: user.id, sent_by_email: lower(user.email), document_type: type, document_id: doc.id,
    document_number: number, customer_id: customer.id, to_masked: maskPhone(phone), channel: "mms", status: "preparing",
    idempotency_key: key, requested_at: stamp, status_updated_at: stamp,
  });
  // Racing clicks: the earliest in-flight request for this document wins; the rest stand down.
  const cutoff = now() - IN_FLIGHT_WINDOW_MS;
  const active = (await recentFor(db, tenant, doc.id))
    .filter((r) => IN_FLIGHT.includes(r.status) && Date.parse(r.requested_at) >= cutoff)
    .sort((a, b) => String(a.requested_at).localeCompare(String(b.requested_at)) || String(a.id).localeCompare(String(b.id)));
  if (active[0] && active[0].id !== mine.id) {
    await db.DocumentDelivery.update(mine.id, { status: "duplicate", status_updated_at: stamp });
    return { status: 409, error: "This document is already being texted. Wait for that send to finish.", delivery: deliveryView(active[0]) };
  }

  const bytes = deps.render(deps.buildModel(type, doc, customer, vehicle, user));
  const fileName = pdfFileName(type, number);
  if (bytes.byteLength > MAX_PDF_BYTES) {
    const failed = await setStatus(db, mine, { status: "failed", error_code: "too_large", error_message: `The PDF is ${Math.ceil(bytes.byteLength / 1024)} KB, over the 4.5 MB picture-message limit. Nothing was sent.`, file_bytes: bytes.byteLength }, now);
    return { status: 413, error: failed.error_message, delivery: deliveryView(failed) };
  }
  const fileUri = await deps.storeFile(bytes, fileName);
  const token = newMediaToken();
  const callbackUrl = deps.callbackUrl;
  const ready = await db.DocumentDelivery.update(mine.id, {
    file_uri: fileUri, file_name: fileName, file_bytes: bytes.byteLength, content_sha256: await sha256Hex(bytes),
    media_token_hash: await sha256Hex(token), media_expires_at: new Date(now() + MEDIA_TTL_MS).toISOString(), callback_url: callbackUrl,
  });

  const result = await twilio.send({
    to: phone, body: messageBody(user.business_name, type, number),
    mediaUrl: `${deps.mediaBase}?d=${encodeURIComponent(ready.id)}&t=${token}`, statusCallback: callbackUrl,
  });
  if (!result.ok) {
    const code = result.data?.code;
    const failed = await setStatus(db, ready, { status: "failed", error_code: code ? String(code) : `http_${result.status}`, error_message: errorText(code, result.data?.message) || "Twilio did not accept the message. Nothing was sent." }, now);
    return { status: 502, error: failed.error_message, delivery: deliveryView(failed) };
  }
  const sent = await setStatus(db, ready, { status: statusFromTwilio(result.data?.status) || "queued", message_sid: String(result.data?.sid || "") }, now);
  return { status: 200, delivery: deliveryView(sent) };
}

// Provider status (signed callback or read-only status fetch) applied to one delivery.
export async function applyProviderStatus(db, delivery, { status, errorCode, errorMessage }, now = Date.now) {
  const incoming = statusFromTwilio(status);
  const next = nextStatus(delivery.status, incoming);
  if (next === delivery.status && !(errorCode && !delivery.error_code && isFinal(next))) return delivery;
  const patch = { status: incoming, provider_status: String(status || "") };
  if (errorCode) { patch.error_code = String(errorCode); patch.error_message = errorText(errorCode, errorMessage); }
  return setStatus(db, delivery, patch, now);
}

// Staff status read: own shop only; refreshes from Twilio while the message is still moving.
export async function deliveryStatus(deps, deliveryId) {
  const { db, tenant, now = Date.now } = deps;
  const d = deliveryId ? await getOrNull(db.DocumentDelivery, String(deliveryId)) : null;
  if (!d || d.shop_owner_email !== tenant) return { status: 404, error: "Send record not found in this shop." };
  if (!d.message_sid || isFinal(d.status)) return { status: 200, delivery: deliveryView(d) };
  const r = await deps.twilio.fetchMessage(d.message_sid);
  if (!r.ok) return { status: 200, delivery: deliveryView(d), note: "Couldn't reach Twilio for an update. Showing the last known status." };
  const updated = await applyProviderStatus(db, d, { status: r.data?.status, errorCode: r.data?.error_code, errorMessage: r.data?.error_message }, now);
  return { status: 200, delivery: deliveryView(updated) };
}

// Media fetch by Twilio: exact delivery id + token, unexpired, not revoked.
export async function mediaDelivery(db, deliveryId, token, now = Date.now) {
  if (!deliveryId || !token || token.length < 40) return null;
  const d = await getOrNull(db.DocumentDelivery, String(deliveryId));
  if (!d || !d.file_uri || !d.media_token_hash || !d.media_expires_at) return null;
  if (!(Date.parse(d.media_expires_at) > now())) return null;
  return safeEqual(await sha256Hex(token), d.media_token_hash) ? d : null;
}