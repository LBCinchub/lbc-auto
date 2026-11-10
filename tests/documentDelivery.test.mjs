// Synthetic fixtures only: no live records, no network, no real Twilio. Covers PDF content from exact
// saved data, tenant isolation, private media tokens, sender/carrier failures, status tracking and dedup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { jsPDF } from "jspdf";
import { buildDocumentModel } from "../base44/shared/documentPdfModel.ts";
import { renderDocumentPdf } from "../base44/shared/documentPdfRender.ts";
import {
  sendDocument, deliveryStatus, applyProviderStatus, mediaDelivery, verifyTwilioSignature, twilioSignature,
  messageBody, containsUrl, pdfFileName, MEDIA_TTL_MS, nextStatus,
} from "../base44/shared/documentDelivery.ts";

const A = "shop-a@example.test", B = "shop-b@example.test";
const userA = { id: "uA", email: A, role: "user", business_name: "Maple Auto", phone: "6135550100", address: "1 Main St, Ottawa", gst_number: "GST-123" };
const userB = { id: "uB", email: B, role: "user", business_name: "Other Garage" };
const custA = { id: "cA", created_by_id: "uA", full_name: "Jane Driver", phone: "613-555-0199", email: "jane@example.test", address: "5 Elm" };
const custB = { id: "cB", created_by_id: "uB", full_name: "Bob B", phone: "6135550111" };
const vehA = { id: "vA", created_by_id: "uA", customer_id: "cA", year: 2019, make: "Honda", model: "Civic", vin: "2hgfc2f59kh000000", license_plate: "abcd123", mileage: 84000 };
const invoiceA = () => ({
  id: "iA", created_by_id: "uA", invoice_number: "INV-1042", customer_id: "cA", customer_name: "Jane Driver", vehicle_id: "vA", invoice_date: "2026-11-05",
  line_items: [
    { type: "part", name: "Front Pads", description: "Ceramic", quantity: 1, unit_price: 80, total: 80 },
    { type: "labor", name: "Brake Service", description: "Front axle", quantity: 1, unit_price: 20, total: 20 },
    { type: "part", name: "Rear Rotors", description: "Worn", quantity: 0, unit_price: 150, total: 0 },
  ],
  parts_used: [{ name: "Front Pads", quantity: 1, unit_price: 80, total: 80, supplier: "SECRET-SUPPLIER" }],
  parts_total: 80, labor_total: 20, discount: 10, discount_type: "$", tax_rate: 13, tax_applies_to: "both", tax_amount: 11.7, total: 101.7,
  amount_paid: 50, balance_due: 51.7, status: "partial", auth_status: "pending",
  payment_history: [{ date: "2026-11-05", amount: 50, method: "Cash", note: "INTERNAL-NOTE" }],
  technician_notes: "TECH-ONLY retorque", customer_note: "Check brakes in 6 months", financial_lease_until: null,
});
const estimateA = () => ({
  id: "eA", created_by_id: "uA", estimate_number: "EST-77", customer_id: "cA", customer_name: "Jane Driver", vehicle_id: "vA", estimate_date: "2026-11-01",
  parts_items: [{ name: "Battery", details: "Group 35", quantity: 1, unit_price: 189.99, total: 189.99 }, { name: "Wiper Blades", quantity: 0, unit_price: 30, total: 0 }],
  labor_items: [{ description: "Install Battery", details: "", hours: 0.5, rate: 120, total: 60 }],
  parts_total: 189.99, labor_total: 60, discount: 10, discount_type: "%", tax_rate: 13, tax_applies_to: "both", tax_amount: 29.25, grand_total: 254.24,
  amount_paid: 0, status: "sent", auth_status: "pending", notes: "Battery tested weak",
});

function store(seed) {
  const t = {}; let n = 0;
  for (const [k, rows] of Object.entries(seed)) t[k] = rows.map((r) => structuredClone(r));
  const tbl = (k) => (t[k] ||= []);
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  const api = (k) => ({
    async get(id) { await tick(); const r = tbl(k).find((x) => x.id === id); if (!r) throw Object.assign(new Error("nf"), { status: 404 }); return structuredClone(r); },
    async filter(q) { await tick(); return tbl(k).filter((r) => Object.entries(q).every(([f, v]) => r[f] === v)).map((r) => structuredClone(r)); },
    async create(d) { await tick(); const r = { id: `${k}_${++n}`, ...d }; tbl(k).push(r); return structuredClone(r); },
    async update(id, d) { await tick(); const r = tbl(k).find((x) => x.id === id); Object.assign(r, d); return structuredClone(r); },
  });
  return { db: new Proxy({}, { get: (_, k) => api(k) }), t };
}
const seed = () => store({ Invoice: [invoiceA(), { ...invoiceA(), id: "iB", created_by_id: "uB", customer_id: "cB", invoice_number: "INV-B" }], Estimate: [estimateA()], Customer: [custA, custB], Vehicle: [vehA], DocumentDelivery: [] });

function fakeTwilio({ check = { ok: true }, reply = { ok: true, status: 201, data: { sid: "MM" + "a".repeat(32), status: "queued" } } } = {}) {
  const sent = [];
  return { sent, senderCheck: async () => check, send: async (m) => { sent.push(m); return typeof reply === "function" ? reply(m) : reply; }, fetchMessage: async () => ({ ok: true, data: { status: "delivered" } }) };
}
function deps(s, { user = userA, twilio = fakeTwilio(), now = () => Date.parse("2026-11-10T12:00:00Z") } = {}) {
  const files = [];
  return {
    files, twilio,
    d: { db: s.db, tenant: user.email, user, now, twilio, entitlement: { ok: true, user_id: user.id }, buildModel: buildDocumentModel, render: (m) => renderDocumentPdf(jsPDF, m), storeFile: async (bytes, name) => { files.push({ bytes, name }); return `private://f${files.length}`; }, mediaBase: "https://app.test/functions/documentMedia", callbackUrl: "https://app.test/functions/twilioMessageStatus" },
  };
}
const pdfString = (bytes) => Buffer.from(bytes).toString("latin1");
const textOps = (bytes) => [...pdfString(bytes).matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((m) => m[1].replace(/\\(.)/g, "$1"));

test("invoice model + PDF: exact saved totals, recommended line at $0, no internal data", () => {
  const m = buildDocumentModel("invoice", invoiceA(), custA, vehA, userA);
  assert.deepEqual([m.totals.subtotal, m.totals.discountAmount, m.totals.taxAmount, m.totals.grandTotal, m.totals.amountPaid, m.totals.balanceDue], [100, 10, 11.7, 101.7, 50, 51.7]);
  const rec = m.lines.find((l) => l.name === "Rear Rotors");
  assert.equal(rec.recommended, true); assert.equal(rec.amount, 0);
  const bytes = renderDocumentPdf(jsPDF, m);
  const raw = pdfString(bytes);
  assert.ok(raw.startsWith("%PDF-1."), "real PDF header");
  assert.ok(raw.trimEnd().endsWith("%%EOF"));
  const txt = textOps(bytes).join("\n");
  for (const want of ["INVOICE", "# INV-1042", "Maple Auto", "Jane Driver", "2019 Honda Civic", "VIN: 2HGFC2F59KH000000", "Front Pads", "Recommended", "-$10.00", "Tax (13%)", "$11.70", "$101.70", "-$50.00", "$51.70", "BALANCE DUE", "Cash", "Date: Nov 5, 2026", "GST/Business #: GST-123", "Check brakes in 6 months"]) {
    assert.ok(txt.includes(want), `PDF shows ${want}`);
  }
  for (const secret of ["SECRET-SUPPLIER", "TECH-ONLY", "INTERNAL-NOTE", "financial_lease", "auth_token", "http"]) assert.ok(!raw.includes(secret), `PDF hides ${secret}`);
  assert.ok(bytes.byteLength < 200_000, `small PDF (${bytes.byteLength} bytes)`);
  console.log(`invoice PDF ${bytes.byteLength} bytes, pages=${(raw.match(/\/Type \/Page\b/g) || []).length}`);
});

test("estimate model + PDF: percent discount and saved grand total, qty-0 recommended", () => {
  const m = buildDocumentModel("estimate", estimateA(), custA, vehA, userA);
  assert.equal(m.totals.discountAmount, 25); assert.equal(m.totals.grandTotal, 254.24); assert.equal(m.totals.balanceDue, 254.24);
  const txt = textOps(renderDocumentPdf(jsPDF, m)).join("\n");
  for (const want of ["ESTIMATE", "# EST-77", "Battery", "Group 35", "Install Battery", "Discount (10%)", "-$25.00", "$254.24", "Recommended", "- Battery tested weak"]) assert.ok(txt.includes(want), `PDF shows ${want}`);
});

test("long documents paginate and keep every line", () => {
  const inv = { ...invoiceA(), line_items: Array.from({ length: 60 }, (_, i) => ({ type: "part", name: `Part ${i + 1}`, quantity: 1, unit_price: 1, total: 1 })) };
  const bytes = renderDocumentPdf(jsPDF, buildDocumentModel("invoice", inv, custA, vehA, userA));
  const txt = textOps(bytes);
  assert.ok(txt.includes("Part 60")); assert.ok(txt.some((t) => /Page 2 of \d/.test(t)));
});

test("file name, message body: ASCII <=20 chars, shop identity, never a link", () => {
  assert.equal(pdfFileName("invoice", "INV-1042"), "INV-1042.pdf");
  assert.ok(pdfFileName("estimate", "EST/ÉÉ-123456789012345678").length <= 20);
  assert.equal(pdfFileName("invoice", ""), "Invoice.pdf");
  assert.match(pdfFileName("invoice", "x y?z"), /^[A-Za-z0-9-]+\.pdf$/);
  const body = messageBody("Maple Auto", "invoice", "INV-1042");
  assert.equal(body, "Maple Auto: Your invoice INV-1042 is attached as a PDF. Reply STOP to opt out.");
  const sneaky = messageBody("Visit lbchub.tech https://pay.example.com Auto", "estimate", "EST-1");
  assert.ok(!containsUrl(sneaky), sneaky);
});

test("send: PDF goes to the document's own customer phone; client-supplied numbers/URLs ignored; no financial change", async () => {
  const s = seed(); const { d, twilio, files } = deps(s);
  const before = structuredClone(s.t.Invoice[0]);
  const r = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000001", to: "+19995550000", media_url: "https://evil.test/x.pdf" });
  assert.equal(r.status, 200); assert.equal(twilio.sent.length, 1);
  const m = twilio.sent[0];
  assert.equal(m.to, "+16135550199");
  assert.match(m.mediaUrl, /^https:\/\/app\.test\/functions\/documentMedia\?d=DocumentDelivery_\d+&t=[\w-]{43}$/);
  assert.ok(!containsUrl(m.body));
  assert.equal(files[0].name, "INV-1042.pdf"); assert.ok(pdfString(files[0].bytes).startsWith("%PDF"));
  assert.equal(r.delivery.status, "queued"); assert.equal(r.delivery.delivered, false, "queued is not delivered");
  assert.deepEqual(s.t.Invoice[0], before, "invoice untouched: balance, approval, payment state");
  const row = s.t.DocumentDelivery[0];
  assert.ok(!JSON.stringify(row).includes(m.mediaUrl.split("t=")[1]), "raw token never stored");
});

test("tenant isolation: foreign IDs, forged customer links, and other-shop status reads all fail closed", async () => {
  const s = seed();
  const asB = deps(s, { user: userB });
  assert.equal((await sendDocument(asB.d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000002" })).status, 404);
  assert.equal((await sendDocument(asB.d, { document_type: "invoice", document_id: "nope", idempotency_key: "key-000003" })).error, "Invoice not found in this shop.");
  // Shop B's own invoice pointing at shop A's customer.
  s.t.Invoice.push({ ...invoiceA(), id: "iForge", created_by_id: "uB", customer_id: "cA" });
  assert.equal((await sendDocument(asB.d, { document_type: "invoice", document_id: "iForge", idempotency_key: "key-000004" })).status, 404);
  assert.equal((await sendDocument(asB.d, { document_type: "Customer", document_id: "cA", idempotency_key: "key-000005" })).status, 400);
  assert.equal(asB.twilio.sent.length, 0); assert.equal(s.t.DocumentDelivery.length, 0);
  const asA = deps(s); const ok = await sendDocument(asA.d, { document_type: "estimate", document_id: "eA", idempotency_key: "key-000006" });
  assert.equal((await deliveryStatus(asB.d, ok.delivery.id)).status, 404);
});

test("private media: exact id + token, expires, revoked after Twilio finishes", async () => {
  const s = seed(); const { d, twilio } = deps(s);
  const r = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000007" });
  const u = new URL(twilio.sent[0].mediaUrl); const id = u.searchParams.get("d"); const tok = u.searchParams.get("t");
  const at = Date.parse("2026-11-10T12:00:00Z");
  assert.ok(await mediaDelivery(s.db, id, tok, () => at + 1000));
  assert.equal(await mediaDelivery(s.db, id, tok.slice(0, -1) + (tok.endsWith("A") ? "B" : "A"), () => at), null);
  assert.equal(await mediaDelivery(s.db, "DocumentDelivery_999", tok, () => at), null);
  assert.equal(await mediaDelivery(s.db, id, tok, () => at + MEDIA_TTL_MS + 1), null, "expired");
  await applyProviderStatus(s.db, s.t.DocumentDelivery[0], { status: "sent" }, () => at + 5000);
  assert.equal(await mediaDelivery(s.db, id, tok, () => at + 6000), null, "revoked once sent");
  assert.equal(r.delivery.file_name, "INV-1042.pdf");
});

test("sender missing / not MMS-capable: honest error, nothing sent or stored", async () => {
  const s = seed(); const { d, twilio, files } = deps(s, { twilio: fakeTwilio({ check: { ok: false, reason: "The shop's Twilio number can't send picture messages (MMS)." } }) });
  const r = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000008" });
  assert.equal(r.status, 503); assert.match(r.error, /MMS.*not sent/);
  assert.equal(twilio.sent.length, 0); assert.equal(files.length, 0);
});

test("non-US/Canada or missing phone is refused before anything is built", async () => {
  const s = seed(); s.t.Customer[0].phone = "+447700900123";
  const { d, twilio } = deps(s);
  assert.equal((await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000009" })).status, 400);
  s.t.Customer[0].phone = "";
  assert.match((await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000010" })).error, /no phone/);
  assert.equal(twilio.sent.length, 0);
});

test("carrier/provider rejection: failed with staff-safe reason, media revoked, not shown as sent", async () => {
  const s = seed(); const { d } = deps(s, { twilio: fakeTwilio({ reply: { ok: false, status: 400, data: { code: 21610, message: "Attempt to send to unsubscribed recipient" } } }) });
  const r = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000011" });
  assert.equal(r.status, 502); assert.match(r.error, /opted out/);
  assert.equal(r.delivery.status, "failed");
  assert.ok(Date.parse(s.t.DocumentDelivery[0].media_expires_at) <= Date.parse("2026-11-10T12:00:00Z"));
});

test("status: queued -> sent -> delivered; late/out-of-order events never regress; undelivered keeps carrier reason", async () => {
  assert.equal(nextStatus("delivered", "sent"), "delivered");
  assert.equal(nextStatus("failed", "delivered"), "failed");
  const s = seed(); const { d } = deps(s);
  const r = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-000012" });
  const row = () => s.t.DocumentDelivery.find((x) => x.id === r.delivery.id);
  await applyProviderStatus(s.db, row(), { status: "sent" });
  assert.equal(row().status, "sent");
  await applyProviderStatus(s.db, row(), { status: "delivered" });
  await applyProviderStatus(s.db, row(), { status: "sent" });
  assert.equal(row().status, "delivered");
  const r2 = await sendDocument(d, { document_type: "estimate", document_id: "eA", idempotency_key: "key-000013" });
  const row2 = s.t.DocumentDelivery.find((x) => x.id === r2.delivery.id);
  await applyProviderStatus(s.db, row2, { status: "undelivered", errorCode: "30019" });
  const v = (await deliveryStatus(d, r2.delivery.id)).delivery;
  assert.equal(v.status, "undelivered"); assert.equal(v.delivered, false); assert.match(v.error, /larger than the customer's carrier/);
});

test("dedup: double click with same key sends once; racing different keys send once", async () => {
  const s = seed(); const { d, twilio } = deps(s);
  const [a, b] = await Promise.all([1, 2].map(() => sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-same-01" })));
  const c = await sendDocument(d, { document_type: "invoice", document_id: "iA", idempotency_key: "key-same-01" });
  assert.equal(twilio.sent.length, 1, "one MMS");
  assert.ok([a.status, b.status].includes(200)); assert.equal(c.repeated, true);
  const s2 = seed(); const x = deps(s2);
  const results = await Promise.all(["k-race-0001", "k-race-0002", "k-race-0003"].map((k) => sendDocument(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: k })));
  assert.equal(x.twilio.sent.length, 1, "racing clicks still send once");
  assert.equal(results.filter((r) => r.status === 409).length, 2);
});

test("Twilio signature: matches independent HMAC-SHA1, rejects tampering and wrong URL", async () => {
  const url = "https://app.test/functions/twilioMessageStatus";
  const params = { MessageSid: "MM" + "b".repeat(32), MessageStatus: "delivered", AccountSid: "AC1" };
  const ref = createHmac("sha1", "tok").update(url + Object.keys(params).sort().map((k) => k + params[k]).join("")).digest("base64");
  assert.equal(await twilioSignature("tok", url, params), ref);
  assert.equal(await verifyTwilioSignature("tok", url, params, ref), true);
  assert.equal(await verifyTwilioSignature("tok", url, { ...params, MessageStatus: "failed" }, ref), false);
  assert.equal(await verifyTwilioSignature("tok", url + "?x=1", params, ref), false);
  assert.equal(await verifyTwilioSignature("tok", url, params, ""), false);
});

test("estimate send: saved estimate PDF to its own customer, no portal/sign/login/pay link, estimate untouched", async () => {
  const s = seed(); const { d, twilio, files } = deps(s);
  const before = structuredClone(s.t.Estimate[0]);
  const r = await sendDocument(d, { document_type: "estimate", document_id: "eA", idempotency_key: "key-est-001" });
  assert.equal(r.status, 200); assert.equal(twilio.sent.length, 1);
  const m = twilio.sent[0];
  assert.equal(m.to, "+16135550199");
  assert.match(m.mediaUrl, /\/functions\/documentMedia\?d=DocumentDelivery_\d+&t=[\w-]{43}$/);
  assert.ok(!containsUrl(m.body));
  for (const bad of ["invoicesign", "customerportal", "lbc-customer", "payinvoice", "login", "sign in", "stripe", "http", "download"]) assert.ok(!m.body.toLowerCase().includes(bad), bad);
  assert.ok(files[0].name.startsWith("EST-77") && files[0].name.endsWith(".pdf")); assert.ok(pdfString(files[0].bytes).startsWith("%PDF"));
  assert.equal(r.delivery.status, "queued"); assert.equal(r.delivery.delivered, false);
  assert.deepEqual(s.t.Estimate[0], before, "estimate status/approval untouched");
  const asB = deps(s, { user: userB });
  assert.equal((await sendDocument(asB.d, { document_type: "estimate", document_id: "eA", idempotency_key: "key-est-002" })).status, 404);
  assert.equal(asB.twilio.sent.length, 0);
});