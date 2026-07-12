import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, X, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Customer-facing AI chat widget.
 *
 * SECURITY: This component ONLY sends { mode: "customer", messages, vehicle?, description? }
 * to the lbcAutoAI backend. It NEVER sends shop_context, repair order counts,
 * invoice data, or any internal financial data. The backend's customer mode
 * strips all shop-internal context from the AI prompt.
 */
export default function CustomerAIChat({ vehicle = "", description = "" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role: "user", content: q };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      // ── SECURITY: only pass mode, messages, and optional vehicle/description ──
      // No shop_context, no RO counts, no invoice/financial data is ever sent.
      const result = await base44.functions.invoke("lbcAutoAI", {
        mode: "customer",
        messages: history,
        vehicle: vehicle || "",
        description: description || "",
      });

      const reply = result?.data?.reply || result?.reply || "No response generated.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ AI unavailable right now. Try again in a moment." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

      {open && (
        <div style={{
          width: 340, borderRadius: 16, overflow: "hidden",
          border: "2px solid #3b82f6",
          boxShadow: "0 0 18px rgba(59,130,246,0.3), 0 4px 24px rgba(0,0,0,0.6)",
          background: "#020d1a",
        }}>

          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
            background: "linear-gradient(90deg, #001f3f, #003366)",
            borderBottom: "1px solid rgba(59,130,246,0.3)",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#3b82f6",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Bot style={{ width: 14, height: 14, color: "#fff" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>Ask LBC AI</div>
              <div style={{ color: "#60a5fa", fontSize: 10 }}>Car questions? Ask away</div>
            </div>
            <span style={{
              background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.4)",
              color: "#4ade80", fontSize: 9, fontWeight: 700,
              padding: "2px 8px", borderRadius: 20,
            }}>● LIVE</span>
            <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, marginLeft: 4 }}>
              <X style={{ width: 16, height: 16, color: "#64748b" }} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            height: 260, overflowY: "auto", padding: 12,
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <MessageCircle style={{ width: 28, height: 28, color: "#1e3a5f", margin: "0 auto 8px" }} />
                <div style={{ color: "#60a5fa", fontSize: 11, lineHeight: 1.5 }}>
                  {vehicle ? `Ask about your ${vehicle}…` : "Ask about check engine lights, noises, maintenance…"}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    marginRight: 6, marginTop: 2, flexShrink: 0,
                  }}>
                    <Bot style={{ width: 11, height: 11, color: "#60a5fa" }} />
                  </div>
                )}
                <div style={{
                  maxWidth: "82%", borderRadius: 10, padding: "8px 12px",
                  fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "#1e3a5f" : "#0f1e33",
                  border: m.role === "user" ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(59,130,246,0.15)",
                  color: m.role === "user" ? "#bfdbfe" : "#dbeafe",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%",
                  background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Bot style={{ width: 11, height: 11, color: "#60a5fa" }} />
                </div>
                <div style={{
                  background: "#0f1e33", border: "1px solid rgba(59,130,246,0.15)",
                  borderRadius: 10, padding: "8px 14px", display: "flex", gap: 4,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "lbc-dot-bounce 1.2s infinite ease-in-out" }} />
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "lbc-dot-bounce 1.2s infinite ease-in-out 0.18s" }} />
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6", animation: "lbc-dot-bounce 1.2s infinite ease-in-out 0.36s" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
            borderTop: "1px solid rgba(59,130,246,0.15)", background: "#01111f",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={vehicle ? `Ask about your ${vehicle}…` : "Ask about your car…"}
              style={{
                flex: 1, background: "#0f1e33", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#e0f2fe",
                outline: "none", fontFamily: "inherit",
              }}
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              style={{
                width: 32, height: 32, borderRadius: 8, background: "#3b82f6",
                border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, opacity: !input.trim() || loading ? 0.35 : 1,
              }}
            >
              {loading
                ? <Loader2 style={{ width: 14, height: 14, color: "#fff", animation: "spin 1s linear infinite" }} />
                : <Send style={{ width: 14, height: 14, color: "#fff" }} />
              }
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
          borderRadius: 14, cursor: "pointer", userSelect: "none",
          background: "linear-gradient(135deg, #001f3f 0%, #003366 60%, #004080 100%)",
          border: "2px solid #3b82f6",
          boxShadow: "0 0 10px rgba(59,130,246,0.4)",
          transition: "background 0.2s",
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#3b82f6",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          boxShadow: "0 0 8px #3b82f6",
        }}>
          <Bot style={{ width: 18, height: 18, color: "#fff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>Ask LBC AI</div>
          <div style={{ color: "#93c5fd", fontSize: 10 }}>
            {open ? "Click to close" : "Car questions answered"}
          </div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", flexShrink: 0 }} />
      </div>

      {/* Bounce animation (re-injected locally to avoid cross-component deps) */}
      <style>{`
        @keyframes lbc-dot-bounce {
          0%,80%,100% { transform: scale(0.6); opacity:0.4; }
          40%         { transform: scale(1.0); opacity:1; }
        }
      `}</style>
    </div>
  );
}