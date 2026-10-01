// Pure/mocked regression tests — no network, no SDK, no entity writes.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { countActiveOrders, collectedRevenue, periodKeys, toDateKey } from "../src/lib/dashboardMetrics.js";
import { validateVin, createVinDecoder } from "../src/lib/vin.js";
import { createSingleFlight } from "../src/lib/singleFlight.js";

const TZ = "America/Toronto"; // synthetic fixture only
const NOW = new Date("2026-09-30T14:00:00Z"); // Wed

test("active counts identical incl. waiting_for_parts", () => {
  const orders = ["waiting", "in_progress", "waiting_for_parts", "completed", "delivered", "weird"].map((status) => ({ status }));
  assert.equal(countActiveOrders(orders), 3);
});

test("partial payments aggregate; total is never added", () => {
  const inv = { total: 1000, amount_paid: 300, payment_history: [{ date: "2026-09-30", amount: 100 }, { date: "2026-09-28", amount: 200 }] };
  const r = collectedRevenue([inv], { now: NOW });
  assert.deepEqual([r.today, r.week, r.month], [100, 300, 300]);
});

test("detailed history wins over legacy amount_paid (no double count)", () => {
  const inv = { amount_paid: 500, paid_date: "2026-09-30", payment_history: [{ date: "2026-09-30", amount: 500 }] };
  assert.equal(collectedRevenue([inv], { now: NOW }).today, 500);
});

test("legacy fallback only when history absent and valid", () => {
  const ok = { amount_paid: 80, paid_date: "2026-09-30" };
  const undated = { amount_paid: 80 };
  const r = collectedRevenue([ok, undated], { now: NOW });
  assert.equal(r.today, 80);
  assert.equal(r.needsReview, 1);
});

test("invalid/undated payments flagged, not dated", () => {
  const inv = { payment_history: [{ amount: 50 }, { date: "2026-09-30", amount: "abc" }, { date: "2026-02-30", amount: 10 }, { date: "2026-09-30", amount: 5 }] };
  const r = collectedRevenue([inv], { now: NOW });
  assert.equal(r.today, 5);
  assert.equal(r.needsReview, 3);
});

test("future payments excluded", () => {
  const r = collectedRevenue([{ payment_history: [{ date: "2026-10-05", amount: 9 }] }], { now: NOW });
  assert.equal(r.month, 0);
});

test("timezone day boundary: 02:30Z is previous day in Toronto", () => {
  assert.equal(toDateKey("2026-10-01T02:30:00Z", TZ), "2026-09-30");
  assert.equal(toDateKey("2026-10-01T02:30:00Z"), "2026-10-01"); // no verified tz -> existing UTC behaviour
  assert.equal(toDateKey("2026-10-01", TZ), "2026-10-01"); // date-only untouched
});

test("month boundary in explicit tz", () => {
  const k = periodKeys(new Date("2026-10-01T03:00:00Z"), TZ);
  assert.equal(k.today, "2026-09-30");
  assert.equal(k.monthStart, "2026-09-01");
  assert.equal(periodKeys(new Date("2026-10-01T03:00:00Z")).monthStart, "2026-10-01");
});

test("DST transitions keep correct calendar week", () => {
  const spring = periodKeys(new Date("2026-03-09T12:00:00Z"), TZ); // Mon after DST start
  assert.equal(spring.weekStart, "2026-03-08");
  const fall = periodKeys(new Date("2026-11-01T04:30:00Z"), TZ); // 00:30 EDT Sun Nov 1
  assert.equal(fall.today, "2026-11-01");
  assert.equal(fall.weekStart, "2026-11-01");
  assert.equal(periodKeys(new Date("2026-03-01T12:00:00Z"), "UTC").weekStart, "2026-03-01");
});

test("repeated save clicks run one creation", async () => {
  const f = createSingleFlight();
  let calls = 0;
  let release;
  const task = () => { calls++; return new Promise((r) => { release = r; }); };
  const first = f.run(task);
  const second = await f.run(task);
  assert.equal(second.status, "busy");
  release({ id: "x" });
  assert.equal((await first).status, "ok");
  assert.equal(calls, 1);
});

test("failed save reports error, no auto retry, guard released", async () => {
  const f = createSingleFlight();
  let calls = 0;
  const draft = { full_name: "Test Person", phone: "555" };
  const res = await f.run(async () => { calls++; throw new Error("net"); });
  assert.equal(res.status, "error");
  assert.equal(calls, 1);
  assert.equal(f.isBusy(), false);
  assert.deepEqual(draft, { full_name: "Test Person", phone: "555" });
});

test("VIN validation: lengths and disallowed chars", () => {
  assert.equal(validateVin("1HGCM82633A00435").ok, false);
  assert.equal(validateVin("1HGCM82633A0043521").ok, false);
  assert.equal(validateVin("1HGCM82633A00435O").ok, false);
  assert.equal(validateVin("1hgcm82633a004352").ok, true);
});

const okJson = { Results: [{ Variable: "Make", Value: "HONDA" }, { Variable: "Model", Value: "Accord" }, { Variable: "Model Year", Value: "2003" }] };
const resp = (json) => ({ ok: true, json: async () => json });

test("VIN timeout aborts request", async () => {
  const fetchImpl = (_u, { signal }) => new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const d = createVinDecoder({ fetchImpl, timeoutMs: 20 });
  assert.equal((await d.decode("1HGCM82633A004352")).status, "timeout");
});

test("VIN network error and invalid VIN never call fetch wrongly", async () => {
  let called = 0;
  const d = createVinDecoder({ fetchImpl: async () => { called++; throw new Error("x"); } });
  assert.equal((await d.decode("SHORT")).status, "invalid");
  assert.equal(called, 0);
  assert.equal((await d.decode("1HGCM82633A004352")).status, "network");
});

test("stale response cannot replace newer VIN", async () => {
  const pending = [];
  const fetchImpl = (u, { signal }) => new Promise((res, rej) => { pending.push({ u, res }); signal.addEventListener("abort", () => rej(new Error("aborted"))); });
  const d = createVinDecoder({ fetchImpl });
  const older = d.decode("1HGCM82633A004352");
  const newer = d.decode("2HGCM82633A004352");
  pending[1].res(resp(okJson));
  assert.equal((await older).status, "stale");
  const n = await newer;
  assert.equal(n.status, "ok");
  assert.equal(n.data.make, "HONDA");
});

test("not-found decode leaves manual entry (no data)", async () => {
  const d = createVinDecoder({ fetchImpl: async () => resp({ Results: [] }) });
  const r = await d.decode("1HGCM82633A004352");
  assert.equal(r.status, "not_found");
  assert.equal(r.data, undefined);
});