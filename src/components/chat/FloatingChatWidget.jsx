import React, { useState, useRef, useEffect } from "react";
import { Wrench, Send, Loader2, X, MessageCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

let _widgetStyleInjected = false;
function injectWidgetStyle() {
  if (_widgetStyleInjected || typeof document === "undefined") return;
  _widgetStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes lbc-chat-slide-up {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes lbc-chat-dot-bounce {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1.0); opacity: 1; }
    }
    .lbc-chat-fab {
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #0a0f1e 0%, #1e293b 100%);
      border: 2px solid #0ea5e9;
      box-shadow: 0 0 16px rgba(14,165,233,0.4), 0 4px 20px rgba(0,0,0,0.4);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .lbc-chat-fab:hover {
      transform: scale(1.05);
      box-shadow: 0 0 24px rgba(14,165,233,0.6), 0 6px 24px rgba(0,0,0,0.5);
    }
    .lbc-chat-panel {
      position: fixed; bottom: 88px; right: 20px; z-index: 9999;
      width: 360px; max-width: calc(100vw - 40px); max-height: 520px;
      border-radius: 16px; overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      background: #0a0f1e; border: 1px solid rgba(14,165,233,0.2);
      display: flex; flex-direction: column;
      animation: lbc-chat-slide-up 0.25s ease-out;
    }
    .lbc-chat-header {
      display: flex; align-items: center; gap: 10px; padding: 14px 16px;
      background: linear-gradient(135deg, #0a0f1e 0%, #1e3a5f 100%);
      border-bottom: 1px solid rgba(14,165,233,0.15);
    }
    .lbc-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 10px;
      min-height: 280px; max-height: 380px;
      scrollbar-width: thin; scrollbar-color: rgba(14,165,233,0.3) transparent;
    }
    .lbc-chat-input-row {
      display: flex; align-items: center; gap: 8px; padding: 12px;
      border-top: 1px solid rgba(14,165,233,0.1); background: #0f1729;
    }
    .lbc-chat-input {
      flex: 1; background: #1a2438; border: 1px solid rgba(14,165,233,0.3);
      border-radius: 10px; padding: 10px 14px; font-size: 13px; color: #e2e8f0;
      outline: none; transition: border-color 0.2s;
    }
    .lbc-chat-input::placeholder { color: #475569; }
    .lbc-chat-input:focus { border-color: #0ea5e9; }
    .lbc-chat-send {
      width: 38px; height: 38px; border-radius: 10px; background: #0ea5e9;
      border: none; display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; transition: background 0.15s;
    }
    .lbc-chat-send:hover { background: #38bdf8; }
    .lbc-chat-send:disabled { opacity: 0.35; cursor: not-allowed; }
    .lbc-chat-dot { width: 7px; height: 7px; border-radius: 50%; background: #38bdf8; display: inline-block; animation: lbc-chat-dot-bounce 1.2s infinite ease-in-out; }
    @media (max-width: 480px) {
      .lbc-chat-panel {
        bottom: 0; right: 0; width: 100vw; max-width: 100vw; max-height: 100vh;
        border-radius: 0; border: none;
      }
      .lbc-chat-fab { bottom: 16px; right: 16px; }
    }
  `;
  document.head.appendChild(style);
}

export default function FloatingChatWidget({ shop_email, shop_name }) {
  injectWidgetStyle();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const displayName = shop_name || "LBC Auto";

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm the AI assistant for ${displayName}. How can I help you today? 🔧`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text };
    const history = [...messages];
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const result = await base44.functions.invoke("handleChatMessage", {
        shop_email,
        session_id: sessionId,
        customer_message: text,
        conversation_history: history.filter(m => m.role === "user" || m.role === "assistant"),
      });

      const reply = result?.data?.reply || result?.reply || "I'm sorry, I didn't catch that.";
      const bookingMade = result?.data?.booking_made || result?.booking_made || false;

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);

      if (bookingMade) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "✅ You're all booked! The shop will see your appointment and reach out to confirm. Is there anything else I can help with?",
          }]);
        }, 600);
      } else if (history.filter(m => m.role === "user").length === 0) {
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: "Want me to book you an appointment? Just share your name and phone number. 📅",
          }]);
        }, 600);
      }
    } catch (e) {
      console.error("Chat error:", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ I'm having trouble connecting right now. Please try again or call us directly.",
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {open && (
        <div className="lbc-chat-panel">
          <div className="lbc-chat-header">
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Wrench style={{ width: 18, height: 18, color: "#fff" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayName}
              </div>
              <div style={{ color: "#38bdf8", fontSize: 11 }}>Powered by LBC Auto AI</div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
              <X style={{ width: 18, height: 18, color: "#64748b" }} />
            </button>
          </div>

          <div className="lbc-chat-messages">
            {messages.map((m, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "82%", borderRadius: 12, padding: "10px 14px",
                  fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "linear-gradient(135deg, #0ea5e9, #3b82f6)" : "#1a2438",
                  border: m.role === "user" ? "none" : "1px solid rgba(14,165,233,0.1)",
                  color: m.role === "user" ? "#fff" : "#cbd5e1",
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  background: "#1a2438", border: "1px solid rgba(14,165,233,0.1)",
                  borderRadius: 12, padding: "10px 16px", display: "flex", gap: 5,
                }}>
                  <div className="lbc-chat-dot" style={{ animationDelay: "0ms" }} />
                  <div className="lbc-chat-dot" style={{ animationDelay: "150ms" }} />
                  <div className="lbc-chat-dot" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="lbc-chat-input-row">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type your message…"
              className="lbc-chat-input"
              disabled={loading}
            />
            <button className="lbc-chat-send" onClick={sendMessage} disabled={!input.trim() || loading}>
              {loading
                ? <Loader2 style={{ width: 16, height: 16, color: "#fff", animation: "spin 1s linear infinite" }} />
                : <Send style={{ width: 16, height: 16, color: "#fff" }} />
              }
            </button>
          </div>

          <div style={{ padding: "6px 12px", textAlign: "center", fontSize: 10, color: "#475569", background: "#0f1729", borderTop: "1px solid rgba(14,165,233,0.05)" }}>
            Powered by <a href="https://lbchub.tech" target="_blank" rel="noopener noreferrer" style={{ color: "#0ea5e9", textDecoration: "none", fontWeight: 600 }}>LBC Auto AI</a>
          </div>
        </div>
      )}

      <button className="lbc-chat-fab" onClick={() => setOpen(v => !v)}>
        {open
          ? <X style={{ width: 24, height: 24, color: "#fff" }} />
          : <MessageCircle style={{ width: 24, height: 24, color: "#0ea5e9" }} />
        }
      </button>
    </>
  );
}