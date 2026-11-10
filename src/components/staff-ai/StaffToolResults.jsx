import React from "react";
import { Link } from "react-router-dom";
import StaffConfirmCard from "./StaffConfirmCard";
import StaffReceiptCard from "./StaffReceiptCard";

const STATUS = {
  ok: ["Checked", "#86efac"], no_results: ["No Matches", "#a8a29e"], ambiguous: ["Several Matches", "#fde68a"],
  not_found: ["Not Found", "#fca5a5"], failed: ["Could Not Check", "#fca5a5"], unavailable: ["Unavailable", "#fca5a5"], invalid: ["Unclear Request", "#fde68a"],
  needs_input: ["Needs Details", "#fde68a"], blocked: ["Blocked", "#fca5a5"], awaiting_confirmation: ["Awaiting Confirm", "#fdba74"],
  saved: ["Saved", "#86efac"], cancelled: ["Cancelled", "#a8a29e"], unsupported: ["Not Available", "#a8a29e"],
};
const chip = { fontSize: 9.5, padding: "2px 7px", borderRadius: 20, border: "1px solid #f9731633", background: "#120a04" };

export default function StaffToolResults({ staff, decisionState, onDecision, onAsk }) {
  return (
    <div>
      {staff.tool_results?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }} aria-label="What LBC Auto AI Checked">
          {staff.tool_results.map((r, i) => {
            const [text, color] = STATUS[r.status] || [r.status, "#a8a29e"];
            return <span key={i} style={{ ...chip, color }}>{r.label}: {text}{r.has_more || r.partial ? " (More)" : ""}</span>;
          })}
        </div>
      )}
      {staff.links?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {staff.links.map((l, i) => <Link key={i} to={l.path} style={{ ...chip, color: "#fdba74" }}>Open {l.label}</Link>)}
        </div>
      )}
      {staff.options?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
          {staff.options.map((o) => <button key={o} type="button" onClick={() => onAsk(o)} style={{ ...chip, color: "#fed7aa", cursor: "pointer" }}>{o}</button>)}
        </div>
      )}
      {staff.confirmation && <StaffConfirmCard confirmation={staff.confirmation} state={decisionState} onDecision={onDecision} />}
      {staff.receipt && <StaffReceiptCard receipt={staff.receipt} copyText={staff.copy_text} />}
    </div>
  );
}