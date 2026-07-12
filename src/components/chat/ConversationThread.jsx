import React, { useState, useRef, useEffect } from "react";
import { Wrench, Send, CheckCircle, Phone, Car } from "lucide-react";

export default function ConversationThread({ session, messages, onResolve, onSendReply, sendingReply }) {
  const [replyText, setReplyText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!replyText.trim()) return;
    onSendReply(replyText.trim());
    setReplyText("");
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Wrench style={{ width: 40, height: 40 }} className="mb-3 opacity-30" />
        <p className="text-sm">Select a conversation to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {session.customer_name || "Unknown Customer"}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              {session.customer_phone && (
                <span className="flex items-center gap-1">
                  <Phone style={{ width: 12, height: 12 }} />
                  {session.customer_phone}
                </span>
              )}
              {session.vehicle_info && (
                <span className="flex items-center gap-1">
                  <Car style={{ width: 12, height: 12 }} />
                  {session.vehicle_info}
                </span>
              )}
            </div>
          </div>
          {session.status !== "resolved" && (
            <button
              onClick={() => onResolve(session.session_id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/30 transition-colors"
            >
              <CheckCircle style={{ width: 14, height: 14 }} />
              Resolve
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div key={idx} className={`flex ${m.sender_type === "owner" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
              m.sender_type === "customer"
                ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                : m.sender_type === "ai"
                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-bl-sm"
                : "bg-sky-500 text-white rounded-br-sm"
            }`}>
              {(m.sender_type === "ai" || m.sender_type === "owner") && (
                <div className="text-[10px] font-bold mb-0.5 opacity-70">
                  {m.sender_type === "ai" ? "🤖 AI" : "👤 You"}
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.message}</p>
              <div className="text-[10px] mt-1 opacity-50">
                {new Date(m.created_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex-shrink-0 p-3 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Type your reply…"
            disabled={sendingReply || session.status === "resolved"}
            className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-sky-400"
          />
          <button
            onClick={handleSend}
            disabled={!replyText.trim() || sendingReply || session.status === "resolved"}
            className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center hover:bg-sky-600 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
          >
            <Send style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {session.status === "resolved" && (
          <p className="text-xs text-gray-400 mt-2 text-center">This conversation has been resolved</p>
        )}
      </div>
    </div>
  );
}