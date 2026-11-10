// "Send As Text": one saved estimate/invoice as readable SMS to ITS customer. No link, no attachment.
// - Browser sends only {document_type, document_id, idempotency_key, preview_sha256}. Shop, document,
//   customer, phone and the exact text are rebuilt here; the hash only proves staff saw this exact text.
// - Each numbered part is its own DocumentDelivery row (channel "sms") with a stable per-part key
//   `${group}-p${part}-a${attempt}`, so repeats/double clicks never resend and partial sends are tracked.
// - A request whose Twilio answer never arrives is "unknown" and is NEVER retried automatically.
// - Never writes estimates, invoices, payments, approvals or customers.
import { resolveDocument, sha256Hex, setStatus, statusFromTwilio, errorText, isFinal, applyProviderStatus } from "./documentDelivery.ts";
import { buildDocumentText } from "./documentText.ts";
import { maskPhone } from "./phone.ts";

export const TEXT_ACTIVE = ["preparing", "queued", "sending", "unknown"];
export const TEXT_WINDOW_MS = 10 * 60 * 1000;
const RESENDABLE = ["failed", "not_sent"];        // Twilio definitely did not send these
const lower = (v) => String(v || "").trim().toLowerCase();
const order = (a, b) => String(a.requested_at).localeCompare(String(b.requested_at)) || String(a.id).localeCompare(String(b.id));
const live = (rows) => rows.filter((r) => r.status !== "duplicate");

const textRows = async (db, tenant, documentId) =>
  live((await db.DocumentDelivery.filter({ shop_owner_email: tenant, document_id: documentId, channel: "sms" }, "-created_date", 200)) || []);

// Latest attempt per part of one send group, for staff.
export function groupView(rows, groupKey) {
  const mine = live(rows).filter((r) => r.group_key === groupKey);
  if (!mine.length) return null;
  const byPart = new Map();
  for (const r of mine) { const cur = byPart.get(r.part_index); if (!cur || (r.attempt || 1) > (cur.attempt || 1)) byPart.set(r.part_index, r); }
  const parts = [...byPart.values()].sort((a, b) => a.part_index - b.part_index).map((r) => ({
    index: r.part_index, status: r.status, attempt: r.attempt || 1, segments: r.segments || 0,
    error: r.error_message || "", error_code: r.error_code || "", status_updated_at: r.status_updated_at || r.requested_at,
  }));
  const st = parts.map((p) => p.status);
  return {
    group_key: groupKey, document_number: mine[0].document_number || "", to: mine[0].to_masked || "", part_count: mine[0].part_count || parts.length,
    requested_at: mine.map((r) => r.requested_at).sort()[0], parts,
    accepted: st.filter((x) => ["queued", "sending", "sent", "delivered"].includes(x)).length,
    delivered: st.filter((x) => x === "delivered").length,
    unknown: st.includes("unknown"), active: st.some((x) => ["preparing", "queued", "sending", "sent"].includes(x)),
    can_resume: st.some((x) => RESENDABLE.includes(x)) && !st.some((x) => ["preparing", "sending", "unknown"].includes(x)),
  };
}

export async function latestTextGroup(db, tenant, documentId) {
  const rows = await textRows(db, tenant, documentId);
  const last = [...rows].sort(order).pop();
  return last ? groupView(rows, last.group_key) : null;
}

// Read-only preview: the exact parts that "send" would deliver now, plus a hash binding the send to it.
export async function prepareText(deps, input) {
  const { db, tenant, user } = deps;
  const type = String(input.document_type || "");
  const found = await resolveDocument(db, type, String(input.document_id || ""), tenant, user.id, "Texts");
  if (found.error) return found;
  const built = buildDocumentText(type, found.doc, found.customer, found.vehicle, user, { currency: deps.currency });
  const base = { document_number: found.number, customer_name: found.doc.customer_name || found.customer.full_name || "", to: maskPhone(found.phone), latest: await latestTextGroup(db, tenant, found.doc.id) };
  if (built.error) return { status: 200, ...base, blocker: built.error, blocker_code: built.code };
  return { status: 200, ...base, shop_name: built.shop.name, parts: built.parts, part_count: built.part_count, segments_total: built.segments_total, encoding: built.encoding, preview_sha256: await sha256Hex(built.parts.map((p) => p.body).join("\u0000")) };
}

// deps: { db, tenant, user, now, currency, callbackUrl, twilio: { smsCheck(), sendSms({to, body, statusCallback}) } }
export async function sendDocumentText(deps, input) {
  const { db, tenant, user, now = Date.now, twilio } = deps;
  const type = String(input.document_type || "");
  const key = String(input.idempotency_key || "");
  const resume = input.resume === true;
  if (!/^[\w-]{8,64}$/.test(key)) return { status: 400, error: "Missing send reference. Close and reopen the send window." };
  const found = await resolveDocument(db, type, String(input.document_id || ""), tenant, user.id, "Texts");
  if (found.error) return found;
  const { doc, customer, phone, number } = found;
  const built = buildDocumentText(type, doc, customer, found.vehicle, user, { currency: deps.currency });
  if (built.error) return { status: built.status || 422, error: `${built.error} Nothing was sent.`, code: built.code };
  const hash = await sha256Hex(built.parts.map((p) => p.body).join("\u0000"));
  if (String(input.preview_sha256 || "") !== hash) return { status: 409, error: "The document or shop details changed since the preview. Review the new text before sending. Nothing was sent.", code: "preview_changed" };

  const rows = await textRows(db, tenant, doc.id);
  const mine = rows.filter((r) => r.group_key === key);
  if (mine.length && !resume) return { status: 200, group: groupView(rows, key), repeated: true };
  if (resume && !mine.length) return { status: 400, error: "Nothing to resume. Send the text first." };
  if (resume && mine.some((r) => r.body_sha256 !== hash)) return { status: 409, error: "The document changed after the first parts were sent. Close this window and send a fresh text. Nothing was sent.", code: "preview_changed" };

  let targets;
  if (!resume) targets = built.parts.map((p) => ({ index: p.index, attempt: 1 }));
  else {
    const view = groupView(rows, key);
    if (!view.can_resume) return { status: 200, group: view, repeated: true };
    targets = view.parts.filter((p) => RESENDABLE.includes(p.status)).map((p) => ({ index: p.index, attempt: p.attempt + 1 }));
  }

  const sender = await twilio.smsCheck();
  if (!sender.ok) return { status: 503, error: `${sender.reason} The text was not sent.` };

  const stamp = new Date(now()).toISOString();
  const created = [];
  for (const t of targets) {
    const part = built.parts[t.index - 1];
    created.push(await db.DocumentDelivery.create({
      shop_owner_email: tenant, shop_user_id: user.id, sent_by_email: lower(user.email), document_type: type, document_id: doc.id,
      document_number: number, customer_id: customer.id, to_masked: maskPhone(phone), channel: "sms", status: "preparing",
      idempotency_key: `${key}-p${t.index}-a${t.attempt}`, group_key: key, part_index: t.index, part_count: built.part_count, attempt: t.attempt,
      segments: part.segments, encoding: part.encoding, body_sha256: hash, callback_url: deps.callbackUrl, requested_at: stamp, status_updated_at: stamp,
    }));
  }
  // Racing requests: the earliest live send for this document wins; a racing copy of the same
  // part attempt (double click) stands down. Losers mark their rows duplicate and send nothing.
  const after = await textRows(db, tenant, doc.id);
  const cutoff = now() - TEXT_WINDOW_MS;
  const activeNow = after.filter((r) => TEXT_ACTIVE.includes(r.status) && Date.parse(r.requested_at) >= cutoff).sort(order);
  const lead = created[0];
  const sameKey = after.filter((r) => r.idempotency_key === lead.idempotency_key).sort(order)[0];
  const otherGroup = !resume && activeNow[0] && activeNow[0].group_key !== key ? activeNow[0] : null;
  if (otherGroup || sameKey.id !== lead.id) {
    for (const r of created) await db.DocumentDelivery.update(r.id, { status: "duplicate", status_updated_at: stamp });
    const rowsNow = await textRows(db, tenant, doc.id);
    if (otherGroup) return { status: 409, error: "A text for this document is already sending or unconfirmed. Wait for it to finish before sending another.", group: groupView(rowsNow, otherGroup.group_key) };
    return { status: 200, group: groupView(rowsNow, key), repeated: true };
  }

  let stop = "";
  for (const rec of created) {
    if (stop) { await setStatus(db, rec, { status: "not_sent", error_message: stop }, now); continue; }
    const res = await twilio.sendSms({ to: phone, body: built.parts[rec.part_index - 1].body, statusCallback: deps.callbackUrl });
    if (res.ok) { await setStatus(db, rec, { status: statusFromTwilio(res.data?.status) || "queued", message_sid: String(res.data?.sid || "") }, now); continue; }
    if (res.unknown) {
      await setStatus(db, rec, { status: "unknown", error_code: "no_answer", error_message: "Twilio didn't answer in time, so this part may or may not have been sent. It will not be resent automatically. Check with the customer before sending again." }, now);
      stop = `Not sent: part ${rec.part_index} has an unconfirmed result.`;
      continue;
    }
    const code = res.data?.code;
    await setStatus(db, rec, { status: "failed", error_code: code ? String(code) : `http_${res.status}`, error_message: errorText(code, res.data?.message) || "Twilio did not accept this text. It was not sent." }, now);
    stop = `Not sent because part ${rec.part_index} failed.`;
  }
  return { status: 200, group: groupView(await textRows(db, tenant, doc.id), key) };
}

// Staff status read for one send group (own shop only); refreshes moving parts from Twilio.
export async function textStatus(deps, groupKey) {
  const { db, tenant, now = Date.now } = deps;
  if (!/^[\w-]{8,64}$/.test(String(groupKey || ""))) return { status: 400, error: "Missing send reference." };
  const rows = live((await db.DocumentDelivery.filter({ shop_owner_email: tenant, group_key: String(groupKey), channel: "sms" }, "-created_date", 50)) || []);
  if (!rows.length) return { status: 404, error: "Text send not found in this shop." };
  let note = "";
  for (const r of rows) {
    if (!r.message_sid || isFinal(r.status)) continue;
    const res = await deps.twilio.fetchMessage(r.message_sid);
    if (!res.ok) { note = "Couldn't reach Twilio for an update. Showing the last known status."; continue; }
    await applyProviderStatus(db, r, { status: res.data?.status, errorCode: res.data?.error_code, errorMessage: res.data?.error_message }, now);
  }
  const fresh = live((await db.DocumentDelivery.filter({ shop_owner_email: tenant, group_key: String(groupKey), channel: "sms" }, "-created_date", 50)) || []);
  return { status: 200, group: groupView(fresh, groupKey), note };
}