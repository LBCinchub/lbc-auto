import React from "react";
import { Link } from "react-router-dom";
import StaffConfirmCard from "./StaffConfirmCard";
import StaffReceiptCard from "./StaffReceiptCard";

const STATUS = {
  ok: ["Checked", "#86efac"], no_results: ["No Matches", "#d6d3d1"], ambiguous: ["Several Matches", "#fde68a"],
  not_found: ["Not Found", "#fca5a5"], failed: ["Could Not Check", "#fca5a5"], unavailable: ["Unavailable", "#fca5a5"], invalid: ["Unclear Request", "#fde68a"],
  needs_input: ["Needs Details", "#fde68a"], blocked: ["Blocked", "#fca5a5"], awaiting_confirmation: ["Awaiting Confirm", "#fdba74"],
  saved: ["Saved", "#86efac"], cancelled: ["Cancelled", "#d6d3d1"], unsupported: ["Not Available", "#d6d3d1"],
  not_connected: ["Not Connected", "#d6d3d1"], forbidden_role: ["Not For Your Role", "#d6d3d1"],
};
const PROBLEM = new Set(["failed", "unavailable", "not_found", "blocked", "invalid"]);
const chip = { fontSize: 12, lineHeight: 1.4, padding: "3px 9px", borderRadius: 999, border: "1px solid #f9731633", background: "#120a04" };
const action = { ...chip, fontSize: 13, minHeight: 36, padding: "6px 12px", display: "inline-flex", alignItems: "center" };

// The answer is always visible; "What I Checked" is compact provenance, opened automatically
// when something could not be checked.
export default function StaffToolResults({ staff, decisionState, onDecision, onAsk }) {
  const results = staff.tool_results || [];
  return (
    <div>
      {results.length > 0 && (
        <details open={results.some((r) => PROBLEM.has(r.status)) || undefined} style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "#d6d3d1", minHeight: 28 }}>What I Checked ({results.length})</summary>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {results.map((r, i) => {
              const [text, color] = STATUS[r.status] || [r.status, "#d6d3d1"];
              return <span key={i} style={{ ...chip, color }}>{r.label}: {text}{r.has_more || r.partial ? " (More)" : ""}</span>;
            })}
          </div>
        </details>
      )}
      {staff.links?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {staff.links.map((l, i) => <Link key={i} to={l.path} style={{ ...action, color: "#fdba74", textDecoration: "none" }}>Open {l.label}</Link>)}
        </div>
      )}
      {staff.options?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {staff.options.map((o) => <button key={o} type="button" onClick={() => onAsk(o)} style={{ ...action, color: "#fed7aa", cursor: "pointer" }}>{o}</button>)}
        </div>
      )}
      {staff.confirmation && <StaffConfirmCard confirmation={staff.confirmation} state={decisionState} onDecision={onDecision} />}
      {staff.receipt && <StaffReceiptCard receipt={staff.receipt} copyText={staff.copy_text} />}
    </div>
  );
}