// Synthetic fixtures only. Exercises the real shared server logic against a non-unique mock store.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "./helpers/mockEntities.mjs";
import { convertEstimate } from "../base44/shared/convertEstimateCore.ts";
import { withLease, acquireLease } from "../base44/shared/recordLease.ts";
import { applyPayments, paymentAlreadyApplied } from "../base44/shared/invoicePaymentGuard.ts";
import { resolveEstimateRepairOrder, linkPatches, assertConsistent } from "../base44/shared/financialLinks.ts";

const user = { id: "userA", email: "a@shop.test" };
const seed = (status = "approved") => ({
  Estimate: [{ id: "e1", status, customer_id: "c1", vehicle_id: "v1", created_by_id: "userA", estimate_number: "EST-1" }],
  Customer: [{ id: "c1", created_by_id: "userA" }],
  Vehicle: [{ id: "v1", customer_id: "c1", created_by_id: "userA" }],
});
const fast = { attempts: 200, delayMs: 2 };

test("conversion: draft -> 409, mismatched vehicle -> 409", async () => {
  const s1 = makeStore(seed("draft"));
  await assert.rejects(convertEstimate({ svc: s1.entities, db: s1.entities, user, estimateId: "e1", lease: fast }), (e) => e.status === 409);
  const s2 = makeStore({ ...seed(), Vehicle: [{ id: "v1", customer_id: "cX", created_by_id: "userA" }] });
  await assert.rejects(convertEstimate({ svc: s2.entities, db: s2.entities, user, estimateId: "e1", lease: fast }), (e) => e.status === 409);
});

test("conversion: 10 concurrent requests create exactly one RO", async () => {
  const s = makeStore(seed());
  const results = await Promise.all(Array.from({ length: 10 }, () => convertEstimate({ svc: s.entities, db: s.entities, user, estimateId: "e1", lease: fast })));
  assert.equal(s.tables.RepairOrder.length, 1);
  assert.equal(new Set(results.map((r) => r.repair_order.id)).size, 1);
  assert.equal(s.tables.Estimate[0].linked_repair_order_id, s.tables.RepairOrder[0].id);
});

test("conversion: crash after RO create (before link) recovers without a duplicate", async () => {
  let crashed = false;
  const s = makeStore(seed(), { failOn: (op, name) => op === "create" && name === "RepairOrder" && !crashed && (crashed = true) });
  await assert.rejects(convertEstimate({ svc: s.entities, db: s.entities, user, estimateId: "e1", lease: fast }));
  const retry = await convertEstimate({ svc: s.entities, db: s.entities, user, estimateId: "e1", lease: fast });
  assert.equal(s.tables.RepairOrder.length, 1);
  assert.equal(retry.reused, true);
  assert.equal(s.tables.Estimate[0].linked_repair_order_id, s.tables.RepairOrder[0].id);
});

test("lease: expired lease from a crashed holder is reclaimable; live lease is not", async () => {
  const s = makeStore({ Invoice: [{ id: "i1" }] });
  assert.equal(await acquireLease(s.entities, "Invoice", "i1", "dead", 60000, () => Date.now() - 120000), true);
  assert.equal(await acquireLease(s.entities, "Invoice", "i1", "live"), true, "expired lease reclaimed");
  assert.equal(await acquireLease(s.entities, "Invoice", "i1", "other"), false, "live lease blocks");
});

test("lease: record with explicit null lease field is acquirable exactly once", async () => {
  const s = makeStore({ Invoice: [{ id: "i1", financial_lease_until: null, financial_lease_owner: null }] });
  const results = await Promise.all(["a", "b", "c"].map((o) => acquireLease(s.entities, "Invoice", "i1", o)));
  assert.equal(results.filter(Boolean).length, 1, "exactly one racer wins");
});

// Mirrors financialDocumentAction's record_payment critical section.
async function recordPayment(s, key, amount) {
  return withLease(s.entities, "Invoice", "i1", async () => {
    const cur = await s.entities.Invoice.get("i1");
    if (paymentAlreadyApplied(cur, key)) return "replay";
    const { update } = applyPayments(cur, [{ amount, method: "cash" }], "2026-10-23", key);
    await s.entities.Invoice.update("i1", update);
    await s.entities.FinancialWorkflowEvent.create({ idempotency_key: key });
    return "applied";
  }, fast);
}

test("payments: concurrent same-key requests apply once; concurrent different keys cannot overpay", async () => {
  const s = makeStore({ Invoice: [{ id: "i1", total: 1.13, balance_due: 1.13, amount_paid: 0, payment_history: [] }] });
  await Promise.all(Array.from({ length: 5 }, () => recordPayment(s, "k1", 1.13)));
  assert.equal(s.tables.Invoice[0].payment_history.length, 1);
  assert.equal(s.tables.Invoice[0].balance_due, 0);
  const t = makeStore({ Invoice: [{ id: "i1", total: 1.13, balance_due: 1.13, amount_paid: 0, payment_history: [] }] });
  const out = await Promise.allSettled([recordPayment(t, "a", 1.13), recordPayment(t, "b", 1.13)]);
  assert.equal(out.filter((o) => o.status === "rejected").length, 1, "second payment exceeds balance");
  assert.equal(t.tables.Invoice[0].amount_paid, 1.13);
});

test("payments: crash after invoice write (before audit event) does not double-apply on retry", async () => {
  let crashed = false;
  const s = makeStore({ Invoice: [{ id: "i1", total: 1.13, balance_due: 1.13, amount_paid: 0, payment_history: [] }] }, { failOn: (op, name) => op === "update" && name === "Invoice" && !crashed && (crashed = true) });
  await assert.rejects(recordPayment(s, "k1", 1.13));
  assert.equal(await recordPayment(s, "k1", 1.13), "replay");
  assert.equal(s.tables.Invoice[0].payment_history.length, 1);
});

// Mirrors financialDocumentAction's create critical section (lease + re-check inside).
async function createInvoice(s, key) {
  return withLease(s.entities, "Customer", "c1", async () => {
    const prior = (await s.entities.FinancialWorkflowEvent.filter({ idempotency_key: key }))[0];
    if (prior) return prior.invoice_id;
    const linked = (await s.entities.Invoice.filter({ estimate_id: "e1" }))[0];
    if (linked) return linked.id;
    const inv = await s.entities.Invoice.create({ estimate_id: "e1", customer_id: "c1", total: 1.13 });
    await s.entities.FinancialWorkflowEvent.create({ idempotency_key: key, invoice_id: inv.id });
    return inv.id;
  }, fast);
}

test("invoices: concurrent creates (same or different keys) for one estimate yield one invoice; crash after create recovers", async () => {
  const s = makeStore(seed());
  const ids = await Promise.all([createInvoice(s, "k1"), createInvoice(s, "k1"), createInvoice(s, "k2")]);
  assert.equal(s.tables.Invoice.length, 1);
  assert.equal(new Set(ids).size, 1);
  let crashed = false;
  const t = makeStore(seed(), { failOn: (op, name) => op === "create" && name === "Invoice" && !crashed && (crashed = true) });
  await assert.rejects(createInvoice(t, "k1"));
  await createInvoice(t, "k1");
  assert.equal(t.tables.Invoice.length, 1);
});

const owned = (s) => ({
  getOwned: async (e, id) => { const r = await s.entities[e].get(id); if (r.created_by_id !== "userA") throw new Error("not found in this shop"); return r; },
  findOwned: async (e, q) => (await s.entities[e].filter(q)).filter((r) => r.created_by_id === "userA"),
});

test("links: Estimate -> RO -> Cash Out resolves the converted RO and fills empty invoice.repair_order_id", async () => {
  const s = makeStore({ RepairOrder: [{ id: "r1", estimate_id: "e1", customer_id: "c1", vehicle_id: "v1", created_by_id: "userA", order_number: "RO-1" }] });
  const estimate = { id: "e1", customer_id: "c1", vehicle_id: "v1", linked_repair_order_id: "r1", linked_invoice_id: "i1" };
  const ro = await resolveEstimateRepairOrder({ estimate, customerId: "c1", vehicleId: "v1", ...owned(s) });
  assert.equal(ro.id, "r1");
  const p = linkPatches({ invoice: { id: "i1", invoice_number: "INV-1", estimate_id: "e1", repair_order_id: "" }, estimate, repairOrder: ro });
  assert.deepEqual(p.invoice, { repair_order_id: "r1" });
  assert.equal(p.repairOrder.linked_invoice_id, "i1");
  assert.equal(p.estimate, null, "estimate links already present are not rewritten");
});

test("links: inverse route (RO without estimate link) is found by estimate_id back-reference", async () => {
  const s = makeStore({ RepairOrder: [{ id: "r1", estimate_id: "e1", customer_id: "c1", vehicle_id: "v1", created_by_id: "userA" }] });
  const ro = await resolveEstimateRepairOrder({ estimate: { id: "e1", customer_id: "c1", vehicle_id: "v1" }, customerId: "c1", vehicleId: "v1", ...owned(s) });
  assert.equal(ro.id, "r1");
  const p = linkPatches({ invoice: { id: "i1", repair_order_id: "r1" }, estimate: { id: "e1" }, repairOrder: ro });
  assert.equal(p.invoice.estimate_id, "e1");
  assert.equal(p.estimate.linked_repair_order_id, "r1");
});

test("links: foreign, mismatched or ambiguous links fail closed", async () => {
  const s = makeStore({ RepairOrder: [
    { id: "rForeign", estimate_id: "e1", customer_id: "c1", vehicle_id: "v1", created_by_id: "userB" },
    { id: "rOtherCust", estimate_id: "e1", customer_id: "c9", vehicle_id: "v9", created_by_id: "userA" },
    { id: "rOtherEst", estimate_id: "e2", customer_id: "c1", vehicle_id: "v1", created_by_id: "userA" },
  ] });
  await assert.rejects(resolveEstimateRepairOrder({ estimate: { id: "e1", linked_repair_order_id: "rForeign" }, customerId: "c1", vehicleId: "v1", ...owned(s) }), /another shop|not found/);
  await assert.rejects(resolveEstimateRepairOrder({ estimate: { id: "e1", linked_repair_order_id: "rOtherCust" }, customerId: "c1", vehicleId: "v1", ...owned(s) }), /does not match/);
  await assert.rejects(resolveEstimateRepairOrder({ estimate: { id: "e1", linked_repair_order_id: "rOtherEst" }, customerId: "c1", vehicleId: "v1", ...owned(s) }), /different estimate/);
  assert.equal(await resolveEstimateRepairOrder({ estimate: { id: "e1" }, customerId: "c1", vehicleId: "v1", ...owned(s) }), null, "foreign/mismatched inferred candidates ignored");
  assert.throws(() => assertConsistent("Invoice", { customer_id: "c2" }, "c1", "v1"));
  const keep = linkPatches({ invoice: { id: "i1", repair_order_id: "rX", estimate_id: "eX" }, estimate: { id: "e1", linked_invoice_id: "iZ" }, repairOrder: { id: "r1", linked_invoice_id: "iZ" } });
  assert.deepEqual(keep.invoice, {});
  assert.equal(keep.repairOrder, null);
});