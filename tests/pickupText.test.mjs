// "Text Ready For Pickup": synthetic fixtures and mocks only. No live records, no network, no real Twilio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pickupTemplate, checkBody, preparePickup, sendPickup, PICKUP_FOOTER } from "../base44/shared/pickupText.ts";
import { textStatus } from "../base44/shared/documentTextDelivery.ts";
import { pickupSendState } from "../src/lib/pickupTextState.js";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const A = "shop-a@example.test", B = "shop-b@example.test";
const userA = { id: "uA", email: A, role: "user", business_name: "Maple Auto", phone: "613-555-0100", address: "1 Main St, Ottawa", subscription_status: "active" };
const userB = { id: "uB", email: B, role: "user", business_name: "Birch Garage", phone: "343-555-0177", subscription_status: "active" };
const custA = { id: "cA", created_by_id: "uA", full_name: "Jane Driver", phone: "613-555-0199", notes_log: [{ text: "PRIVATE" }] };
const custB = { id: "cB", created_by_id: "uB", full_name: "Bob Owner", phone: "6135550111" };
const vehA = { id: "vA", created_by_id: "uA", customer_id: "cA", year: 2019, make: "Honda", model: "Civic", vin: "2HGFC2F59KH000000" };
const roA = () => ({ id: "rA", created_by_id: "uA", order_number: "RO-1042", customer_id: "cA", vehicle_id: "vA", status: "completed", total_cost: 412.5, notes: "INTERNAL-NOTE", discount_value: 10, description: "Brakes" });
const roB = { id: "rB", created_by_id: "uB", order_number: "RO-B1", customer_id: "cB", status: "completed" };

function store(seed) {
  const t = {}; let n = 0;
  for (const [k, rows] of Object.entries(seed)) t[k] = rows.map((r) => structuredClone(r));
  const tbl = (k) => (t[k] ||= []);
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  const api = (k) => ({
    async get(id) { await tick(); const r = tbl(k).find((x) => x.id === id); if (!r) throw Object.assign(new Error("nf"), { status: 404 }); return structuredClone(r); },
    async filter(q) { await tick(); return tbl(k).filter((r) => Object.entries(q).every(([f, v]) => r[f] === v)).map((r) => structuredClone(r)); },
    async create(d) { await tick(); const r = { id: `DD_${String(++n).padStart(4, "0")}`, ...d }; tbl(k).push(r); return structuredClone(r); },
    async update(id, d) { await tick(); const r = tbl(k).find((x) => x.id === id); Object.assign(r, d); return structuredClone(r); },
  });
  return { db: new Proxy({}, { get: (_, k) => api(k) }), t };
}
const seed = (over = {}) => store({ RepairOrder: [over.ro || roA(), roB], Customer: [over.cust || custA, custB], Vehicle: [vehA], DocumentDelivery: over.deliveries || [] });
function fakeTwilio({ check = { ok: true }, replies = [] } = {}) {
  const sent = []; let i = 0;
  return {
    sent, smsCheck: async () => check, fetchMessage: async () => ({ ok: true, data: { status: "delivered" } }),
    sendSms: async (m) => { sent.push(m); const r = replies[i++]; return r || { ok: true, status: 201, data: { sid: "SM" + String(sent.length).padStart(32, "0"), status: "queued" } }; },
  };
}
const deps = (s, { user = userA, twilio = fakeTwilio(), now = NOW } = {}) => ({ db: s.db, user, twilio, now: () => now, callbackUrl: "https://app.test/functions/twilioMessageStatus" });
const KEY = "key-0000-0001";
const BODY = "Hi Jane, Your 2019 Honda Civic Is Ready For Pickup At Maple Auto. Repair Order: RO-1042. 1 Main St, Ottawa. Questions? Call 613-555-0100.";

test("template uses the actual shop, customer, vehicle and RO; no placeholders, internal notes or costs", async () => {
  const s = seed();
  const p = await preparePickup(deps(s), { repair_order_id: "rA" });
  assert.equal(p.template, BODY);
  assert.equal(p.to, "613-555-0199");
  assert.deepEqual(p.shop, { name: "Maple Auto", phone: "613-555-0100", address: "1 Main St, Ottawa" });
  for (const bad of ["{", "}", "undefined", "null", "$"]) assert.ok(!p.template.includes(bad), `template has no ${bad}`);
  for (const bad of ["INTERNAL", "PRIVATE", "412", "2HGFC2F59KH000000", "http", A]) assert.ok(!JSON.stringify(p).includes(bad), `preview hides ${bad}`);
  assert.equal(s.t.DocumentDelivery.length, 0, "preview stores nothing");
});

test("missing optional fields drop out cleanly; unresolved shop blocks with no fallback shop", async () => {
  const t = pickupTemplate({ customer: { full_name: "" }, vehicle: null, order: {}, shop: { name: "Maple Auto", phone: "", address: "" } });
  assert.equal(t, "Hi, Your Vehicle Is Ready For Pickup At Maple Auto.");
  const s = seed();
  const r = await preparePickup(deps(s, { user: { ...userA, business_name: "" } }), { repair_order_id: "rA" });
  assert.equal(r.status, 403);
  const noName = await preparePickup(deps(s, { user: { ...userA, business_name: "  " } }), { repair_order_id: "rA" });
  assert.ok(noName.error && !/haj|lbc/i.test(noName.error));
});

test("recipient validation: no phone, non-NANP and opted-out (STOP) customers are blocked", async () => {
  for (const [phone, code] of [["", "no_phone"], ["+44 20 7946 0000", "invalid_phone"]]) {
    const s = seed({ cust: { ...custA, phone } });
    const p = await preparePickup(deps(s), { repair_order_id: "rA" });
    assert.equal(p.blocker_code, code);
    const r = await sendPickup(deps(s), { repair_order_id: "rA", idempotency_key: KEY, body: BODY });
    assert.equal(r.code, code);
  }
  const s = seed({ deliveries: [{ id: "old", shop_owner_email: A, customer_id: "cA", document_id: "iX", channel: "sms", status: "failed", error_code: "21610", requested_at: "2026-10-01T00:00:00Z" }] });
  const tw = fakeTwilio();
  assert.equal((await sendPickup(deps(s, { twilio: tw }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY })).code, "opted_out");
  assert.equal(tw.sent.length, 0);
});

test("cross-shop and forged ids are denied; technicians and lapsed shops cannot send", async () => {
  const s = seed();
  const tw = fakeTwilio();
  assert.equal((await sendPickup(deps(s, { twilio: tw }), { repair_order_id: "rB", idempotency_key: KEY, body: BODY })).status, 404);
  assert.equal((await preparePickup(deps(s, { user: userB }), { repair_order_id: "rA" })).status, 404);
  // Forged substitutions in the request are ignored: recipient always comes from the order's own customer.
  await sendPickup(deps(s, { twilio: tw }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY, customer_id: "cB", to: "+16135550111", phone: "6135550111", shop_email: B });
  assert.deepEqual(tw.sent.map((m) => m.to), ["+16135550199"]);
  const lapsed = await preparePickup(deps(s, { user: { ...userA, subscription_status: "none", created_date: "2025-01-01" } }), { repair_order_id: "rA" });
  assert.equal(lapsed.status, 403);
  const sb = seed({ ro: { ...roA(), customer_id: "cB" } });
  assert.equal((await preparePickup(deps(sb), { repair_order_id: "rA" })).code, "customer_not_found");
});

test("edited text is untrusted: links, emails, amounts, VINs and over-length are refused", () => {
  assert.equal(checkBody("Ready! See https://x.co").code, "link_in_body");
  assert.equal(checkBody("Email me at a@b.com").code, "email_in_body");
  assert.equal(checkBody("Your total is $412.50").code, "money_in_body");
  assert.equal(checkBody("VIN 2HGFC2F59KH000000").code, "vin_in_body");
  assert.equal(checkBody("x".repeat(600)).code, "too_long");
  assert.equal(checkBody("   ").code, "empty_body");
  assert.equal(checkBody(BODY).full, `${BODY}\n${PICKUP_FOOTER}`);
});

test("double clicks send once; repeats replay; same window with different text is refused", async () => {
  const s = seed();
  const tw = fakeTwilio();
  const d = deps(s, { twilio: tw });
  const [a, b] = await Promise.all([sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY }), sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY })]);
  assert.equal(tw.sent.length, 1);
  assert.ok([a, b].every((r) => r.status === 200));
  assert.equal((await sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY })).repeated, true);
  assert.equal((await sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY + " Thanks" })).code, "body_changed");
  assert.equal((await sendPickup(d, { repair_order_id: "rA", idempotency_key: "key-0000-0002", body: BODY })).code, "in_flight");
  s.t.DocumentDelivery[0].status = "delivered";
  assert.equal((await sendPickup(d, { repair_order_id: "rA", idempotency_key: "key-0000-0003", body: BODY })).code, "cooldown");
  assert.equal(tw.sent.length, 1);
  assert.equal(tw.sent[0].body.endsWith(PICKUP_FOOTER), true);
});

test("provider acceptance is not delivery; message id is logged; status read moves it forward", async () => {
  const s = seed();
  const tw = fakeTwilio();
  const r = await sendPickup(deps(s, { twilio: tw }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY });
  const row = s.t.DocumentDelivery[0];
  assert.equal(row.status, "queued");
  assert.match(row.message_sid, /^SM\d{32}$/);
  assert.equal(row.document_type, "repair_order");
  assert.equal(row.purpose, "pickup_ready");
  assert.equal(r.group.delivered, 0);
  const st = await textStatus({ db: s.db, tenant: A, twilio: tw, now: () => NOW }, KEY);
  assert.equal(st.group.delivered, 1);
});

test("failure keeps the window usable; retry is explicit and duplicate-safe; unknown is never retried", async () => {
  const s = seed();
  const tw = fakeTwilio({ replies: [{ ok: false, status: 400, data: { code: 21614, message: "not mobile" } }] });
  const d = deps(s, { twilio: tw });
  const r1 = await sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY });
  assert.equal(r1.group.parts[0].status, "failed");
  assert.ok(r1.group.can_resume);
  const [x, y] = await Promise.all([sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY, resume: true }), sendPickup(d, { repair_order_id: "rA", idempotency_key: KEY, body: BODY, resume: true })]);
  assert.equal(tw.sent.length, 2, "one retry only");
  assert.ok([x, y].some((r) => r.group?.parts[0].status === "queued"));
  const su = seed();
  const tu = fakeTwilio({ replies: [{ ok: false, unknown: true, status: 504, data: {} }] });
  const u = await sendPickup(deps(su, { twilio: tu }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY });
  assert.equal(u.group.parts[0].status, "unknown");
  assert.equal(u.group.can_resume, false);
  assert.equal((await sendPickup(deps(su, { twilio: tu }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY, resume: true })).repeated, true);
  assert.equal(tu.sent.length, 1);
});

test("readiness: only completed orders; nothing is marked completed, paid or changed by sending", async () => {
  const s = seed({ ro: { ...roA(), status: "in_progress" } });
  const tw = fakeTwilio();
  assert.equal((await sendPickup(deps(s, { twilio: tw }), { repair_order_id: "rA", idempotency_key: KEY, body: BODY })).code, "not_ready");
  assert.equal(s.t.RepairOrder[0].status, "in_progress");
  const ok = seed();
  const before = JSON.stringify([ok.t.RepairOrder, ok.t.Customer]);
  await sendPickup(deps(ok), { repair_order_id: "rA", idempotency_key: KEY, body: BODY });
  assert.equal(JSON.stringify([ok.t.RepairOrder, ok.t.Customer]), before);
  assert.equal(tw.sent.length, 0);
});

test("UI state: send once per window, retry only same text after a definite failure", () => {
  const info = { footer: PICKUP_FOOTER, max_segments: 3, sender_ready: true };
  const failed = { group_key: KEY, can_resume: true, accepted: 0, parts: [{ status: "failed" }] };
  assert.equal(pickupSendState({ info, group: null, windowKey: KEY, body: BODY, sentBody: "", sending: false }).canSend, true);
  assert.equal(pickupSendState({ info, group: { ...failed, can_resume: false, accepted: 1, parts: [{ status: "queued" }] }, windowKey: KEY, body: BODY, sentBody: BODY }).canSend, false);
  const f = pickupSendState({ info, group: failed, windowKey: KEY, body: BODY, sentBody: BODY });
  assert.ok(f.canRetry && !f.canSend);
  const e = pickupSendState({ info, group: failed, windowKey: KEY, body: BODY + " Thanks", sentBody: BODY });
  assert.ok(e.canSend && e.freshKey && !e.canRetry);
  assert.equal(pickupSendState({ info: { ...info, blocker: "x" }, group: null, windowKey: KEY, body: BODY }).canSend, false);
});

test("entry parity, on-demand only, no Pro gate, invoice UI untouched", () => {
  const profile = readFileSync("src/components/document-actions/RepairOrderProfileActions.jsx", "utf8");
  const list = readFileSync("src/pages/RepairOrders.jsx", "utf8");
  const detail = readFileSync("src/pages/RepairOrderDetail.jsx", "utf8");
  for (const src of [profile, list, detail]) { assert.match(src, /Text Ready For Pickup/); assert.match(src, /<PickupTextDialog orderId=/); }
  // Profile RO detail layer renders the same RepairOrderDetail page.
  assert.match(readFileSync("src/components/customers/ProfileDocumentView.jsx", "utf8"), /<RepairOrderDetail key=\{doc\.id\} orderId=\{doc\.id\}/);
  const fn = readFileSync("base44/functions/sendPickupText/entry.ts", "utf8");
  assert.ok(!/checkProEntitlement|proGrantDenial/.test(fn + readFileSync("base44/shared/pickupText.ts", "utf8")));
  for (const f of ["Send SMS on Repair Status Update", "Repair Order Status Notifications"]) assert.ok(!readFileSync(`base44/workflows/${f}.jsonc`, "utf8").includes("sendPickupText"));
  assert.ok(!/RepairOrder\.update|Customer\.update|Invoice\./.test(readFileSync("base44/shared/pickupText.ts", "utf8")));
  for (const f of ["src/components/invoices/OriginalInvoiceEditor.jsx", "src/components/invoices/InvoicePrintView.jsx"]) assert.ok(!readFileSync(f, "utf8").includes("Pickup"));
  const hook = readFileSync("src/components/pickup-text/usePickupText.js", "utf8");
  assert.ok(!/useEffect\([^)]*send\(/.test(hook), "never sends on mount");
});