// "Send As Text": synthetic fixtures and mocks only. No live records, no network, no real Twilio.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDocumentText, smsInfo, hasLink, TWILIO_BODY_MAX, MAX_TEXT_PARTS } from "../base44/shared/documentText.ts";
import { sendDocumentText, prepareText, textStatus } from "../base44/shared/documentTextDelivery.ts";
import { sendDocument, applyProviderStatus } from "../base44/shared/documentDelivery.ts";
import { buildDocumentModel } from "../base44/shared/documentPdfModel.ts";
import { pdfState, textSendState, TEXT_LABELS } from "../src/components/document-delivery/deliveryUi.js";

const A = "shop-a@example.test", B = "shop-b@example.test";
const userA = { id: "uA", email: A, role: "user", business_name: "Maple Auto", phone: "613-555-0100", address: "1 Main St, Ottawa", business_email: "service@mapleauto.ca" };
const userB = { id: "uB", email: B, role: "user", business_name: "Birch Garage", phone: "343-555-0177", address: "9 Oak Rd, Kanata" };
const custA = { id: "cA", created_by_id: "uA", full_name: "Jane Driver", phone: "613-555-0199", email: "jane@example.test", address: "5 Elm PRIVATE-ADDR" };
const custB = { id: "cB", created_by_id: "uB", full_name: "Bob Owner", phone: "6135550111" };
const vehA = { id: "vA", created_by_id: "uA", customer_id: "cA", year: 2019, make: "Honda", model: "Civic", vin: "2HGFC2F59KH000000", license_plate: "ABCD123" };
const invoiceA = () => ({
  id: "iA", created_by_id: "uA", invoice_number: "INV-1042", customer_id: "cA", customer_name: "Jane Driver", vehicle_id: "vA", invoice_date: "2026-11-05",
  line_items: [
    { type: "part", name: "Front Pads", description: "Ceramic", quantity: 1, unit_price: 80, total: 80 },
    { type: "labor", name: "Brake Service", quantity: 1, unit_price: 20, total: 20 },
    { type: "part", name: "Rear Rotors", quantity: 0, unit_price: 150, total: 0 },
  ],
  parts_used: [{ name: "Front Pads", quantity: 1, unit_price: 80, total: 80, supplier: "SECRET-SUPPLIER" }],
  parts_total: 80, labor_total: 20, discount: 10, discount_type: "$", tax_rate: 13, tax_applies_to: "both", tax_amount: 11.7, total: 101.7,
  amount_paid: 50, balance_due: 51.7, status: "partial", auth_status: "pending", auth_token: "AUTH-TOKEN-SECRET",
  payment_history: [{ date: "2026-11-05", amount: 50, method: "Cash", note: "INTERNAL-NOTE" }],
  technician_notes: "TECH-ONLY retorque", customer_note: "Check brakes in 6 months",
  ghost_status: "active", ghost_items: [{ type: "part", name: "GHOST-ITEM", quantity: 1, unit_price: 999, total: 999 }], ghost_notes: "GHOST-NOTE", ghost_total: 999,
});
const estimateA = () => ({
  id: "eA", created_by_id: "uA", estimate_number: "EST-77", customer_id: "cA", customer_name: "Jane Driver", vehicle_id: "vA", estimate_date: "2026-11-01",
  parts_items: [{ name: "Battery", details: "Group 35", quantity: 1, unit_price: 189.99, total: 189.99 }, { name: "Wiper Blades", quantity: 0, unit_price: 30, total: 0 }],
  labor_items: [{ description: "Install Battery", hours: 0.5, rate: 120, total: 60 }],
  parts_total: 189.99, labor_total: 60, discount: 10, discount_type: "%", tax_rate: 13, tax_applies_to: "both", tax_amount: 29.25, grand_total: 254.24,
  amount_paid: 0, status: "sent", auth_status: "pending", notes: "EST-INTERNAL-NOTE battery weak",
});
const estimateB = () => ({ ...estimateA(), id: "eB", created_by_id: "uB", estimate_number: "EST-B9", customer_id: "cB", customer_name: "Bob Owner", vehicle_id: "" });

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
const seed = () => store({ Invoice: [invoiceA()], Estimate: [estimateA(), estimateB()], Customer: [custA, custB], Vehicle: [vehA], DocumentDelivery: [] });
const sid = (i) => "SM" + String(i).padStart(32, "0");
function fakeTwilio({ check = { ok: true }, replies = [] } = {}) {
  const sent = []; let i = 0;
  return {
    sent,
    smsCheck: async () => check,
    sendSms: async (m) => { sent.push(m); const r = replies[i++]; return r || { ok: true, status: 201, data: { sid: sid(sent.length), status: "queued" } }; },
    fetchMessage: async () => ({ ok: true, data: { status: "delivered" } }),
  };
}
const deps = (s, { user = userA, twilio = fakeTwilio(), currency = "" } = {}) => ({ twilio, d: { db: s.db, tenant: user.email, user, twilio, currency, now: () => Date.parse("2026-11-10T12:00:00Z"), callbackUrl: "https://app.test/functions/twilioMessageStatus" } });
const preview = async (d, type, id) => prepareText(d, { document_type: type, document_id: id });
const SECRETS = ["SECRET-SUPPLIER", "TECH-ONLY", "INTERNAL-NOTE", "AUTH-TOKEN", "GHOST", "EST-INTERNAL-NOTE", "PRIVATE-ADDR", "2HGFC2F59KH000000", "shop-a@example.test", "jane@example.test", "lbc auto", "http", "www."];

test("invoice text: shop identity first, exact saved amounts, recommended line outside total, no internal data or links", () => {
  const r = buildDocumentText("invoice", invoiceA(), custA, vehA, userA, { currency: "cad" });
  assert.equal(r.part_count, 1);
  const body = r.parts[0].body;
  assert.ok(body.startsWith("Maple Auto\n613-555-0100 | 1 Main St, Ottawa | service@mapleauto.ca\n"), body);
  for (const want of ["INVOICE INV-1042", "Date: Nov 5, 2026", "Vehicle: 2019 Honda Civic", "- Front Pads x1: $80.00", "- Brake Service x1: $20.00", "- Rear Rotors (Recommended, not included in total)",
    "Subtotal: $100.00", "Discount: -$10.00", "Tax (13%): $11.70", "Total: $101.70 CAD", "Paid: $50.00", "Balance Due: $51.70 CAD", "Note: Check brakes in 6 months", "Contact Maple Auto at 613-555-0100", "Reply STOP to opt out."]) {
    assert.ok(body.includes(want), `text shows ${want}`);
  }
  for (const bad of SECRETS) assert.ok(!body.toLowerCase().includes(bad.toLowerCase()), `text hides ${bad}`);
  assert.equal(hasLink(body), false);
  assert.equal(r.parts[0].encoding, "GSM-7");
});

test("estimate text: labelled Estimate (not invoice/approval), percent discount, hours, no estimate notes", () => {
  const body = buildDocumentText("estimate", estimateA(), custA, vehA, userA).parts[0].body;
  for (const want of ["ESTIMATE EST-77", "This is an estimate, not an invoice or an approval.", "- Battery x1: $189.99", "- Install Battery 0.5 hr: $60.00", "- Wiper Blades (Recommended, not included in total)", "Subtotal: $249.99", "Discount (10%): -$25.00", "Tax (13%): $29.25", "Total: $254.24"]) {
    assert.ok(body.includes(want), `estimate shows ${want}`);
  }
  assert.ok(!/\bINVOICE\b|Balance Due|Paid:/.test(body));
  assert.ok(!body.includes("Total: $254.24 ") && !/CAD|USD/.test(body), "no invented currency code without a verified one");
  for (const bad of SECRETS) assert.ok(!body.toLowerCase().includes(bad.toLowerCase()), `estimate hides ${bad}`);
});

test("two shops are branded with their own identity; missing shop name blocks instead of a generic LBC name", () => {
  const b = buildDocumentText("estimate", estimateB(), custB, null, userB).parts[0].body;
  assert.ok(b.startsWith("Birch Garage\n343-555-0177 | 9 Oak Rd, Kanata\n"));
  assert.ok(!b.includes("Maple") && !b.includes("@"), "no other shop, no login email fallback");
  const none = buildDocumentText("invoice", invoiceA(), custA, vehA, { ...userA, business_name: "" });
  assert.equal(none.code, "shop_identity_missing");
  const noBizEmail = buildDocumentText("invoice", invoiceA(), custA, vehA, { ...userA, business_email: "" }).parts[0].body;
  assert.ok(!noBizEmail.includes(A), "owner login email never used");
});

test("zero values are kept exactly; inconsistent or missing money blocks instead of inventing numbers", () => {
  const zero = { ...invoiceA(), line_items: [{ type: "labor", name: "Free Inspection", quantity: 1, unit_price: 0, total: 0 }], parts_total: 0, labor_total: 0, discount: 0, tax_rate: 0, tax_amount: 0, total: 0, amount_paid: 0, balance_due: 0, customer_note: "" };
  const z = buildDocumentText("invoice", zero, custA, vehA, userA).parts[0].body;
  for (const want of ["Subtotal: $0.00", "Tax: $0.00", "Total: $0.00", "Paid: $0.00", "Balance Due: $0.00"]) assert.ok(z.includes(want), want);
  assert.ok(!z.includes("Discount"));
  assert.match(buildDocumentText("invoice", { ...invoiceA(), total: 150 }, custA, vehA, userA).error, /don't add up/);
  assert.match(buildDocumentText("invoice", { ...invoiceA(), balance_due: 10 }, custA, vehA, userA).error, /balance due/);
  assert.match(buildDocumentText("estimate", { ...estimateA(), grand_total: null }, custA, vehA, userA).error, /no saved total/);
  assert.match(buildDocumentText("estimate", { ...estimateA(), tax_amount: null }, custA, vehA, userA).error, /no saved tax/);
  assert.match(buildDocumentText("invoice", { ...invoiceA(), invoice_number: "" }, custA, vehA, userA).error, /number/);
});

test("links in shop profile or line names are removed; segments: GSM-7 vs Unicode", () => {
  const sneaky = { ...invoiceA(), line_items: [{ type: "part", name: "Pads see https://evil.test/pay or www.x.com", quantity: 1, unit_price: 80, total: 80 }, { type: "labor", name: "Labor", quantity: 1, unit_price: 20, total: 20 }] };
  const body = buildDocumentText("invoice", sneaky, custA, vehA, { ...userA, business_name: "Maple Auto mapleauto.ca", address: "1 Main https://x.co" }).parts[0].body;
  assert.equal(hasLink(body), false, body);
  assert.deepEqual([smsInfo("a".repeat(160)).segments, smsInfo("a".repeat(161)).segments, smsInfo("a".repeat(306)).segments, smsInfo("a".repeat(307)).segments], [1, 2, 2, 3]);
  assert.equal(smsInfo("€".repeat(80)).units, 160); assert.equal(smsInfo("€".repeat(81)).segments, 2);
  assert.deepEqual([smsInfo("é".repeat(160)).encoding, smsInfo("’").encoding], ["GSM-7", "UCS-2"]);
  assert.deepEqual([smsInfo("’".repeat(70)).segments, smsInfo("’".repeat(71)).segments, smsInfo("’".repeat(135)).segments], [1, 2, 3]);
  const uni = buildDocumentText("estimate", { ...estimateA(), parts_items: [{ name: "Driver’s Mirror", quantity: 1, unit_price: 189.99, total: 189.99 }] }, custA, vehA, userA);
  assert.equal(uni.encoding, "UCS-2"); assert.ok(uni.parts[0].body.includes("Driver’s Mirror"), "names preserved exactly");
});

const longInvoice = (n, name = (i) => `Brake Hardware Kit Line ${i + 1}`) => {
  const items = Array.from({ length: n }, (_, i) => ({ type: "part", name: name(i), quantity: 1, unit_price: 1, total: 1 }));
  return { ...invoiceA(), line_items: items, parts_total: n, labor_total: 0, discount: 0, tax_rate: 0, tax_amount: 0, total: n, amount_paid: 0, balance_due: n };
};

test("long documents: numbered parts within Twilio's limit keep every line and the totals; oversize is blocked, never cut", () => {
  const r = buildDocumentText("invoice", longInvoice(90), custA, vehA, userA);
  assert.ok(r.part_count > 1 && r.part_count <= MAX_TEXT_PARTS, `parts=${r.part_count}`);
  const all = r.parts.map((p) => p.body).join("\n");
  for (let i = 1; i <= 90; i += 1) assert.ok(all.includes(`- Brake Hardware Kit Line ${i} x1: $1.00`), `line ${i}`);
  assert.ok(r.parts.every((p) => p.body.length <= TWILIO_BODY_MAX));
  assert.ok(r.parts[0].body.startsWith(`Maple Auto (1/${r.part_count})`));
  assert.ok(r.parts[1].body.startsWith(`Maple Auto - Invoice INV-1042 (2/${r.part_count}), continued:`));
  assert.ok(r.parts.at(-1).body.includes("Total: $90.00") && r.parts.at(-1).body.includes("Reply STOP"));
  assert.equal(r.segments_total, r.parts.reduce((a, p) => a + p.segments, 0));
  const big = buildDocumentText("invoice", longInvoice(400), custA, vehA, userA);
  assert.equal(big.code, "too_long"); assert.match(big.error, /Nothing was cut/);
});

test("send: exact preview to the document's own customer; browser to/body ignored; preview hash required; no financial change", async () => {
  const s = seed(); const { d, twilio } = deps(s);
  const before = structuredClone(s.t.Invoice[0]);
  const p = await preview(d, "invoice", "iA");
  assert.equal(p.to, "•••-•••-0199"); assert.equal(p.shop_name, "Maple Auto");
  assert.equal((await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-000001" })).status, 409, "no preview hash");
  const r = await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-000002", preview_sha256: p.preview_sha256, to: "+19995550000", body: "PAY NOW https://evil.test" });
  assert.equal(r.status, 200); assert.equal(twilio.sent.length, 1);
  assert.equal(twilio.sent[0].to, "+16135550199"); assert.equal(twilio.sent[0].body, p.parts[0].body);
  assert.ok(!("mediaUrl" in twilio.sent[0]) && !("MediaUrl" in twilio.sent[0]), "no attachment");
  assert.equal(r.group.parts[0].status, "queued"); assert.equal(r.group.delivered, 0);
  assert.deepEqual(s.t.Invoice[0], before, "invoice untouched");
  assert.deepEqual(s.t.Customer, [custA, custB]);
  const row = s.t.DocumentDelivery[0];
  assert.equal(row.channel, "sms"); assert.ok(!JSON.stringify(row).includes("Front Pads"), "text body not stored");
  // Document edited after preview: refuse rather than send something staff didn't see.
  s.t.Invoice[0].customer_note = "Changed";
  assert.equal((await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-000003", preview_sha256: p.preview_sha256 })).code, "preview_changed");
  assert.equal(twilio.sent.length, 1);
});

test("tenant isolation: foreign and forged IDs fail closed; other shop can't read status", async () => {
  const s = seed(); const asB = deps(s, { user: userB }); const asA = deps(s);
  assert.equal((await preview(asB.d, "invoice", "iA")).status, 404);
  s.t.Estimate.push({ ...estimateB(), id: "eForge", customer_id: "cA" });
  assert.equal((await preview(asB.d, "estimate", "eForge")).status, 404);
  assert.equal((await sendDocumentText(asB.d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-x00001", preview_sha256: "x" })).status, 404);
  assert.equal((await preview(asB.d, "Customer", "cA")).status, 400);
  const pB = await preview(asB.d, "estimate", "eB");
  assert.equal(pB.shop_name, "Birch Garage");
  const p = await preview(asA.d, "estimate", "eA");
  await sendDocumentText(asA.d, { document_type: "estimate", document_id: "eA", idempotency_key: "grp-a00001", preview_sha256: p.preview_sha256 });
  assert.equal((await textStatus(asB.d, "grp-a00001")).status, 404);
  assert.equal(asB.twilio.sent.length, 0);
});

test("MMS-ineligible but SMS-ready sender still sends text; SMS not configured is an honest error", async () => {
  const s = seed();
  const ok = deps(s, { twilio: fakeTwilio({ check: { ok: true } }) });
  const p = await preview(ok.d, "invoice", "iA");
  assert.equal((await sendDocumentText(ok.d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-mms001", preview_sha256: p.preview_sha256 })).status, 200);
  const off = deps(seed(), { twilio: fakeTwilio({ check: { ok: false, reason: "Text messaging isn't set up." } }) });
  const r = await sendDocumentText(off.d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-off001", preview_sha256: p.preview_sha256 });
  assert.equal(r.status, 503); assert.match(r.error, /not sent/); assert.equal(off.twilio.sent.length, 0);
});

test("idempotency: double click and repeat send once; racing windows send once", async () => {
  const s = seed(); const { d, twilio } = deps(s);
  const p = await preview(d, "invoice", "iA");
  const input = { document_type: "invoice", document_id: "iA", idempotency_key: "grp-same01", preview_sha256: p.preview_sha256 };
  const [a, b] = await Promise.all([sendDocumentText(d, input), sendDocumentText(d, input)]);
  const c = await sendDocumentText(d, input);
  assert.equal(twilio.sent.length, 1); assert.ok([a, b].some((x) => x.repeated)); assert.equal(c.repeated, true);
  const s2 = seed(); const x = deps(s2);
  const res = await Promise.all(["grp-race01", "grp-race02", "grp-race03"].map((k) => sendDocumentText(x.d, { ...input, idempotency_key: k })));
  assert.equal(x.twilio.sent.length, 1, "racing windows send once");
  assert.equal(res.filter((r) => r.status === 409).length, 2);
});

test("timeout / unknown answer: never retried automatically; later parts not sent; blocks a new send", async () => {
  const s = seed(); const tw = fakeTwilio({ replies: [{ ok: false, unknown: true, status: 0, data: { message: "timeout" } }] });
  const { d } = deps(s, { twilio: tw });
  const p = await preview(d, "invoice", "iA");
  const r = await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-unk001", preview_sha256: p.preview_sha256 });
  assert.equal(r.group.parts[0].status, "unknown"); assert.equal(r.group.unknown, true); assert.equal(r.group.can_resume, false);
  const again = await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-unk001", preview_sha256: p.preview_sha256, resume: true });
  const fresh = await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-unk002", preview_sha256: p.preview_sha256 });
  assert.equal(tw.sent.length, 1, "no automatic or repeat resend after an unknown result");
  assert.equal(again.repeated, true); assert.equal(fresh.status, 409);
  assert.match(TEXT_LABELS.unknown, /may or may not/);
});

test("partial failure: tracked per part; resume sends only definitely-failed parts, once", async () => {
  const s = seed(); s.t.Invoice[0] = { ...longInvoice(90), id: "iA", created_by_id: "uA", customer_id: "cA", vehicle_id: "vA" };
  const tw = fakeTwilio({ replies: [undefined, { ok: false, status: 400, data: { code: 21614, message: "not mobile" } }] });
  const { d } = deps(s, { twilio: tw });
  const p = await preview(d, "invoice", "iA");
  const input = { document_type: "invoice", document_id: "iA", idempotency_key: "grp-part01", preview_sha256: p.preview_sha256 };
  const r = await sendDocumentText(d, input);
  const st = r.group.parts.map((x) => x.status);
  assert.equal(st[0], "queued"); assert.equal(st[1], "failed"); assert.ok(st.slice(2).every((x) => x === "not_sent"));
  assert.equal(r.group.accepted, 1); assert.equal(r.group.can_resume, true);
  assert.match(r.group.parts[1].error, /isn't a mobile number/);
  const [x, y] = await Promise.all([sendDocumentText(d, { ...input, resume: true }), sendDocumentText(d, { ...input, resume: true })]);
  const bodies = tw.sent.map((m) => m.body);
  assert.equal(bodies.filter((b) => b === p.parts[0].body).length, 1, "part 1 never resent");
  assert.equal(tw.sent.length, 1 + 1 + (p.part_count - 1), "each remaining part resent exactly once");
  assert.ok([x, y].some((g) => g.group.parts.every((q) => q.status === "queued")));
});

test("status follows provider evidence only; PDF and text sends don't block each other", async () => {
  const s = seed(); const { d } = deps(s);
  const p = await preview(d, "invoice", "iA");
  const r = await sendDocumentText(d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-stat01", preview_sha256: p.preview_sha256 });
  const row = s.t.DocumentDelivery.find((x) => x.group_key === "grp-stat01");
  assert.equal(r.group.parts[0].status, "queued");
  await applyProviderStatus(s.db, row, { status: "sent" });
  assert.equal((await textStatus(d, "grp-stat01")).group.parts[0].status, "delivered", "delivered only after Twilio reports it");
  // A text still queued must not block a PDF, and vice versa.
  const s2 = seed(); const x = deps(s2);
  const pp = await preview(x.d, "invoice", "iA");
  await sendDocumentText(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-mix001", preview_sha256: pp.preview_sha256 });
  const pdfTw = { senderCheck: async () => ({ ok: true }), send: async () => ({ ok: true, data: { sid: "MM" + "c".repeat(32), status: "queued" } }) };
  const pdf = await sendDocument({ ...x.d, twilio: pdfTw, buildModel: buildDocumentModel, render: () => new Uint8Array([37, 80, 68, 70]), storeFile: async () => "private://f", mediaBase: "https://app.test/m" }, { document_type: "invoice", document_id: "iA", idempotency_key: "pdf-mix001" });
  assert.equal(pdf.status, 200, "queued text doesn't block PDF");
  const t2 = await sendDocumentText(x.d, { document_type: "invoice", document_id: "iA", idempotency_key: "grp-mix002", preview_sha256: pp.preview_sha256 });
  assert.equal(t2.status, 409, "second text blocked only by the first text");
});

test("UI: a PDF failure (code 11200) or an MMS-less sender leaves Send As Text enabled", () => {
  const info = { sender_ready: true, latest: null };
  const failed = { id: "d1", status: "failed", error_code: "11200" };
  const st = pdfState(info, failed, false);
  assert.equal(st.pdfFailed, true); assert.equal(st.canOpenText, true); assert.equal(st.showSendPdf, false);
  assert.equal(pdfState({ sender_ready: false, latest: null }, null, false).canOpenText, true);
  assert.equal(pdfState(info, { id: "d2", status: "queued" }, false).canOpenText, true, "PDF in flight doesn't disable text");
  assert.equal(pdfState(null, null, false).canOpenText, true);
  const tInfo = { parts: [{ index: 1 }], sender_ready: true, this_window_key: "k1" };
  assert.equal(textSendState(tInfo, null, false).canSend, true);
  assert.equal(textSendState({ ...tInfo, blocker: "x" }, null, false).canSend, false);
  const g = { group_key: "k1", can_resume: true, parts: [{ status: "failed" }] };
  assert.deepEqual([textSendState(tInfo, g, false).canSend, textSendState(tInfo, g, false).canResume], [false, true]);
  assert.equal(textSendState(tInfo, { ...g, group_key: "old" }, false).canSend, true, "an older send doesn't hide this window's button");
});