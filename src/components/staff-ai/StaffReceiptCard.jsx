import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, ExternalLink } from "lucide-react";
import CopyTextButton from "./CopyTextButton";

// Shown only after the server saved, re-read and verified the record.
export default function StaffReceiptCard({ receipt, copyText }) {
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "#06200f", border: "1px solid #00ff8855" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#86efac", fontSize: 11, fontWeight: 700 }}>
        <CheckCircle2 style={{ width: 13, height: 13 }} /> Saved: {receipt.label}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {receipt.open_path && (
          <Link to={receipt.open_path} style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "3px 8px", borderRadius: 20, border: "1px solid #00ff8855", color: "#86efac" }}>
            <ExternalLink style={{ width: 10, height: 10 }} /> Open
          </Link>
        )}
        {copyText && <CopyTextButton text={copyText} label="Copy Estimate Text" />}
      </div>
    </div>
  );
}