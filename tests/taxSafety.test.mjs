// Synthetic stores only. Executes the real inspection handler logic and real conversion/policy code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeStore } from "./helpers/mockEntities.mjs";
import { inspectFinancialTax } from "../base44/shared/financialTaxInspection.ts";
import { convertEstimate } from "../base44/shared/convertEstimateCore.ts";
import { computeTotals, repairOrderLines, laborToInvoiceLine, partToInvoiceLine, resolveInvoiceInputs, estimatePolicyForRepairOrder, canonicalDiscountType } from "../base44/shared/financialPolicy.ts";

const admin = { id: "userA", email: "a@shop.test", role: "admin" };
const L = (q, p, extra = {}) => ({ type: "labor", quantity: q, unit_price: p, ...extra });
const P = (q, p, extra = {}) => ({ type: "part", quantity: q, unit_price: p, ...extra });
const seed = () => ({
  Customer: [{ id: "c1", created_by_id: "userA" }, { id: "cB", created_by_id: "userB" }],
  Invoice: [
    { id: "own-notax", created_by_id: "userA", customer_id: "c1", tax_rate: 13, tax_applies_to: "none", tax_amount: 0, total: 100, balance_due: 100, line_items: [L(1, 100)] },
    { id: "foreign-paid", created_by_id: "userB", customer_id: "cB", tax_rate: 13, tax_applies_to: "none", tax_amount: 0, total: 100, amount_paid: 100, status: "paid", line_items: [L(1, 100)] },
    { id: "own-parts", created_by_id: "userA", customer_id: "c1", tax_rate: 13, tax_applies_to: "parts", tax_amount: 0, total: 300, line_items: [L(1, 100), P(1, 200)] },
    { id: "own-both-disc", created_by_id: "userA", customer_id: "c1", tax_rate: 13, tax_applies_to: "both", discount: 10, discount_type: "%", tax_amount: 0, total: 270, line_items: [L(1, 100), P(1, 200)] },
    { id: "own-paid", created_by_id: "userA", customer_id: "c1", tax_rate: 13, tax_applies_to: "both", tax_amount: 0, total: 100, amount_paid: 100, status: "paid", line_items: [L(1, 100)] },
    { id: "own-legacy", created_by_id: "userA", customer_id: "c1", tax_rate: 13, tax_amount: 0, total: 100, line_items: [L(1, 100)] },
  ],
});
const run = async (store, body, user = admin) => inspectFinancialTax({ user, body, svc: store.entities });
const snapshot = (s) => JSON.stringify(s.tables);

test("legacy safety: empty body is rejected for scope and writes nothing", async () => {
  const s = makeStore(seed()); const before = snapshot(s);
  await assert.rejects(run(s, {}), (e) => e.status === 400 && e.code === "scope_required");
  assert.equal(snapshot(s), before);
});

test("legacy safety: apply/dry_run:false/allow_paid/shop override all rejected, no writes", async () => {
  const s = makeStore(seed()); const before = snapshot(s);
  for (const body of [{ dry_run: false }, { apply: true }, { allow_paid: true, record_type: "Invoice", record_id: "own-paid" }, { shop_id: "x", record_type: "Invoice", record_id: "foreign-paid" }, { shop_owner_email: "b@shop.test", record_type: "Invoice", record_id: "foreign-paid" }]) {
    await assert.rejects(run(s, body), (e) => e.status === 409 && e.code === "apply_blocked");
  }
  assert.equal(snapshot(s), before);
});

test("legacy safety: non-admin rejected; foreign and legacy-unowned records not returned", async () => {
  const s = makeStore(seed());
  await assert.rejects(run(s, { record_type: "Invoice", record_id: "own-notax" }, { ...admin, role: "user" }), (e) => e.status === 403);
  await assert.rejects(run(s, { record_type: "Invoice", record_id: "foreign-paid" }), (e) => e.status === 404);
  const mixed = makeStore({ ...seed(), Invoice: [{ id: "spoof", created_by_id: "userA", customer_id: "cB", tax_rate: 13, tax_applies_to: "both", line_items: [] }] });
  await assert.rejects(run(mixed, { record_type: "Invoice", record_id: "spoof" }), (e) => e.status === 404);
  const stamped = makeStore({ ...seed(), Invoice: [{ id: "st", created_by_id: "userA", customer_id: "c1", shop_owner_email: "b@shop.test", tax_rate: 13, tax_applies_to: "both", line_items: [] }] });
  await assert.rejects(run(stamped, { record_type: "Invoice", record_id: "st" }), (e) => e.status === 404);
});

test("inspection math: NoTax stays 100, PartsOnly 26, Both 10% discount 305.10", async () => {
  const s = makeStore(seed()); const before = snapshot(s);
  const a = await run(s, { record_type: "Invoice", record_id: "own-notax" });
  assert.equal(a.read_only, true); assert.equal(a.apply_supported, false);
  assert.deepEqual([a.canonical.tax_amount, a.canonical.total], [0, 100]); assert.deepEqual(a.differences, {});
  const b = await run(s, { record_type: "Invoice", record_id: "own-parts" });
  assert.deepEqual([b.canonical.tax_amount, b.canonical.total], [26, 326]);
  const c = await run(s, { record_type: "Invoice", record_id: "own-both-disc" });
  assert.deepEqual([c.canonical.discount, c.canonical.tax_amount, c.canonical.total], [30, 35.1, 305.1]);
  assert.equal(snapshot(s), before);
});

test("inspection: paid original flagged frozen and unchanged; missing policy fails closed", async () => {
  const s = makeStore(seed()); const before = snapshot(s);
  const p = await run(s, { record_type: "Invoice", record_id: "own-paid" });
  assert.equal(p.frozen, true);
  const g = await run(s, { record_type: "Invoice", record_id: "own-legacy" });
  assert.deepEqual(g.policy_missing, ["tax_applies_to"]); assert.equal(g.canonical, null);
  assert.equal(snapshot(s), before);
});

test("exemption: policy honors taxable:false in every mode", () => {
  const lines = [L(1, 100), P(1, 200, { taxable: false })];
  assert.equal(computeTotals(lines, { taxRate: 13, taxTarget: "both" }).tax, 13);
  assert.equal(computeTotals(lines, { taxRate: 13, taxTarget: "parts" }).tax, 0);
  assert.equal(computeTotals(lines, { taxRate: 13, taxTarget: "labor" }).tax, 13);
  assert.equal(computeTotals(lines, { taxRate: 13, taxTarget: "none" }).tax, 0);
  assert.equal(computeTotals(lines, { taxRate: 0, taxTarget: "both" }).tax, 0);
});

test("exemption handoffs: RO lines and invoice source mapping keep explicit false only", () => {
  const ro = { labor_items: [{ hours: 1, rate: 100, taxable: false, private_cost: 9 }], parts_used: [{ quantity: 1, unit_price: 50 }] };
  const rl = repairOrderLines(ro);
  assert.equal(rl[0].taxable, false); assert.equal("taxable" in rl[1], false);
  const inv = [laborToInvoiceLine(ro.labor_items[0]), partToInvoiceLine({ ...ro.parts_used[0], taxable: false, cost: 3 })];
  assert.equal(inv[0].taxable, false); assert.equal(inv[1].taxable, false);
  assert.equal("private_cost" in inv[0], false); assert.equal("cost" in inv[1], false);
  assert.equal("taxable" in laborToInvoiceLine({ hours: 1, rate: 1 }), false);
});

test("conversion: 4 tax modes, zero rate, aliases and exemptions carried to RO with projection", async () => {
  for (const mode of ["both", "labor", "parts", "none"]) {
    const s = makeStore({
      Estimate: [{ id: "e1", status: "approved", customer_id: "c1", vehicle_id: "v1", created_by_id: "userA", estimate_number: "EST-1", tax_rate: mode === "none" ? 0 : 13, tax_applies_to: mode, discount: 10, discount_type: "%",
        labor_items: [{ description: "Brakes", hours: 1, rate: 100, taxable: false, secret: "x" }], parts_items: [{ name: "Pad", quantity: 1, unit_price: 200, internal_cost: 50 }] }],
      Customer: [{ id: "c1", created_by_id: "userA" }], Vehicle: [{ id: "v1", customer_id: "c1", created_by_id: "userA" }],
    });
    await convertEstimate({ svc: s.entities, db: s.entities, user: admin, estimateId: "e1", lease: { attempts: 50, delayMs: 1 } });
    const ro = s.tables.RepairOrder[0];
    assert.equal(ro.tax_applies_to, mode); assert.equal(ro.apply_tax, mode !== "none");
    assert.equal(ro.discount_type, "percentage"); assert.equal(ro.discount_value, 10);
    assert.equal(ro.labor_items[0].taxable, false); assert.equal("secret" in ro.labor_items[0], false);
    assert.equal("taxable" in ro.parts_used[0], false); assert.equal("internal_cost" in ro.parts_used[0], false);
    const t = computeTotals(repairOrderLines(ro), { taxRate: ro.tax_rate, taxTarget: ro.tax_applies_to, discountType: ro.discount_type, discountValue: ro.discount_value });
    const expected = { both: 22.1, labor: 0, parts: 26, none: 0 }[mode];
    assert.equal(t.tax, expected);
  }
});

test("aliases and source discount fallback", () => {
  for (const a of ["$", "fixed", "amount"]) assert.equal(canonicalDiscountType(a), "$");
  for (const a of ["%", "percent", "percentage"]) assert.equal(canonicalDiscountType(a), "%");
  const r = resolveInvoiceInputs({ source: { discount_type: "percentage", discount_value: 15, tax_rate: 0, tax_applies_to: "parts" }, user: { tax_rate: 13 } });
  assert.deepEqual(r, { taxRate: 0, taxTarget: "parts", discount: 15, discountType: "%" });
  assert.equal(estimatePolicyForRepairOrder({ tax_rate: 0, apply_tax: false }).tax_applies_to, "none");
});