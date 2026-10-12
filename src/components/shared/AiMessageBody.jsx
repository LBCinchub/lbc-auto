import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, FastForward } from "lucide-react";
import { toPlainText, extractEstimateText } from "@/lib/aiTextFormat";
import useTypewriter from "@/hooks/useTypewriter";

const btn = {
  display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, padding: "4px 9px",
  minHeight: 32, borderRadius: 20, cursor: "pointer", background: "#1f1206",
  border: "1px solid #f9731666", color: "#fdba74",
};
const srOnly = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

// Raw HTML is never rendered: react-markdown escapes it by default (no rehype-raw).
// `content` is always the canonical full reply; only the on-screen text animates.
export default function AiMessageBody({ content, animate = false, onDone, onProgress }) {
  const [status, setStatus] = useState("");
  const { shown, typing, skip } = useTypewriter(content, { animate, onDone, onProgress });
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
    <div data-no-capitalize style={{ position: "relative" }}>
      {/* Screen readers get the full reply once, never per letter */}
      {typing && <span style={srOnly}>{content}</span>}
      <div className="lbc-ai-md" style={{ whiteSpace: "normal" }} aria-hidden={typing || undefined}>
        <ReactMarkdown>{shown}</ReactMarkdown>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        {typing && (
          <button type="button" style={btn} onClick={skip}>
            <FastForward size={11} /> Show Full Reply
          </button>
        )}
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