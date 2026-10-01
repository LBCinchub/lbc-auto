import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toEstimateView } from "@/lib/staffEstimateView";

const btn = { background: "#00aaff22", border: "1px solid #00aaff55", color: "#b0e0ff", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", textDecoration: "none" };

export default function StaffEstimateResult({ capability }) {
  const [copied, setCopied] = useState(false);
  const view = toEstimateView(capability);
  if (!view || (!view.points.length && !view.openPath)) return null;
  const copy = async () => { await navigator.clipboard.writeText(view.copyText); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div style={{ marginTop: 8, padding: 8, borderRadius: 6, border: `1px solid ${view.unavailable ? "#f59e0b55" : "#00aaff33"}`, fontSize: 12 }}>
      <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
        {view.points.map((p, i) => <li key={i} style={{ wordBreak: "break-word" }}>{p}</li>)}
      </ol>
      {view.openPath && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <Link to={view.openPath} style={btn}>Open Estimate</Link>
          {view.copyText && <button type="button" onClick={copy} style={btn}>{copied ? "Copied" : "Copy Estimate"}</button>}
        </div>
      )}
      <span aria-live="polite" style={{ position: "absolute", left: -9999 }}>{copied ? "Estimate copied" : ""}</span>
    </div>
  );
}