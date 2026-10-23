import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentDialogState } from "../src/lib/paymentTarget.js";
import { assertInvoiceMatchesSource } from "../base44/shared/invoicePaymentGuard.ts";

test("paid linked invoice wins over stale estimate amount_paid: shows real number, zero, disabled", () => {
  const stale = { id: "e1", total: 1.13, amount_paid: 0, balance_due: 1.13 };
  const v = paymentDialogState({ saved: { id: "i1", invoice_number: "INV-9B1647BA37", total: 1.13, amount_paid: 1.13, balance_due: 0 }, fallback: stale });
  assert.equal(v.label, "INV-9B1647BA37");
  assert.equal(v.balance, 0);
  assert.equal(v.paidInFull, true);
  assert.equal(v.canPay, false);
});

test("loading and load failure disable payment; no saved invoice uses source balance", () => {
  assert.equal(paymentDialogState({ saved: undefined, fallback: {} }).canPay, false);
  assert.equal(paymentDialogState({ saved: null, fallback: { total: 5 }, loadError: true }).canPay, false);
  const fresh = paymentDialogState({ saved: null, fallback: { total: 5, amount_paid: 0 } });
  assert.equal(fresh.balance, 5);
  assert.equal(fresh.canPay, true);
});

test("cross-route guard: RO accepts its estimate's invoice with empty repair_order_id; rejects foreign RO link", () => {
  const ro = { id: "r1", estimate_id: "e1" };
  assert.doesNotThrow(() => assertInvoiceMatchesSource({ sourceType: "repair_order", source: ro, invoice: { id: "i1", estimate_id: "e1", repair_order_id: "" } }));
  assert.throws(() => assertInvoiceMatchesSource({ sourceType: "repair_order", source: ro, invoice: { id: "i1", estimate_id: "e1", repair_order_id: "rOther" } }), /does not match/);
  const est = { id: "e1", linked_repair_order_id: "r1" };
  assert.doesNotThrow(() => assertInvoiceMatchesSource({ sourceType: "estimate", source: est, invoice: { id: "i2", repair_order_id: "r1" } }));
  assert.throws(() => assertInvoiceMatchesSource({ sourceType: "estimate", source: est, invoice: { id: "i2", repair_order_id: "r1", estimate_id: "eOther" } }), /does not match/);
});