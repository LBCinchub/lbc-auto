import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, FastForward } from "lucide-react";
import { toPlainText, extractEstimateText, toDisplayMarkdown } from "@/lib/aiTextFormat";
import useTypewriter from "@/hooks/useTypewriter";

const btn = {
  display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "6px 12px",
  minHeight: 36, borderRadius: 999, cursor: "pointer", background: "#1f1206",
  border: "1px solid #f9731666", color: "#fdba74",
};
const srOnly = { position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" };

// Raw HTML is never rendered: react-markdown escapes it by default (no rehype-raw).
// `content` is always the canonical full reply; only the on-screen text animates, and both copy
// buttons always copy the complete reply, even mid-animation.
export default function AiMessageBody({ content, animate = false, onDone, onProgress, showCopy = true }) {
  const [status, setStatus] = useState("");
  const { shown, typing, skip } = useTypewriter(content, { animate, onDone, onProgress });
  const estimateText = extractEstimateText(content);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} Copied`);
    } catch {
      setStatus("Copy Failed. Select The Text Manually.");
    }
    setTimeout(() => setStatus(""), 2500);
  };

  return (
    <div data-no-capitalize style={{ position: "relative" }}>
      {/* Screen readers get the full reply once, never per letter */}
      {typing && <span style={srOnly}>{content}</span>}
      <div className="lbc-ai-md" aria-hidden={typing || undefined}>
        <ReactMarkdown>{toDisplayMarkdown(shown)}</ReactMarkdown>
      </div>
      {(typing || showCopy || estimateText) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {typing && (
            <button type="button" style={btn} onClick={skip}>
              <FastForward size={13} /> Show Full Reply
            </button>
          )}
          {showCopy && (
            <button type="button" style={btn} onClick={() => copy(toPlainText(content), "Response")}>
              {status.startsWith("Response") ? <Check size={13} /> : <Copy size={13} />} Copy Response
            </button>
          )}
          {estimateText && (
            <button type="button" style={btn} onClick={() => copy(estimateText, "Estimate Text")}>
              {status.startsWith("Estimate") ? <Check size={13} /> : <Copy size={13} />} Copy Estimate Text
            </button>
          )}
        </div>
      )}
      <span role="status" aria-live="polite" style={{ fontSize: 12, color: "#86efac" }}>{status}</span>
    </div>
  );
}