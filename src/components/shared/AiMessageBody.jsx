import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check } from "lucide-react";
import { toPlainText, extractEstimateText } from "@/lib/aiTextFormat";

const btn = {
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "4px 9px",
  minHeight: 28, borderRadius: 20, cursor: "pointer", background: "#001f3a",
  border: "1px solid #00aaff44", color: "#80d8ff",
};

// Raw HTML is never rendered: react-markdown escapes it by default (no rehype-raw).
export default function AiMessageBody({ content }) {
  const [status, setStatus] = useState("");
  const estimateText = extractEstimateText(content);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied`);
    } catch {
      setStatus("Copy failed — select the text manually");
    }
    setTimeout(() => setStatus(""), 2500);
  };

  return (
    <div data-no-capitalize>
      <div className="lbc-ai-md" style={{ whiteSpace: "normal" }}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <button type="button" style={btn} onClick={() => copy(toPlainText(content), "Response")}>
          {status.startsWith("Response") ? <Check size={11} /> : <Copy size={11} />} Copy Response
        </button>
        {estimateText && (
          <button type="button" style={btn} onClick={() => copy(estimateText, "Estimate text")}>
            {status.startsWith("Estimate") ? <Check size={11} /> : <Copy size={11} />} Copy Estimate Text
          </button>
        )}
      </div>
      <span role="status" aria-live="polite" style={{ fontSize: 10, color: "#00ff88" }}>{status}</span>
    </div>
  );
}