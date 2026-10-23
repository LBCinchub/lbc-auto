// Synthetic two-shop fixtures only. No live records.
import { test } from "node:test";
import assert from "node:assert/strict";
import { customerAllowed, vehicleAllowed, appointmentAllowed, estimateAllowed, project, stampedForTenant } from "../base44/shared/shopProvenance.ts";
import { estimateStatusDisplay } from "../src/lib/estimateStatus.js";
import { mergeById } from "../src/lib/mergeById.js";

const A = "shop-a@example.test", B = "shop-b@example.test", UA = "userA", SVC = "service_abc";
const custA = { id: "cA", created_by_id: SVC, shop_owner_email: A };
const custB = { id: "cB", created_by_id: SVC, shop_owner_email: B };
const vehA = { id: "vA", created_by_id: SVC, shop_owner_email: A, customer_id: "cA" };
const apptA = { id: "aA", created_by_id: SVC, shop_email: A, source: "web_booking", customer_id: "cA", vehicle_id: "vA" };
const estA = { id: "eA", created_by_id: SVC, customer_id: "cA", vehicle_id: "vA", status: "draft" };

test("own shop sees service-created web booking customer/vehicle/appointment/estimate", () => {
  assert.ok(stampedForTenant(custA, A));
  assert.ok(vehicleAllowed(vehA, custA, A, UA));
  assert.ok(appointmentAllowed(apptA, custA, vehA, A, UA));
  assert.ok(estimateAllowed(estA, custA, vehA, A, UA));
});

test("other shop is denied every record", () => {
  assert.ok(!stampedForTenant(custA, B));
  assert.ok(!vehicleAllowed(vehA, custA, B, "userB"));
  assert.ok(!appointmentAllowed(apptA, custA, vehA, B, "userB"));
  assert.ok(!estimateAllowed(estA, custA, vehA, B, "userB"));
});

test("client-forged tenant stamp (non-service creator) is not proof", () => {
  const forged = { id: "x", created_by_id: "attacker", shop_owner_email: A };
  assert.ok(!stampedForTenant(forged, A));
  assert.ok(!customerAllowed(forged, A, UA));
  assert.ok(!appointmentAllowed({ ...apptA, created_by_id: "attacker" }, custA, vehA, A, UA));
  assert.ok(!estimateAllowed({ ...estA, created_by_id: "attacker" }, custA, vehA, A, UA));
});

test("mismatched links and conflicting stamps fail closed", () => {
  assert.ok(!appointmentAllowed({ ...apptA, customer_id: "cB" }, custB, null, A, UA), "appointment pointing at other shop's customer");
  assert.ok(!appointmentAllowed(apptA, custA, { ...vehA, customer_id: "cZ" }, A, UA), "vehicle of a different customer");
  assert.ok(!vehicleAllowed({ ...vehA, customer_id: "cB" }, custB, A, UA));
  assert.ok(!estimateAllowed({ ...estA, shop_owner_email: B }, custA, vehA, A, UA), "conflicting estimate stamp");
  assert.ok(!estimateAllowed(estA, custA, { ...vehA, customer_id: "cB" }, A, UA));
  assert.ok(!customerAllowed({ id: "c", created_by_id: UA, shop_owner_email: B }, A, UA), "own record stamped for another shop");
});

test("projection drops private/system fields", () => {
  const p = project("Estimate", { ...estA, customer_decision_reference: "secret", payment_history: [1], created_by_id: SVC });
  assert.equal(p.customer_decision_reference, undefined);
  assert.equal(p.payment_history, undefined);
  assert.equal(p.created_by_id, undefined);
  assert.equal(p._shop_scoped, true);
});

test("merge keeps own records and dedupes", () => {
  const merged = mergeById([{ id: "1", v: "own" }], [{ id: "1", v: "scoped" }, { id: "2" }]);
  assert.deepEqual(merged.map((r) => r.id), ["1", "2"]);
  assert.equal(merged[0].v, "own");
});

test("estimate status display is accurate; unknown is not Draft", () => {
  for (const [s, l] of [["invoiced", "Invoiced"], ["approved", "Approved"], ["sent", "Sent"], ["declined", "Declined"], ["cancelled", "Cancelled"], ["draft", "Draft"]]) assert.equal(estimateStatusDisplay(s).label, l);
  assert.equal(estimateStatusDisplay(undefined).label, "Unknown");
  assert.equal(estimateStatusDisplay("on_hold").label, "On Hold");
});