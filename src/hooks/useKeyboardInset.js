import { useEffect, useState } from "react";

// Height of the on-screen keyboard (mobile), so a fixed chat panel can sit above it.
export default function useKeyboardInset(active) {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!active || !vv) { setInset(0); return undefined; }
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [active]);
  return inset > 80 ? inset : 0; // ignore toolbar wobble; only a real keyboard moves the panel
}