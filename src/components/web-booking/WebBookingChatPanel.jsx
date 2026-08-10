import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

/**
 * Chat panel used inside the embeddable web booking widget.
 * Polls the `webBooking` backend for new messages every 5 seconds, sends
 * customer messages via `send_chat_message`, and auto-scrolls to the latest.
 * Shop replies (sender_type "owner") render left-aligned; customer messages
 * right-aligned. "Awaiting shop reply…" shows until the shop responds.
 */
export default function WebBookingChatPanel({ shopApiKey, sessionId, customerName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const fetchMessages = async () => {
    try {
      const res = await base44.functions.invoke("webBooking", {
        action: "get_chat_messages",
        shop_api_key: shopApiKey,
        session_id: sessionId,
      });
      const list = res?.data?.messages || res?.messages || [];
      setMessages(list);
      setError("");
    } catch (e) {
      setError("Could not load messages. Retrying…");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [
      ...prev,
      { sender_type: "customer", sender_name: customerName, message: text, sent_at: new Date().toISOString() },
    ]);
    try {
      await base44.functions.invoke("webBooking", {
        action: "send_chat_message",
        shop_api_key: shopApiKey,
        session_id: sessionId,
        sender_name: customerName,
        message: text,
      });
      fetchMessages();
    } catch (e) {
      setError("Message failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const hasShopReply = messages.some((m) => m.sender_type === "owner");

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading chat…
          </div>
        ) : (
          <>
            {messages.map((m, idx) => {
              const isShop = m.sender_type === "owner";
              return (
                <div key={idx} className={`flex ${isShop ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                      isShop
                        ? "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm"
                        : "bg-sky-500 text-white rounded-br-sm"
                    }`}
                  >
                    {isShop && <div className="text-[10px] font-bold mb-0.5 text-sky-600">{m.sender_name || "Shop"}</div>}
                    <p className="whitespace-pre-wrap leading-snug">{m.message}</p>
                    <div className={`text-[10px] mt-1 ${isShop ? "text-slate-400" : "text-sky-100"}`}>
                      {m.sent_at ? new Date(m.sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-2 border-t border-slate-200 bg-white">
        {!hasShopReply && messages.length > 0 && (
          <div className="text-[11px] text-slate-400 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Awaiting shop reply…
          </div>
        )}
        {error && <div className="text-[11px] text-rose-500 mb-1.5">{error}</div>}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Type a message to the shop…"
            disabled={sending}
            className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 text-sm outline-none focus:border-sky-400 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}