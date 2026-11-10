import { useLayoutEffect, useState } from "react";

const CLIPS = /(auto|scroll|hidden|clip)/;

/**
 * Places a fixed-position popup (popRef) under — or, when there is no room, over — its anchor input.
 * The popup is portaled into the anchor's open dialog (so focus traps, scroll locks and screen-reader
 * isolation keep treating it as part of that dialog) or into <body> outside dialogs. It stays inside
 * the dialog/visible viewport, follows scrolling, resizing, zoom and the phone keyboard, and hides
 * while its input is scrolled out of sight. Only the popup's own list scrolls.
 */
export function useAnchoredPosition(open, anchorRef, popRef, deps = [], { maxHeight = 208, minWidth = 200, gap = 4 } = {}) {
  const [container, setContainer] = useState(null);

  useLayoutEffect(() => {
    if (open) setContainer(anchorRef.current?.closest('[role="dialog"]') || document.body);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !container) return;
    const place = () => {
      const a = anchorRef.current;
      const p = popRef.current;
      if (!a || !p) return;
      const r = a.getBoundingClientRect();
      const vv = window.visualViewport;
      const vt = vv?.offsetTop || 0;
      const vl = vv?.offsetLeft || 0;
      let b = { top: vt, left: vl, bottom: vt + (vv?.height ?? window.innerHeight), right: vl + (vv?.width ?? window.innerWidth) };
      if (container !== document.body) {
        const c = container.getBoundingClientRect();
        b = { top: Math.max(b.top, c.top), left: Math.max(b.left, c.left), bottom: Math.min(b.bottom, c.bottom), right: Math.min(b.right, c.right) };
      }
      let visible = true;
      for (let el = a.parentElement; el && el !== container && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (!CLIPS.test(s.overflowX + s.overflowY)) continue;
        const c = el.getBoundingClientRect();
        if (r.bottom <= c.top || r.top >= c.bottom || r.right <= c.left || r.left >= c.right) { visible = false; break; }
      }
      p.style.visibility = visible ? "" : "hidden";

      const below = b.bottom - r.bottom - gap - 8;
      const above = r.top - b.top - gap - 8;
      const natural = Math.min(maxHeight, p.scrollHeight);
      const up = below < natural && above > below;
      const h = Math.max(48, Math.min(maxHeight, up ? above : below));
      const width = Math.max(0, Math.min(Math.max(r.width, minWidth), b.right - b.left - 16));
      const left = Math.max(b.left + 8, Math.min(r.left, b.right - 8 - width));
      // A transformed dialog becomes the origin for fixed children: measure that origin first.
      p.style.top = "0px";
      p.style.left = "0px";
      const o = p.getBoundingClientRect();
      p.style.maxHeight = `${h}px`;
      p.style.width = `${width}px`;
      p.style.left = `${left - o.left}px`;
      p.style.top = `${(up ? r.top - gap - Math.min(natural, h) : r.bottom + gap) - o.top}px`;
    };
    let raf = 0;
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
    place();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, container, ...deps]);

  return container;
}