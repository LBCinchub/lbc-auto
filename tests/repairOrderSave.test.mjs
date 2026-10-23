import { test } from "node:test";
import assert from "node:assert/strict";
import { laborRate, normalizeLaborItems, normalizeParts, inventoryDeltas, isPersisted } from "../src/lib/repairOrderSave.js";

test("zero labor rate is preserved; blank uses default", () => {
  assert.equal(laborRate({ rate: "0" }), 0);
  assert.equal(laborRate({ rate: 0 }), 0);
  assert.equal(laborRate({ rate: "" }), 120);
  assert.equal(laborRate({}), 120);
  assert.equal(laborRate({ rate: "95" }), 95);
});

test("form strings are coerced to schema numbers", () => {
  const [l] = normalizeLaborItems([{ description: "Diag", hours: "1.5", rate: "100" }]);
  assert.deepEqual([l.hours, l.rate, l.total], [1.5, 100, 150]);
  const [p] = normalizeParts([{ name: "Pad", quantity: "2", unit_price: "" }]);
  assert.deepEqual([p.quantity, p.unit_price, p.total], [2, 0, 0]);
});

test("inventory: retries/edits deduct only increases", () => {
  const first = [{ part_id: "p1", quantity: 2 }];
  assert.deepEqual(inventoryDeltas([], first), [{ part_id: "p1", delta: 2 }]);
  assert.deepEqual(inventoryDeltas(first, first), [], "re-save deducts nothing");
  assert.deepEqual(inventoryDeltas(first, [{ part_id: "p1", quantity: 3 }]), [{ part_id: "p1", delta: 1 }]);
  assert.deepEqual(inventoryDeltas(first, [{ part_id: "p1", quantity: 1 }]), []);
});

test("prefilled new record is not treated as edit", () => {
  assert.equal(isPersisted({ customer_id: "c1", _prefillVehicleId: "v1" }), false);
  assert.equal(isPersisted({ id: "r1" }), true);
  assert.equal(isPersisted(null), false);
});