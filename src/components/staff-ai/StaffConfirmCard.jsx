import React from "react";
import { Check, X, Loader2 } from "lucide-react";

const btn = { fontSize: 11, padding: "6px 12px", minHeight: 32, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 };

// Preview of a pending write. Nothing is saved until Confirm; the server re-checks everything.
export default function StaffConfirmCard({ confirmation, state, onDecision }) {
  const busy = state === "busy";
  const done = state === "done";
  return (
    <div role="group" aria-label={`Confirm: ${confirmation.title}`} style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#120a04", border: "1px solid #f97316" }}>
      <div style={{ color: "#fdba74", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{confirmation.title}</div>
      <dl style={{ margin: 0, display: "grid", gap: 3 }}>
        {confirmation.fields.map((f, i) => (
          <div key={i} style={{ fontSize: 10.5, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <dt style={{ color: "#a8a29e" }}>{f.label}:</dt>
            <dd style={{ margin: 0, color: "#f5f5f4" }}>
              {f.before !== undefined && <span style={{ textDecoration: "line-through", color: "#78716c", marginRight: 4 }}>{f.before}</span>}
              {f.after}
            </dd>
          </div>
        ))}
      </dl>
      {confirmation.impact?.map((t, i) => <div key={i} style={{ marginTop: 6, fontSize: 10, color: "#fde68a" }}>{t}</div>)}
      {!done && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button type="button" disabled={busy} onClick={() => onDecision("confirm")} style={{ ...btn, background: "#f97316", border: "none", color: "#1a0d05", opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} /> : <Check style={{ width: 12, height: 12 }} />} Confirm
          </button>
          <button type="button" disabled={busy} onClick={() => onDecision("cancel")} style={{ ...btn, background: "transparent", border: "1px solid #f9731655", color: "#fed7aa" }}>
            <X style={{ width: 12, height: 12 }} /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}