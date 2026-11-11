// LBC Auto AI widget styles (screen only). Injected once; motion respects reduced-motion.
const CSS = `
@keyframes lbc-led-glow { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
@keyframes lbc-dot-bounce { 0%,80%,100% { transform: scale(0.6); opacity: .4; } 40% { transform: scale(1); opacity: 1; } }
.lbc-ai-root { position: fixed; right: 20px; bottom: var(--lbc-ai-bottom); z-index: 9998; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; pointer-events: none; }
.lbc-ai-root > * { pointer-events: auto; }
.lbc-ai-orb { position: relative; flex-shrink: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
  background: radial-gradient(circle at 35% 30%, #fdba74 0%, #f97316 48%, #c2410c 100%); border: 2px solid #fed7aa; }
.lbc-ai-launcher { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: 0; padding: 0; cursor: pointer; }
.lbc-ai-launcher .lbc-ai-orb { box-shadow: 0 6px 18px #00000099, 0 0 14px #f9731688; }
.lbc-ai-launcher .lbc-ai-orb::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; box-shadow: 0 0 16px 4px #fb923c; opacity: 0; pointer-events: none; will-change: opacity; animation: lbc-led-glow 2.4s ease-in-out infinite; }
.lbc-ai-launcher:hover .lbc-ai-orb { filter: brightness(1.08); }
.lbc-ai-launcher:focus-visible { outline: none; }
.lbc-ai-launcher:focus-visible .lbc-ai-orb { outline: 3px solid #fff7ed; outline-offset: 3px; }
.lbc-ai-launcher--compact .lbc-ai-orb::after { animation: none; }
.lbc-ai-launcher-label { font-size: 12px; font-weight: 700; line-height: 1.3; color: #fff7ed; background: #1c0d02; border: 1px solid #f97316; border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
.lbc-ai-panel { width: min(440px, calc(100vw - 40px)); height: min(660px, calc(100vh - var(--lbc-ai-bottom) - 104px)); height: min(660px, calc(100dvh - var(--lbc-ai-bottom) - 104px));
  min-height: 280px; display: flex; flex-direction: column; border-radius: 16px; border: 1px solid #f97316aa; overflow: hidden; background: #0c0705;
  box-shadow: 0 18px 48px #000000aa, 0 0 22px #f9731633; }
.lbc-ai-header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 12px 14px; background: linear-gradient(90deg, #160b03, #2a1404); border-bottom: 1px solid #f9731644; flex-shrink: 0; }
.lbc-ai-messages { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 14px; display: flex; flex-direction: column; gap: 14px; scrollbar-width: thin; scrollbar-color: #f9731655 transparent; }
.lbc-ai-bubble { border-radius: 12px; padding: 10px 14px; font-size: 15px; line-height: 1.55; overflow-wrap: anywhere; min-width: 0; }
.lbc-ai-bubble--ai { max-width: calc(100% - 38px); background: #1a0f06; border: 1px solid #f9731630; color: #f5f5f4; }
.lbc-ai-bubble--user { max-width: 85%; background: #2a1607; border: 1px solid #f9731666; color: #ffedd5; white-space: pre-wrap; }
.lbc-ai-md p { margin: 0 0 8px; }
.lbc-ai-md p:last-child { margin-bottom: 0; }
.lbc-ai-md strong { color: #fdba74; font-weight: 700; }
.lbc-ai-md h1, .lbc-ai-md h2, .lbc-ai-md h3, .lbc-ai-md h4 { font-size: 15px; font-weight: 700; color: #fdba74; margin: 10px 0 4px; }
.lbc-ai-md ul { list-style: disc; padding-left: 20px; margin: 2px 0 8px; }
.lbc-ai-md ol { list-style: decimal; padding-left: 20px; margin: 2px 0 8px; }
.lbc-ai-md li { margin-bottom: 3px; }
.lbc-ai-md a { color: #fdba74; text-decoration: underline; }
.lbc-ai-panel button:focus-visible, .lbc-ai-panel a:focus-visible, .lbc-ai-panel summary:focus-visible { outline: 2px solid #fdba74; outline-offset: 2px; }
.lbc-ai-composer { display: flex; align-items: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid #f9731633; background: #110a05; flex-shrink: 0; }
.lbc-ai-input { flex: 1; min-width: 0; resize: none; min-height: 44px; max-height: 132px; background: #1a0f06; border: 1px solid #f9731666; border-radius: 12px; padding: 11px 14px;
  font-size: 16px; line-height: 1.4; color: #fafaf9; outline: none; }
.lbc-ai-input::placeholder { color: #a8a29e; }
.lbc-ai-input:focus { border-color: #f97316; }
.lbc-ai-icon-btn { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0; cursor: pointer;
  background: #1a0f06; border: 1px solid #f9731655; color: #fed7aa; }
.lbc-ai-icon-btn:disabled { opacity: .4; cursor: not-allowed; }
.lbc-ai-icon-btn--send { background: #f97316; border-color: #f97316; color: #1a0d05; }
.lbc-ai-icon-btn--send:hover:not(:disabled) { background: #fb923c; }
.lbc-ai-chip-btn { font-size: 13px; min-height: 36px; padding: 6px 12px; border-radius: 999px; cursor: pointer; background: #1a0f06; border: 1px solid #f9731655; color: #fed7aa; }
.lbc-ai-chip-btn:hover { border-color: #f97316; color: #fdba74; }
.lbc-dot { width: 7px; height: 7px; border-radius: 50%; background: #f97316; display: inline-block; animation: lbc-dot-bounce 1.2s infinite ease-in-out; }
.lbc-ai-pulse { animation: lbc-led-glow 1.1s ease-in-out infinite; }
@media (max-width: 639px) {
  .lbc-ai-root { right: 12px; left: 12px; }
  .lbc-ai-root--open .lbc-ai-launcher { display: none; }
  .lbc-ai-panel { width: 100%; height: calc(100vh - var(--lbc-ai-bottom) - 24px); height: calc(100dvh - var(--lbc-ai-bottom) - env(safe-area-inset-top, 0px) - 16px); }
}
@media (prefers-reduced-motion: reduce) {
  .lbc-ai-launcher .lbc-ai-orb::after, .lbc-dot, .lbc-ai-pulse { animation: none !important; }
}
`;

let injected = false;
export function injectAiChatStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
}