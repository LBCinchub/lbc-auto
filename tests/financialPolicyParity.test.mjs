import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeTotals, resolveInvoiceInputs, estimatePolicyForRepairOrder } from "../src/lib/financialPolicy.js";

test("frontend and backend policy copies are identical", () => {
  assert.equal(readFileSync("src/lib/financialPolicy.js", "utf8"), readFileSync("base44/shared/financialPolicy.ts", "utf8"));
});

const lines = [{ type: "labor", quantity: 2, unit_price: 100 }, { type: "part", quantity: 1, unit_price: 100 }];

test("discount comes off pre-tax subtotal and never taxes the discount", () => {
  const t = computeTotals(lines, { taxRate: 13, taxTarget: "both", discountType: "$", discountValue: 50 });
  assert.deepEqual([t.discount, t.tax, t.total], [50, 32.5, 282.5]);
});

test("No Tax stays zero", () => {
  assert.equal(computeTotals(lines, { taxRate: 13, taxTarget: "none" }).tax, 0);
});

test("invoice inherits source estimate tax and discount when intent omits them", () => {
  const r = resolveInvoiceInputs({ source: { tax_rate: 0, tax_applies_to: "none", discount: 10, discount_type: "%" }, user: { tax_rate: 13 } });
  assert.deepEqual(r, { taxRate: 0, taxTarget: "none", discount: 10, discountType: "%" });
});

test("estimate to RO carries explicit policy", () => {
  const p = estimatePolicyForRepairOrder({ tax_rate: 5, tax_applies_to: "labor", discount: 20, discount_type: "$" });
  assert.equal(p.tax_rate, 5); assert.equal(p.tax_applies_to, "labor"); assert.equal(p.discount_type, "fixed"); assert.equal(p.discount_value, 20);
});