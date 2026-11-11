import React, { useLayoutEffect } from "react";
import { Send, Loader2, Camera, Paperclip } from "lucide-react";

// Multiline composer anchored to the bottom of the panel. Enter sends, Shift+Enter adds a line.
export default function AiComposer({ inputRef, value, onChange, onSend, onCamera, onUpload, loading, canSend, placeholder }) {
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [value, inputRef]);

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(); }
  };

  return (
    <div className="lbc-ai-composer">
      <button type="button" className="lbc-ai-icon-btn" onClick={onCamera} disabled={loading} aria-label="Take Photo" title="Take Photo">
        <Camera style={{ width: 18, height: 18 }} />
      </button>
      <button type="button" className="lbc-ai-icon-btn" onClick={onUpload} disabled={loading} aria-label="Upload Photo" title="Upload Photo">
        <Paperclip style={{ width: 18, height: 18 }} />
      </button>
      <textarea ref={inputRef} rows={1} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
        placeholder={placeholder} aria-label="Message LBC Auto AI" className="lbc-ai-input" disabled={loading} />
      <button type="button" className="lbc-ai-icon-btn lbc-ai-icon-btn--send" aria-label="Send Message" onClick={onSend} disabled={!canSend || loading}>
        {loading ? <Loader2 style={{ width: 18, height: 18, animation: "spin 1s linear infinite" }} /> : <Send style={{ width: 18, height: 18 }} />}
      </button>
    </div>
  );
}