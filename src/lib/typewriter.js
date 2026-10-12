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

export const BASE_DELAY_MS = 18;

export function delayFor(g, base = BASE_DELAY_MS) {
  if (/^[.!?؟。]$/.test(g)) return base + 110;
  if (/^[,;:،]$/.test(g)) return base + 50;
  if (g === "\n") return base + 30;
  return base;
}

// Queue-based controller. push() accepts streamed chunks; end() marks the stream complete.
export function createTypewriter({ onUpdate, onDone, base = BASE_DELAY_MS, schedule = setTimeout, cancel = clearTimeout }) {
  let target = "";
  let graphemes = [];
  let shown = 0;
  let timer = null;
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

  const tick = () => {
    timer = null;
    if (stopped || finished) return;
    if (shown < graphemes.length) {
      shown += 1;
      onUpdate(graphemes.slice(0, shown).join(""));
      timer = schedule(tick, delayFor(graphemes[shown - 1], base));
    } else if (ended) {
      finish();
    }
  };

  return {
    push(chunk) {
      if (stopped || finished || !chunk) return;
      target += chunk;
      graphemes = splitGraphemes(target);
      if (!timer) timer = schedule(tick, 0);
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