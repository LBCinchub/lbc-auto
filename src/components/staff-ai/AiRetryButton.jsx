import React from "react";
import { RotateCcw } from "lucide-react";

// Read-only Retry for a failed LBC Auto AI answer. Never shown for confirmations or changes.
export default function AiRetryButton({ onRetry, disabled }) {
  return (
    <button type="button" onClick={onRetry} disabled={disabled} aria-label="Retry This Question"
      style={{
        marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10,
        padding: "4px 10px", minHeight: 32, borderRadius: 20, cursor: disabled ? "not-allowed" : "pointer",
        background: "#1f1206", border: "1px solid #f97316", color: "#fdba74", opacity: disabled ? 0.5 : 1,
      }}>
      <RotateCcw size={11} /> Retry
    </button>
  );
}