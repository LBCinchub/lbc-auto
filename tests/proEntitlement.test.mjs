// Pro-only document texting. Synthetic fixtures and mocked Stripe/Twilio only: no network, no live records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { jsPDF } from "jspdf";
import { checkProEntitlement, proGrantDenial, PLAN_PRICE_IDS } from "../base44/shared/proEntitlement.ts";
import { sendDocument, applyProviderStatus, mediaDelivery } from "../base44/shared/documentDelivery.ts";
import { prepareText, sendDocumentText } from "../base44/shared/documentTextDelivery.ts";
import { buildDocumentModel } from "../base44/shared/documentPdfModel.ts";
import { renderDocumentPdf } from "../base44/shared/documentPdfRender.ts";
import { proLockOf } from "../src/components/document-delivery/deliveryUi.js";

const NOW = Date.parse("2026-11-10T12:00:00Z");
const APP = "app_test";
const userA = { id: "uA", email: "shop-a@example.test", role: "user", business_name: "Maple Auto", phone: "6135550100" };
const userB = { id: "uB", email: "shop-b@example.test", role: "user", business_name: "Birch Garage" };
const sub = (over = {}, price = PLAN_PRICE_IDS.pro) => ({
  id: "sub_1", status: "active", metadata: { user_id: "uA", base44_app_id: APP, plan_tier: "pro" },
  items: { data: [{ price: { id: price }, current_period_end: NOW / 1000 + 86400 }] }, ...over,
});
function stripe(reply) {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return typeof reply === "function" ? reply() : reply; };
  return { calls, fetchFn };
}
const ok = (subs) => ({ ok: true, status: 200, json: async () => ({ data: subs }) });
const check = (user, s, extra = {}) => checkProEntitlement({ user, stripeKey: "sk_test_x", appId: APP, fetchFn: s.fetchFn, now: () => NOW, ...extra });

test("Pro subscription for this exact user is accepted", async () => {
  const s = stripe(ok([sub()]));
  const r = await check(userA, s);
  assert.equal(r.ok, true); assert.equal(r.user_id, "uA");
  assert.match(decodeURIComponent(s.calls[0].url), /metadata\['user_id'\]:'uA'/);
});

test("Basic, free, trialing, past-due, canceled and lapsed subscriptions are rejected", async () => {
  for (const subs of [[sub({}, PLAN_PRICE_IDS.basic)], [], [sub({ status: "trialing" })], [sub({ status: "past_due" })], [sub({ status: "canceled" })],
    [sub({ items: { data: [{ price: { id: PLAN_PRICE_IDS.pro }, current_period_end: NOW / 1000 - 1 }] } })]]) {
    const r = await check(userA, stripe(ok(subs)));
    assert.equal(r.ok, false); assert.equal(r.code, "pro_required"); assert.equal(r.status, 403);
  }
});

test("forged profile Pro flags and admin role are not trusted", async () => {
  const forged = { ...userA, role: "admin", plan_tier: "pro", subscription_status: "active", next_billing_date: "2099-01-01", setup_fee_paid: true };
  const r = await check(forged, stripe(ok([])));
  assert.equal(r.ok, false); assert.equal(r.code, "pro_required");
  const legacy = await check({ ...userA, plan_tier: "legacy" }, stripe(ok([])));
  assert.equal(legacy.ok, false);
});

test("another shop's or another app's Pro subscription is rejected", async () => {
  assert.equal((await check(userB, stripe(ok([sub()])))).ok, false, "sub belongs to uA");
  assert.equal((await check(userA, stripe(ok([sub({ metadata: { user_id: "uA", base44_app_id: "other_app" } })])))).ok, false);
  assert.equal((await check({ ...userA, id: "uA' OR 'x" }, stripe(ok([sub()])))).ok, false, "unsafe id never queried");
});

test("missing, expired or unreachable billing fails closed", async () => {
  assert.equal((await check(userA, stripe(ok([sub()])), { stripeKey: "" })).code, "pro_unverified");
  assert.equal((await check(userA, stripe({ ok: false, status: 401, json: async () => ({ error: { code: "api_key_expired" } }) }))).code, "pro_unverified");
  assert.equal((await check(userA, stripe(() => Promise.reject(new Error("net"))))).code, "pro_unverified");
  assert.equal((await check(userA, stripe({ ok: true, status: 200, json: async () => ({}) }))).code, "pro_unverified");
});

test("grant must belong to the acting user", () => {
  assert.equal(proGrantDenial({ ok: true, user_id: "uA" }, userA), null);
  assert.ok(proGrantDenial({ ok: true, user_id: "uA" }, userB));
  assert.ok(proGrantDenial(undefined, userA));
  assert.ok(proGrantDenial({ ok: true }, userA));
});

// ── Shared senders: direct calls without a valid grant never touch storage or Twilio ──
const custA = { id: "cA", created_by_id: "uA", full_name: "Jane Driver", phone: "613-555-0199" };
const vehA = { id: "vA", created_by_id: "uA", customer_id: "cA", year: 2019, make: "Honda", model: "Civic" };
const invoiceA = () => ({
  id: "iA", created_by_id: "uA", invoice_number: "INV-1042", customer_id: "cA", customer_name: "Jane Driver", vehicle_id: "vA", invoice_date: "2026-11-05",
  line_items: [{ type: "part", name: "Front Pads", quantity: 1, unit_price: 80, total: 80 }],
  parts_total: 80, labor_total: 0, tax_rate: 13, tax_applies_to: "both", tax_amount: 10.4, total: 90.4, amount_paid: 0, balance_due: 90.4,
});
function store() {
  const t = { Invoice: [invoiceA()], Customer: [custA], Vehicle: [vehA], DocumentDelivery: [] }; let n = 0;
  const api = (k) => ({
    async get(id) { const r = (t[k] ||= []).find((x) => x.id === id); if (!r) throw Object.assign(new Error("nf"), { status: 404 }); return structuredClone(r); },
    async filter(q) { return (t[k] ||= []).filter((r) => Object.entries(q).every(([f, v]) => r[f] === v)).map((r) => structuredClone(r)); },
    async create(d) { const r = { id: `DD_${String(++n).padStart(4, "0")}`, ...d }; (t[k] ||= []).push(r); return structuredClone(r); },
    async update(id, d) { const r = t[k].find((x) => x.id === id); Object.assign(r, d); return structuredClone(r); },
  });
  return { db: new Proxy({}, { get: (_, k) => api(k) }), t };
}
function twilio() {
  const sent = [];
  return { sent, senderCheck: async () => ({ ok: true }), smsCheck: async () => ({ ok: true }),
    send: async (m) => { sent.push(m); return { ok: true, status: 201, data: { sid: "MM" + "a".repeat(32), status: "queued" } }; },
    sendSms: async (m) => { sent.push(m); return { ok: true, status: 201, data: { sid: "SM" + "b".repeat(32), status: "queued" } }; },
    fetchMessage: async () => ({ ok: true, data: { status: "delivered" } }) };
}
function deps(s, entitlement, user = userA) {
  const tw = twilio(); const files = [];
  return { tw, files, d: { db: s.db, tenant: user.email, user, twilio: tw, entitlement, now: () => NOW, currency: "",
    buildModel: buildDocumentModel, render: (m) => renderDocumentPdf(jsPDF, m),
    storeFile: async (bytes, name) => { files.push(name); return "private://f"; },
    mediaBase: "https://app.test/functions/documentMedia", callbackUrl: "https://app.test/functions/twilioMessageStatus" } };
}
const denials = [undefined, { ok: false, code: "pro_required" }, { ok: true, user_id: "uB" }];

test("direct PDF send without a valid grant: no PDF, no upload, no record, no Twilio", async () => {
  for (const ent of denials) {
    const s = store(); const x = deps(s, ent);
    const r = await sendDocument(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-pro-0001" });
    assert.equal(r.status, 403); assert.equal(r.code, "pro_required");
    assert.equal(x.tw.sent.length, 0); assert.equal(x.files.length, 0); assert.equal(s.t.DocumentDelivery.length, 0);
  }
});

test("direct text prepare/send without a valid grant: nothing built or sent", async () => {
  for (const ent of denials) {
    const s = store(); const x = deps(s, ent);
    assert.equal((await prepareText(x.d, { document_type: "invoice", document_id: "iA" })).status, 403);
    const r = await sendDocumentText(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-pro-0002", preview_sha256: "x" });
    assert.equal(r.status, 403); assert.equal(x.tw.sent.length, 0); assert.equal(s.t.DocumentDelivery.length, 0);
  }
});

test("downgrade between preview and send: send is refused", async () => {
  const s = store();
  const pro = deps(s, { ok: true, user_id: "uA" });
  const p = await prepareText(pro.d, { document_type: "invoice", document_id: "iA" });
  assert.equal(p.status, 200); assert.ok(p.preview_sha256);
  const lapsed = deps(s, { ok: false, code: "pro_required" });
  const r = await sendDocumentText(lapsed.d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-pro-0003", preview_sha256: p.preview_sha256 });
  assert.equal(r.status, 403); assert.equal(lapsed.tw.sent.length, 0); assert.equal(s.t.DocumentDelivery.length, 0);
});

test("a send accepted while Pro keeps its status callbacks and media access after a downgrade", async () => {
  const s = store(); const x = deps(s, { ok: true, user_id: "uA" });
  const r = await sendDocument(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-pro-0004" });
  assert.equal(r.status, 200); assert.equal(x.tw.sent.length, 1);
  const u = new URL(x.tw.sent[0].mediaUrl);
  // Neither the media endpoint nor the status callback takes or checks entitlement.
  assert.ok(await mediaDelivery(s.db, u.searchParams.get("d"), u.searchParams.get("t"), () => NOW + 1000));
  await applyProviderStatus(s.db, s.t.DocumentDelivery[0], { status: "delivered" }, () => NOW + 2000);
  assert.equal(s.t.DocumentDelivery[0].status, "delivered");
});

// ── Endpoint wiring (source-level) ──
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("both endpoints check Pro on every prepare/send before any document work; status reads stay open", () => {
  const pdf = src("base44/functions/sendDocumentPdf/entry.ts");
  const gate = pdf.indexOf("checkProEntitlement({ user");
  assert.ok(gate > 0 && gate < pdf.indexOf("resolveDocument(db") && gate < pdf.indexOf("loadLogo(user") && gate < pdf.indexOf("UploadPrivateFile"));
  assert.match(pdf, /if \(action === 'prepare' \|\| action === 'send'\)/);
  const txt = src("base44/functions/sendDocumentText/entry.ts");
  const tgate = txt.indexOf("checkProEntitlement({ user");
  assert.ok(txt.indexOf("action === 'status'") < tgate && tgate < txt.indexOf("prepareText(deps") && tgate < txt.indexOf("sendDocumentText(deps"));
  for (const s of [pdf, txt]) {
    assert.match(s, /stripeKey: secrets\.get\('STRIPE_SECRET_KEY'\)/);
    assert.doesNotMatch(s, /body\.(plan_tier|is_pro|pro|entitlement)/);
    assert.doesNotMatch(s, /user\.plan_tier|subscription_status/);
  }
  for (const p of ["base44/functions/twilioMessageStatus/entry.ts", "base44/functions/documentMedia/entry.ts"]) {
    assert.doesNotMatch(src(p), /proEntitlement|checkProEntitlement/);
  }
});

test("UI: server Pro denial locks the window and hides send controls", () => {
  assert.deepEqual(proLockOf({ response: { data: { code: "pro_required", error: "Pro only" } } }), { code: "pro_required", message: "Pro only" });
  assert.equal(proLockOf({ response: { data: { code: "other" } } }), null);
  const dlg = src("src/components/document-delivery/TextPdfDialog.jsx");
  const lockedBranch = dlg.slice(dlg.indexOf("{locked ? ("), dlg.indexOf(") : mode === \"text\""));
  assert.match(lockedBranch, /ProUpgradeNotice/); assert.doesNotMatch(lockedBranch, /Send PDF|Send As Text|onClick=\{send\}/);
  const panel = src("src/components/document-delivery/TextDetailsPanel.jsx");
  const lockedPanel = panel.slice(panel.indexOf("if (locked) return ("), panel.indexOf("  return (\n    <div className=\"space-y-3 text-sm\">\n      {!info"));
  assert.match(lockedPanel, /ProUpgradeNotice/); assert.doesNotMatch(lockedPanel, /onClick=\{send\}|onClick=\{resume\}/);
  assert.match(src("src/components/document-delivery/ProUpgradeNotice.jsx"), /to="\/Billing"[\s\S]*Upgrade To Pro/);
  assert.match(src("src/components/document-delivery/TextPdfButton.jsx"), /<ProBadge \/>/);
});