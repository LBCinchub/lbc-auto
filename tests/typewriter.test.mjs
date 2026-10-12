// Synthetic fixtures + fake timers only. No network, no records, no AI calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTypewriter, splitGraphemes, delayFor, BASE_DELAY_MS } from "../src/lib/typewriter.js";

function fakeClock() {
  let now = 0, id = 0;
  const q = new Map();
  return {
    schedule: (fn, ms) => { const k = ++id; q.set(k, { fn, at: now + ms }); return k; },
    cancel: (k) => q.delete(k),
    pending: () => q.size,
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const [k, t] of q) if (t.at <= end && (!next || t.at < next[1].at)) next = [k, t];
        if (!next) break;
        q.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    runAll() { this.advance(1e9); },
  };
}

function make(clock, extra = {}) {
  const frames = []; const done = [];
  const tw = createTypewriter({ onUpdate: (s) => frames.push(s), onDone: (s) => done.push(s), schedule: clock.schedule, cancel: clock.cancel, ...extra });
  return { tw, frames, done };
}

test("reveals one grapheme at a time and ends with exact text", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("Hi there"); tw.end();
  c.advance(0); assert.equal(frames.at(-1), "H");
  c.advance(BASE_DELAY_MS); assert.equal(frames.at(-1), "Hi");
  c.runAll();
  assert.equal(frames.at(-1), "Hi there");
  assert.deepEqual(done, ["Hi there"]);
  for (let i = 1; i < frames.length - 1; i++) assert.ok(frames[i].length - frames[i - 1].length <= 1);
  assert.equal(c.pending(), 0);
});

test("punctuation pauses are longer than letters", () => {
  assert.ok(delayFor(".") > delayFor("a"));
  assert.ok(delayFor(",") > delayFor("a"));
  assert.ok(delayFor("a") >= 15 && delayFor("a") <= 25);
});

test("queued stream chunks are revealed in order and final text is exact", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("Brake "); c.advance(40);
  tw.push("job: 2.5 hrs"); c.advance(30);
  assert.equal(done.length, 0, "not done before end()");
  tw.end(); c.runAll();
  assert.equal(frames.at(-1), "Brake job: 2.5 hrs");
  assert.deepEqual(done, ["Brake job: 2.5 hrs"]);
});

test("emoji, ZWJ sequences and Arabic are never split", () => {
  const text = "👨‍🔧 تم 🇨🇦 é";
  const g = splitGraphemes(text);
  assert.ok(g.includes("👨‍🔧") && g.includes("🇨🇦"));
  const c = fakeClock(); const { tw, frames } = make(c);
  tw.push(text); tw.end(); c.runAll();
  for (const f of frames) assert.ok(!/[\uD800-\uDBFF]$/.test(f), "no dangling surrogate");
  assert.equal(frames.at(-1), text);
});

test("skip shows full reply immediately and clears timers", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("1. Pads — $120\n2. Rotors — $240"); tw.end(); c.advance(50);
  tw.skip();
  assert.equal(frames.at(-1), "1. Pads — $120\n2. Rotors — $240");
  assert.equal(done.length, 1);
  assert.equal(c.pending(), 0);
  tw.skip(); assert.equal(done.length, 1, "idempotent");
});

test("stop (thread/shop switch or unmount) clears timers with no further output", () => {
  const c = fakeClock(); const { tw, frames, done } = make(c);
  tw.push("Shop A private reply"); tw.end(); c.advance(30);
  const n = frames.length;
  tw.stop();
  assert.equal(c.pending(), 0);
  tw.push("Shop B text"); c.runAll();
  assert.equal(frames.length, n, "no bleed after stop");
  assert.equal(done.length, 0);
});

test("two typewriters (two threads) never share text", () => {
  const c = fakeClock(); const a = make(c); const b = make(c);
  a.tw.push("AAAA"); b.tw.push("BBBB"); a.tw.end(); b.tw.end(); c.runAll();
  assert.ok(a.frames.every(f => /^A*$/.test(f)));
  assert.ok(b.frames.every(f => /^B*$/.test(f)));
});

test("markdown/link/code source is preserved byte-exact at the end", () => {
  const md = "**Estimate**\n1. Labor `2.0h`\n[Open](/EstimateDetail/x)\n<script>x</script>";
  const c = fakeClock(); const { tw, frames } = make(c);
  tw.push(md); tw.end(); c.runAll();
  assert.equal(frames.at(-1), md);
});

test("empty reply finishes immediately", () => {
  const c = fakeClock(); const { tw, done } = make(c);
  tw.end(); assert.deepEqual(done, [""]);
});