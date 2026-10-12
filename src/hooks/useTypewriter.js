import { useEffect, useRef, useState } from "react";
import { createTypewriter } from "@/lib/typewriter";

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Reveals `text` once when `animate` is true. Unmount/cancel stops timers and still
// reports done, so a reopened chat never retypes the same reply.
export default function useTypewriter(text, { animate, onDone, onProgress }) {
  const run = !!animate && !prefersReducedMotion();
  const [shown, setShown] = useState(run ? "" : text);
  const [typing, setTyping] = useState(run);
  const ctl = useRef(null);
  const doneRef = useRef(onDone);
  const progressRef = useRef(onProgress);
  doneRef.current = onDone;
  progressRef.current = onProgress;

  useEffect(() => {
    if (!run) {
      setShown(text);
      setTyping(false);
      if (animate) doneRef.current?.();
      return undefined;
    }
    setShown("");
    setTyping(true);
    const tw = createTypewriter({
      onUpdate: (s) => { setShown(s); progressRef.current?.(); },
      onDone: () => { setTyping(false); doneRef.current?.(); },
    });
    ctl.current = tw;
    tw.push(text);
    tw.end();
    return () => { tw.stop(); ctl.current = null; doneRef.current?.(); };
  }, [text, run, animate]);

  return { shown: typing ? shown : text, typing, skip: () => ctl.current?.skip() };
}