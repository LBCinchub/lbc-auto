import { useEffect } from "react";
import { createPortal } from "react-dom";

// Dedicated top-level layer for the single LBC Auto AI chat instance.
// Sits above financial editors (z 10020) and Radix dialogs (z 50), and keeps
// chat interactions from leaking to underlying modal handlers.
const LAYER_Z = 10030;
let layerEl = null;
function getLayer() {
  if (!layerEl) {
    layerEl = document.createElement("div");
    layerEl.setAttribute("data-lbc-ai-layer", "");
    layerEl.style.position = "relative";
    layerEl.style.zIndex = String(LAYER_Z);
    layerEl.style.pointerEvents = "auto";
    document.body.appendChild(layerEl);
  }
  return layerEl;
}

// Events stopped at the layer so document-level listeners of open dialogs
// (outside-click dismiss, scroll lock, Escape, focus-in trap) never see them.
// React's own listener on this container runs first, so chat handlers still work.
const ISOLATED = ["pointerdown", "mousedown", "touchstart", "wheel", "touchmove", "keydown", "focusin"];
const stop = (e) => e.stopPropagation();

export default function AiOverlayLayer({ children }) {
  const el = getLayer();

  useEffect(() => {
    ISOLATED.forEach((t) => el.addEventListener(t, stop));
    // Modal dialogs mark outside nodes aria-hidden/inert; the chat must stay reachable.
    const clean = () => {
      if (el.getAttribute("aria-hidden") !== null) el.removeAttribute("aria-hidden");
      if (el.hasAttribute("inert")) el.removeAttribute("inert");
      if (el.style.pointerEvents !== "auto") el.style.pointerEvents = "auto";
    };
    clean();
    const mo = new MutationObserver(clean);
    mo.observe(el, { attributes: true, attributeFilter: ["aria-hidden", "inert", "style"] });
    return () => { mo.disconnect(); ISOLATED.forEach((t) => el.removeEventListener(t, stop)); };
  }, [el]);

  return createPortal(children, el);
}