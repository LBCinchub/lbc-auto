import React from "react";
import { BotOrb } from "./BotAvatar";

// Circular LBC Auto AI launcher with its name underneath. While a dialog is open it shows the circle
// only, so it never covers that dialog's buttons. A mouse click never takes the cursor out of the field
// being filled in (that made dialogs reselect the field's text, so the next keys replaced it).
export default function AiLauncher({ open, compact, onToggle }) {
  return (
    <button type="button" className={`lbc-ai-launcher${compact ? " lbc-ai-launcher--compact" : ""}`}
      aria-expanded={open} aria-label={open ? "Minimize LBC Auto AI" : "Open LBC Auto AI"}
      title={compact ? "LBC Auto AI" : undefined}
      onMouseDown={(e) => e.preventDefault()} onClick={onToggle}>
      <BotOrb size={compact ? 56 : 60} />
      {!compact && <span className="lbc-ai-launcher-label">LBC Auto AI</span>}
    </button>
  );
}