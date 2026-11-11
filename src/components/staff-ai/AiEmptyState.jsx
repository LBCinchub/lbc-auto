import React from "react";
import { BotOrb } from "./BotAvatar";
import { staffSuggestions } from "./staffSuggestions";

export default function AiEmptyState({ vehicle, pathname, onAsk }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 4px" }}>
      <BotOrb size={52} />
      <div style={{ color: "#fff7ed", fontSize: 16, fontWeight: 700, marginTop: 10 }}>How Can I Help?</div>
      <div style={{ color: "#d6d3d1", fontSize: 14, lineHeight: 1.5, marginTop: 4 }}>
        {vehicle ? `Vehicle Loaded: ${vehicle}` : "Ask About Parts Needed, Labor Time, Codes Or Your Shop's Records."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 14 }}>
        {staffSuggestions(pathname).map((p) => (
          <button key={p.label} type="button" className="lbc-ai-chip-btn" onClick={() => onAsk(p.q)}>{p.label}</button>
        ))}
      </div>
    </div>
  );
}