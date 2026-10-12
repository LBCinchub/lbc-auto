// Synthetic fixtures + fake timers only. No network, no records, no AI calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTypewriter, splitGraphemes, delayFor, shouldAnimate, BASE_DELAY_MS, MAX_CATCHUP_GRAPHEMES } from "../src/lib/typewriter.js";
import { toPlainText, extractEstimateText } from "../src/lib/aiTextFormat.js";

function fakeClock() {
  let now = 0, id = 0;
  const q = new Map();
  const fire = (end, late = 0) => {
    for (;;) {
      let next = null;
      for (const [k, t] of q) if (t.at <= end && (!next || t.at < next[1].at)) next = [k, t];
      if (!next) break;
      q.delete(next[0]); now = Math.max(now, next[1].at + late); next[1].fn();
    }
    now = Math.max(now, end);
  };
  return {
    now: () => now,
    schedule: (fn, ms) => { const k = ++id; q.set(k, { fn, at: now + ms }); return k; },
    cancel: (k) => q.delete(k),
    pending: () => q.size,
    advance(ms) { fire(now + ms); },
    // Background tab: the next timer fires `ms` late.
    stall(ms) { const t = [...q.values()][0]; if (t) { const end = t.at; q.forEach(v => { v.at = end; }); now = end + ms; const fn = t.fn; q.clear(); fn(); } },
    runAll() { fire(1e12); },
  };
}

function make(clock, extra = {}) {
  const frames = []; const done = [];
  const tw = createTypewriter({ onUpdate: (s) => frames.push(s), onDone: (s) => done.push(s),
    schedule: clock.schedule, cancel: clock.cancel, now: clock.now, ...extra });
  return { tw, frames, done };
}

const SAMPLE = "Brake job, front axle. About 1.5 hours! Pads and rotors, then test drive.";
const oldDelay = (g) => (/^[.!?]$/.test(g) ? 18 + 110 : /^[,;:]$/.test(g) ? 18 + 50 : g === "\n" ? 18 + 30 : 18);
const totalTime = (text, fn) => splitGraphemes(text).reduce((s, g) => s + fn(g), 0);

test("new default is ~8ms per grapheme with ≤20ms punctuation pause", () => {
  assert.equal(BASE_DELAY_MS, 8);
  for (const g of [".", "!", "?", ",", ";", ":", "\n", "؟", "،"]) assert.ok(delayFor(g) - BASE_DELAY_MS <= 20, g);
  assert.ok(delayFor(".") > delayFor("a"));
});

test("completes well over 2× faster than the previous 18ms/long-pause timing", () => {
  const c = fakeClock(); let newMs = -1;
  const { tw, done } = make(c, { onDone: (s) => { newMs = c.now(); done.push(s); } });
  tw.push(SAMPLE); tw.end(); c.runAll(); const prevMs = totalTime(SAMPLE, oldDelay);
  assert.deepEqual(done, [SAMPLE]);
  assert.ok(newMs * 2 < prevMs, `new ${newMs}ms vs previous ${prevMs}ms`);
});

test("incremental reveal: one grapheme per normal tick, never a whole-block dump", () => {
  const c = fakeClock(); const { tw, frames } = make(c);
  tw.push(SAMPLE); tw.end(); c.runAll();
  assert.ok(frames.length >= splitGraphemes(SAMPLE).length);
  for (let i = 1; i < frames.length - 1; i++) assert.ok(frames[i].length - frames[i - 1].length <= 1);
  assert.equal(frames.at(-1), SAMPLE);
});

test("hidden-tab catch-up is bounded and still finishes exactly", () => {
  const c = fakeClock(); const { tw, frames } = make(c);
  const long = "x".repeat(300);
  tw.push(long); tw.end(); c.advance(20);
  const before = frames.at(-1).length;
  c.stall(5000);
  const jump = frames.at(-1).length - before;
  assert.ok(jump > 1 && jump <= MAX_CATCHUP_GRAPHEMES, `jump ${jump}`);
  c.runAll(); assert.equal(frames.at(-1), long);
});

test("queued stream chunks are revealed in order and final text is exact", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("Brake "); c.advance(20);
  tw.push("job: 2.5 hrs"); c.advance(15);
  assert.equal(done.length, 0, "not done before end()");
  tw.end(); c.runAll();
  assert.equal(frames.at(-1), "Brake job: 2.5 hrs");
  assert.deepEqual(done, ["Brake job: 2.5 hrs"]);
});

test("emoji, ZWJ sequences and Arabic are never split", () => {
  const text = "👨‍🔧 تم 🇨🇦 é 🔧";
  const g = splitGraphemes(text);
  assert.ok(g.includes("👨‍🔧") && g.includes("🇨🇦"));
  const c = fakeClock(); const { tw, frames } = make(c);
  tw.push(text); tw.end(); c.runAll();
  for (const f of frames) assert.ok(!/[\uD800-\uDBFF]$/.test(f) && !f.endsWith("\u200D"), "no split grapheme");
  assert.equal(frames.at(-1), text);
});

test("skip shows full reply immediately and clears timers", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("1. Pads — $120\n2. Rotors — $240"); tw.end(); c.advance(20);
  tw.skip();
  assert.equal(frames.at(-1), "1. Pads — $120\n2. Rotors — $240");
  assert.equal(done.length, 1); assert.equal(c.pending(), 0);
  tw.skip(); assert.equal(done.length, 1, "idempotent");
});

test("stop (thread/shop switch or unmount) clears timers with no further output", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("Shop A private reply"); tw.end(); c.advance(15);
  const n = frames.length;
  tw.stop(); assert.equal(c.pending(), 0);
  tw.push("Shop B text"); c.runAll();
  assert.equal(frames.length, n, "no bleed after stop");
  assert.equal(done.length, 0);
});

test("two typewriters (two threads/shops) never share text", () => {
  const c = fakeClock(); const a = make(c); const b = make(c);
  a.tw.push("AAAA"); b.tw.push("BBBB"); a.tw.end(); b.tw.end(); c.runAll();
  assert.ok(a.frames.every(f => /^A*$/.test(f)));
  assert.ok(b.frames.every(f => /^B*$/.test(f)));
});

test("history and already-revealed replies never retype", () => {
  const revealed = new Set(["a1"]);
  assert.equal(shouldAnimate({ id: "a1", animate: true }, revealed), false, "revealed");
  assert.equal(shouldAnimate({ id: "h9", role: "assistant" }, revealed), false, "loaded history");
  assert.equal(shouldAnimate({ animate: true }, revealed), false, "no id");
  assert.equal(shouldAnimate({ id: "a2", animate: true }, revealed), true, "new reply");
});

test("numbered estimate, amounts, dates, code, links and citations are byte-exact", () => {
  const md = "**Suggested Labor**\n1. Front pads — 1.5h × $120 = $180.00\n2. Tax 13% — $23.40\nDue 2026-10-12 `P0420` [1] [Source](/EstimateDetail/x)\n<script>x</script>";
  const c = fakeClock(); const { tw, frames } = make(c);
  tw.push(md); tw.end(); c.runAll();
  assert.equal(frames.at(-1), md);
  const plain = toPlainText(md);
  for (const s of ["1. Front pads", "$180.00", "13%", "2026-10-12", "P0420", "[1]"]) assert.ok(plain.includes(s), s);
  assert.ok(extractEstimateText(md).includes("1. Front pads — 1.5h × $120 = $180.00"));
});

test("empty reply finishes immediately", () => {
  const c = fakeClock(); const { tw, done } = make(c);
  tw.end(); assert.deepEqual(done, [""]);
});