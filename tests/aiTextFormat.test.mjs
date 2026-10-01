// Pure tests — no network, SDK or data writes. Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { toPlainText, extractEstimateText } from "../src/lib/aiTextFormat.js";

const reply = `## Vehicle And Work
2010 Honda Civic — brakes all around.

## Suggested Parts/Labor
1. **Front pads** (confirm pads only or pads + rotors)
2. Rear brakes — confirm drum or disc

## Price Evidence
1. INV-1042 2026-05-02 front pads $89 (exact match)

## Missing Details
1. Customer and vehicle on file
2. Rear brake configuration`;

test("plain text strips markdown and keeps numbering", () => {
  const t = toPlainText(reply);
  assert.ok(!/[#*]/.test(t));
  assert.match(t, /1\. Front pads/);
});

test("HTML and tables flattened", () => {
  assert.equal(toPlainText("<script>x</script>Hi <b>there</b>"), "xHi there");
  assert.equal(toPlainText("| A | B |\n|---|---|\n| 1 | 2 |"), "A — B\n\n1 — 2");
});

test("estimate copy excludes staff-only price evidence", () => {
  const e = extractEstimateText(reply);
  assert.match(e, /Vehicle And Work/);
  assert.match(e, /Missing Details/);
  assert.ok(!/INV-1042|Price Evidence|\$89/.test(e));
});

test("no estimate sections → no estimate copy", () => {
  assert.equal(extractEstimateText("Torque spec is 80 ft-lb."), "");
});

test("case-sensitive values preserved", () => {
  const t = toPlainText("VIN `1HGFA16526L000000` email Ab.Cd@x.com");
  assert.match(t, /1HGFA16526L000000/);
  assert.match(t, /Ab\.Cd@x\.com/);
});