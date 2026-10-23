// Synthetic fixtures only — no live records. Covers the RO -> View Invoice -> Record Payment defect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertInvoiceMatchesSource, applyPayments } from "../base44/shared/invoicePaymentGuard.ts";
import { resolvePaymentInvoiceId } from "../src/lib/paymentTarget.js";

const est = { id: "est1", linked_invoice_id: "inv1" };
const ro = { id: "ro1", estimate_id: "est1" }; // RO without linked_invoice_id, like the repro
const inv = { id: "inv1", estimate_id: "est1", repair_order_id: "ro1", total: 22.6, amount_paid: 0, balance_due: 22.6, payment_history: [] };
const other = { id: "inv9", estimate_id: "estX", repair_order_id: "roX", total: 50, balance_due: 50 }; // same tenant, unrelated

test("entry points pay the saved invoice's own id", () => {
  assert.equal(resolvePaymentInvoiceId({ invoice: inv, entityName: "Invoice" }), "inv1", "RO -> View Invoice (saved invoice + RO source)");
  assert.equal(resolvePaymentInvoiceId({ invoice: inv }), "inv1", "Invoices list");
  assert.equal(resolvePaymentInvoiceId({ invoice: est, entityName: "Estimate" }), "inv1", "Estimate entry uses its link");
  assert.equal(resolvePaymentInvoiceId({ invoice: ro, entityName: "RepairOrder" }), "", "unlinked RO falls back to server create-replay");
});

test("existing invoice reused for RO/Estimate sources; unrelated same-tenant invoice rejected", () => {
  assert.doesNotThrow(() => assertInvoiceMatchesSource({ sourceType: "repair_order", source: ro, invoice: inv, requestedInvoiceId: "inv1" }));
  assert.doesNotThrow(() => assertInvoiceMatchesSource({ sourceType: "estimate", source: est, invoice: inv, requestedInvoiceId: "" }));
  assert.throws(() => assertInvoiceMatchesSource({ sourceType: "repair_order", source: ro, invoice: other }), /does not match/);
  assert.throws(() => assertInvoiceMatchesSource({ sourceType: "repair_order", source: ro, invoice: inv, requestedInvoiceId: "inv9" }), /does not match/);
  assert.throws(() => assertInvoiceMatchesSource({ sourceType: "invoice", source: null, invoice: inv, requestedInvoiceId: "inv9" }), /does not match/);
});

test("exact cash amount: one history entry, balance 0, paid", () => {
  const { added, update } = applyPayments(inv, [{ amount: 22.6, method: "cash", note: "SIMULATED QA" }], "2026-10-23");
  assert.equal(added, 22.6);
  assert.equal(update.amount_paid, 22.6); assert.equal(update.balance_due, 0); assert.equal(update.status, "paid");
  assert.equal(update.payment_history.length, 1); assert.equal(update.payment_method, "cash");
});

test("partial then overpay rejected; invalid amounts rejected; no mutation of input", () => {
  const p = applyPayments(inv, [{ amount: 10, method: "cash" }], "d").update;
  assert.equal(p.balance_due, 12.6); assert.equal(p.status, "partial");
  assert.throws(() => applyPayments({ ...inv, ...p }, [{ amount: 12.63 }], "d"), /exceeds/);
  assert.throws(() => applyPayments(inv, [{ amount: 0 }], "d"), /invalid/);
  assert.throws(() => applyPayments(inv, [{ amount: 30 }, { amount: -10 }], "d"), /invalid/);
  assert.equal(inv.payment_history.length, 0);
});

test("replay with same key records exactly one payment (models the server event-key dedupe)", () => {
  const events = []; let row = { ...inv };
  const pay = (key) => { if (events.some((e) => e.key === key && e.invoice_id === row.id)) return row; row = { ...row, ...applyPayments(row, [{ amount: 22.6, method: "cash" }], "d").update }; events.push({ key, invoice_id: row.id }); return row; };
  pay("k1"); pay("k1");
  assert.equal(row.payment_history.length, 1); assert.equal(row.amount_paid, 22.6); assert.equal(events.length, 1);
});