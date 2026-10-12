// Client-side, presentation-only letter-by-letter reveal for AI replies.
// Never changes the canonical text: the final update is always the exact full string.

const segmenter = typeof Intl !== "undefined" && Intl.Segmenter
  ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
  : null;

// Unicode graphemes so emoji (incl. ZWJ / flags) and combining marks are never split.
export function splitGraphemes(text) {
  if (!text) return [];
  return segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : Array.from(text);
}

export const BASE_DELAY_MS = 8;
export const MAX_CATCHUP_GRAPHEMES = 12; // most revealed in one tick after a hidden/throttled tab

// Punctuation extra pause is capped at 20ms.
export function delayFor(g, base = BASE_DELAY_MS) {
  if (/^[.!?؟。]$/.test(g)) return base + 18;
  if (/^[,;:،]$/.test(g)) return base + 10;
  if (g === "\n") return base + 8;
  return base;
}

// Only brand-new replies animate; loaded history and already-revealed replies never retype.
export function shouldAnimate(msg, revealedIds) {
  return !!(msg && msg.animate && msg.id && !revealedIds.has(msg.id));
}

// Queue-based controller. push() accepts streamed chunks; end() marks the stream complete.
export function createTypewriter({
  onUpdate, onDone, base = BASE_DELAY_MS, maxCatchUp = MAX_CATCHUP_GRAPHEMES,
  schedule = setTimeout, cancel = clearTimeout, now = () => Date.now(),
}) {
  let target = "";
  let graphemes = [];
  let shown = 0;
  let timer = null;
  let dueAt = 0;
  let ended = false;
  let finished = false;
  let stopped = false;

  const finish = () => {
    if (finished || stopped) return;
    finished = true;
    shown = graphemes.length;
    onUpdate(target);
    onDone?.(target);
  };

  const arm = (ms) => { dueAt = now() + ms; timer = schedule(tick, ms); };

  function tick() {
    timer = null;
    if (stopped || finished) return;
    if (shown < graphemes.length) {
      // If the timer fired late (background tab), catch up a little — never a whole paragraph.
      const late = Math.max(0, now() - dueAt);
      const steps = Math.min(maxCatchUp, 1 + Math.floor(late / base));
      shown = Math.min(graphemes.length, shown + steps);
      onUpdate(graphemes.slice(0, shown).join(""));
      arm(delayFor(graphemes[shown - 1], base));
    } else if (ended) {
      finish();
    }
  }

  return {
    push(chunk) {
      if (stopped || finished || !chunk) return;
      target += chunk;
      graphemes = splitGraphemes(target);
      if (!timer) arm(0);
    },
    end() {
      if (stopped || finished) return;
      ended = true;
      if (!timer) finish();
    },
    skip() {
      if (stopped || finished) return;
      if (timer) { cancel(timer); timer = null; }
      ended = true;
      finish();
    },
    stop() {
      stopped = true;
      if (timer) { cancel(timer); timer = null; }
    },
    get isActive() { return !finished && !stopped; },
  };
}