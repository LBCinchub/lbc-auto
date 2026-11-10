import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function CopyTextButton({ text, label = "Copy Response" }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={copy} aria-label={label}
      style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "3px 8px", borderRadius: 20, cursor: "pointer", background: "transparent", border: "1px solid #f9731644", color: "#fdba74" }}>
      {copied ? <Check style={{ width: 10, height: 10 }} /> : <Copy style={{ width: 10, height: 10 }} />}
      {copied ? "Copied" : label}
    </button>
  );
}