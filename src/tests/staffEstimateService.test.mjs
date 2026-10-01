// Synthetic in-memory fixtures only. The fixture claim store is atomic because claim() checks-and-sets
// synchronously before any await (single JS thread); it stands in for a verified adapter in tests only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveStaffEstimate, capability, computeTotals, SERVICE_BLOCKERS } from "../base44/shared/staffEstimateService.ts";
import { handleStaffEstimateTurn, evidencePoints } from "../base44/shared/staffAiEstimateHandler.ts";
import { toEstimateView } from "../src/lib/staffEstimateView.js";

const A = { id: "uA", email: "a@shop.test", role: "user", tax_rate: 99, tax_applies_to: "none" }; // session values ignored for tax
const B = { id: "uB", email: "b@shop.test", role: "admin" };
const seed = {
  Customer: [{ id: "cA", full_name: "Ann", shop_owner_email: A.email, created_by_id: "uA" }, { id: "cX", shop_owner_email: B.email, created_by_id: "uA" }],
  Vehicle: [{ id: "vA", customer_id: "cA", year: 2010, make: "Honda", model: "Civic", created_by_id: "uA" }, { id: "vB", customer_id: "cB", created_by_id: "uB" }],
  Invoice: [{ id: "iA1", invoice_number: "INV-A1", status: "paid", vehicle_id: "vA", invoice_date: "2026-05-02", created_by_id: "uA", line_items: [{ type: "part", name: "Front Brake Pads", quantity: 1, unit_price: 89 }, { type: "labor", name: "Front Brake Labor", quantity: 1.5, unit_price: 120 }] }],
  RepairOrder: [{ id: "rA2", order_number: "RO-A2", vehicle_id: "vA", status: "completed", created_date: "2019-01-01", created_by_id: "uA", parts_used: [{ name: "Rear Brake Shoes", quantity: 1, unit_price: 75 }], labor_items: [{ description: "Rear Brake Labor", hours: 1.2, rate: 120 }] }],
  Estimate: [],
};
const ask = "Create an estimate for this customer's 2010 Honda Civic, brakes all around";
const proposal = { customer_id: "cA", vehicle_id: "vA", job: "Brakes all around", fitment_confirmed: { front: true, rear: true }, lines: [
  { type: "part", name: "Front Brake Pads", quantity: 1, unit_price: 89, price_source: "invoice:iA1:0" },
  { type: "labor", name: "Front Brake Labor", quantity: 1.5, unit_price: 120, price_source: "invoice:iA1:1" },
  { type: "part", name: "Rear Brake Shoes", quantity: 1, unit_price: 75, price_source: "ro:rA2:p0" },
  { type: "labor", name: "Rear Brake Labor", quantity: 1.2, unit_price: 120, price_source: "ro:rA2:l0" }] };
const RID = "req-0123456789abcdef";

function fixture({ member = { shop_id: "shopA", owner_user_id: "uA", owner_email: A.email, role: "owner", status: "verified", tax_rate: 13, tax_applies_to: "both" }, failCreateOnce = false, failAudit = false, slowCreate = 0 } = {}) {
  const data = structuredClone(seed); const original = structuredClone(seed); const writes = [];
  const ent = (n) => ({
    get: async (id) => (data[n] || []).find((r) => r.id === id) || null,
    filter: async (q, _s, l = 50, sk = 0) => { if (!q.created_by_id) throw new Error("GLOBAL QUERY"); return (data[n] || []).filter((r) => Object.entries(q).every(([k, v]) => r[k] === v)).slice(sk, sk + l); },
    create: async () => { throw new Error("svc is read-only"); }, update: async () => { throw new Error("svc is read-only"); },
  });
  const svc = new Proxy({}, { get: (_, n) => ent(n) });
  const claims = new Map(); let seq = 0;
  const claimStore = { atomic: true,
    claim({ key, payload_hash }) {
      const c = claims.get(key);
      if (!c) { const number = `EST-S${String(++seq).padStart(6, "0")}`; claims.set(key, { payload_hash, number, token: `t${seq}`, live: true }); return Promise.resolve({ state: "acquired", number, token: `t${seq}` }); }
      if (c.payload_hash !== payload_hash) return Promise.resolve({ state: "conflict" });
      if (c.estimate_id) return Promise.resolve({ state: "committed", estimate_id: c.estimate_id, number: c.number });
      if (c.live) return Promise.resolve({ state: "in_progress" });
      c.live = true; c.token += "'"; return Promise.resolve({ state: "acquired", number: c.number, token: c.token });
    },
    async commit({ key, token, estimate_id }) { const c = claims.get(key); if (c.token !== token) throw new Error("stale token"); c.estimate_id = estimate_id; },
    expireLeases() { for (const c of claims.values()) if (!c.estimate_id) c.live = false; },
  };
  let failed = false;
  const writer = {
    async create(rec) { if (slowCreate) await new Promise((r) => setTimeout(r, slowCreate)); const row = { ...rec, id: `e${data.Estimate.length + 1}`, created_by_id: "uA" }; data.Estimate.push(row); writes.push(row.id);
      if (failCreateOnce && !failed) { failed = true; throw new Error("network lost after commit"); } return { id: row.id }; },
    get: async (id) => data.Estimate.find((e) => e.id === id) || null,
    findByNumber: async (num) => data.Estimate.find((e) => e.estimate_number === num && e.created_by_id === "uA") || null,
  };
  const auditor = { async record() { if (failAudit) throw new Error("audit down"); } };
  const intents = new Map();
  const deps = { svc, claims: claimStore, writer, auditor, intentStore: { get: async (id) => intents.get(id) || null },
    membership: { verified: true, resolve: async (uid) => (member && member.owner_user_id === uid ? member : null) } };
  return { data, original, writes, deps, claimStore, intents };
}
const save = (f, over = {}) => saveStaffEstimate({ deps: f.deps, user: A, latestMessage: ask, proposal, requestId: RID, today: "2026-10-01", ...over });
const untouched = (f) => { for (const k of ["Customer", "Vehicle", "Invoice", "RepairOrder"]) assert.deepEqual(f.data[k], f.original[k], `${k} unchanged`); };

test("default configuration: unavailable with specific reasons, nothing written", async () => {
  const cap = capability({});
  assert.equal(cap.available, false);
  assert.deepEqual(cap.reasons, [SERVICE_BLOCKERS.membership, SERVICE_BLOCKERS.claims, SERVICE_BLOCKERS.writer]);
  const out = await handleStaffEstimateTurn({ deps: { svc: fixture().deps.svc }, user: A, body: { message: ask, proposal, request_id: RID } });
  assert.equal(out.kind, "unavailable");
  assert.match(out.points[0], /Estimate creation is unavailable/);
});

test("verified adapters: real persisted estimate, server totals from shop tax, receipt only after re-read", async () => {
  const f = fixture();
  const r = await save(f);
  assert.equal(r.status, "created");
  assert.equal(f.data.Estimate.length, 1);
  const e = f.data.Estimate[0];
  assert.equal(e.estimate_number, "EST-S000001");
  assert.deepEqual({ l: e.labor_total, p: e.parts_total, t: e.tax_amount, g: e.grand_total }, { l: 324, p: 164, t: 63.44, g: 551.44 });
  assert.equal(e.tax_rate, 13, "tax from verified shop settings, not session fields");
  assert.equal(e.status, "draft");
  assert.equal(r.receipt.open_path, "/EstimateDetail/e1");
  assert.match(r.copy_text, /^Estimate EST-S000001/);
  untouched(f);
});

test("concurrent and replayed requests produce exactly one estimate; payload change on same id conflicts", async () => {
  const f = fixture({ slowCreate: 10 });
  const rs = await Promise.all(Array.from({ length: 5 }, () => save(f)));
  assert.equal(f.data.Estimate.length, 1);
  assert.equal(rs.filter((r) => r.status === "created").length, 1);
  assert.equal(rs.filter((r) => r.status === "in_progress").length, 4);
  const replay = await save(f);
  assert.equal(replay.replay, true); assert.equal(replay.receipt.id, "e1"); assert.equal(f.data.Estimate.length, 1);
  await assert.rejects(save(f, { proposal: { ...proposal, lines: proposal.lines.slice(0, 2), job: "front brakes" } }), /different estimate/);
  assert.equal(f.data.Estimate.length, 1);
});

test("uncertain commit and audit failure recover without duplicates or deletes", async () => {
  const f = fixture({ failCreateOnce: true });
  await assert.rejects(save(f), /network lost/);
  assert.equal(f.data.Estimate.length, 1, "committed despite error");
  assert.equal((await save(f)).status, "in_progress", "live lease blocks a second create");
  f.claimStore.expireLeases();
  const r = await save(f);
  assert.equal(r.status, "created"); assert.equal(r.receipt.id, "e1"); assert.equal(f.data.Estimate.length, 1);
  const g = fixture({ failAudit: true });
  const a = await save(g);
  assert.equal(a.created, true); assert.equal(a.audit, "pending"); assert.equal(g.data.Estimate.length, 1);
});

test("tenant and role denials; wrong customer/vehicle rejected; no writes", async () => {
  for (const member of [null, { shop_id: "shopA", owner_user_id: "uA", owner_email: A.email, role: "owner", status: "pending", tax_rate: 13, tax_applies_to: "both" },
                        { shop_id: "shopA", owner_user_id: "uA", owner_email: A.email, role: "estimator", status: "verified", tax_rate: 13, tax_applies_to: "both" }]) {
    const f = fixture({ member });
    await assert.rejects(save(f), /Not a verified owner/); assert.equal(f.data.Estimate.length, 0);
  }
  const f = fixture();
  await assert.rejects(save(f, { user: B }), /Not a verified owner/, "app-wide admin is not membership");
  await assert.rejects(save(f, { proposal: { ...proposal, customer_id: "cX" } }), /not found in this shop/);
  await assert.rejects(save(f, { proposal: { ...proposal, vehicle_id: "vB" } }), /not found in this shop/);
  assert.equal(f.data.Estimate.length, 0); untouched(f);
});

test("no invented prices, hours or tax: unverified lines and missing tax stop the save", async () => {
  const f = fixture();
  const inv = await save(f, { proposal: { ...proposal, lines: proposal.lines.map((l, i) => (i === 1 ? { ...l, quantity: 2 } : l)) } });
  assert.equal(inv.status, "missing_details"); assert.match(inv.missing[0], /Front Brake Labor/);
  const noTax = fixture({ member: { shop_id: "shopA", owner_user_id: "uA", owner_email: A.email, role: "owner", status: "verified" } });
  const t = await save(noTax);
  assert.ok(t.missing.includes("Shop Tax Settings"));
  assert.equal(f.data.Estimate.length + noTax.data.Estimate.length, 0);
});

test("negated/quoted intent stays read-only; server-held follow-up intent creates", async () => {
  const f = fixture();
  for (const m of ["Don't create an estimate yet", 'He said "create an estimate"']) {
    const o = await handleStaffEstimateTurn({ deps: f.deps, user: A, body: { message: m, proposal, request_id: RID } });
    assert.equal(o.kind, "read_only");
  }
  f.intents.set("uA", { tenant: A.email, intent: "create" });
  const o = await handleStaffEstimateTurn({ deps: f.deps, user: A, body: { message: "Rear has drums, confirmed", proposal, request_id: RID } });
  assert.equal(o.kind, "created"); assert.equal(f.data.Estimate.length, 1);
});

test("staff evidence points cite eligible same-shop refs; empty history says no price was invented", async () => {
  const f = fixture();
  const o = await handleStaffEstimateTurn({ deps: f.deps, user: A, body: { message: "what did we charge for brakes", customer_id: "cA", vehicle_id: "vA", job: "brakes all around" } });
  assert.equal(o.kind, "evidence");
  assert.ok(o.points.some((p) => p.startsWith("INV-A1 (exact, 2026-05-02)")));
  assert.ok(o.points.some((p) => /RO-A2 .*over 2 years old/.test(p)));
  assert.match(evidencePoints({ no_history: true })[0], /none was invented/);
});

test("widget view: only server receipts with the real route get Open/Copy; unavailable is explicit", async () => {
  const f = fixture();
  const o = await handleStaffEstimateTurn({ deps: f.deps, user: A, body: { message: ask, proposal, request_id: RID } });
  const v = toEstimateView(o);
  assert.equal(v.openPath, "/EstimateDetail/e1");
  assert.ok(v.copyText.includes("Total: $551.44") && !/invoice:|ro:|@|Ann/.test(v.copyText), "no staff evidence or PII in copy");
  assert.equal(toEstimateView({ ...o, receipt: { ...o.receipt, open_path: "https://evil/x" } }).openPath, null);
  assert.equal(toEstimateView({ kind: "missing_details", points: ["Need: Tax"], receipt: o.receipt, copy_text: "x" }).copyText, "");
  const u = toEstimateView(await handleStaffEstimateTurn({ deps: {}, user: A, body: { message: ask } }));
  assert.equal(u.unavailable, true);
  assert.equal(toEstimateView(null), null);
});

test("server totals honour tax_applies_to and skip zero-quantity lines", () => {
  const L = [{ type: "labor", quantity: 1, unit_price: 100 }, { type: "part", quantity: 2, unit_price: 10 }, { type: "part", quantity: 0, unit_price: 50 }];
  assert.equal(computeTotals(L, { rate: 10, applies_to: "labor" }).grand_total, 130);
  assert.equal(computeTotals(L, { rate: 10, applies_to: "parts" }).grand_total, 122);
  assert.equal(computeTotals(L, { rate: 10, applies_to: "none" }).grand_total, 120);
});