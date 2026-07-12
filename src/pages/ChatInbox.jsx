import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare } from "lucide-react";
import ConversationList from "@/components/chat/ConversationList";
import ConversationThread from "@/components/chat/ConversationThread";

export default function ChatInbox() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sendingReply, setSendingReply] = useState(false);

  const loadMessages = async () => {
    try {
      const all = await base44.entities.ChatMessage.list("-created_date", 500);
      setMessages(all);
    } catch (e) {
      console.error("Failed to load messages:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const sessions = useMemo(() => {
    const map = {};
    messages.forEach(m => {
      if (!map[m.session_id]) {
        map[m.session_id] = {
          session_id: m.session_id,
          messages: [],
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          vehicle_info: "",
          service_requested: "",
          status: "open",
          unread_count: 0,
          last_message: "",
          last_timestamp: null,
        };
      }
      const s = map[m.session_id];
      s.messages.push(m);
      if (!m.is_read) s.unread_count++;
      if (!s.customer_name && m.customer_name) s.customer_name = m.customer_name;
      if (!s.customer_phone && m.customer_phone) s.customer_phone = m.customer_phone;
      if (!s.customer_email && m.customer_email) s.customer_email = m.customer_email;
      if (!s.vehicle_info && m.vehicle_info) s.vehicle_info = m.vehicle_info;
      if (!s.service_requested && m.service_requested) s.service_requested = m.service_requested;
      if (m.status === "resolved") s.status = "resolved";
      else if (m.status === "owner_replied" && s.status !== "resolved") s.status = "owner_replied";
      else if (m.status === "ai_handled" && s.status === "open") s.status = "ai_handled";
    });

    Object.values(map).forEach(s => {
      s.messages.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const last = s.messages[s.messages.length - 1];
      s.last_message = last?.message || "";
      s.last_timestamp = last?.created_date;
    });

    return Object.values(map).sort((a, b) =>
      new Date(b.last_timestamp || 0) - new Date(a.last_timestamp || 0)
    );
  }, [messages]);

  const filteredSessions = sessions.filter(s => {
    if (filter === "all") return true;
    return s.status === filter;
  });

  const selectedSession = sessions.find(s => s.session_id === selectedSessionId);
  const selectedMessages = selectedSession?.messages || [];

  const handleSelectSession = async (sessionId) => {
    setSelectedSessionId(sessionId);
    try {
      await base44.entities.ChatMessage.updateMany(
        { session_id: sessionId, is_read: false },
        { $set: { is_read: true } }
      );
      setMessages(prev => prev.map(m =>
        m.session_id === sessionId ? { ...m, is_read: true } : m
      ));
    } catch (e) {
      console.error("Failed to mark as read:", e);
    }
  };

  const handleResolve = async (sessionId) => {
    try {
      await base44.entities.ChatMessage.updateMany(
        { session_id: sessionId },
        { $set: { status: "resolved" } }
      );
      setMessages(prev => prev.map(m =>
        m.session_id === sessionId ? { ...m, status: "resolved" } : m
      ));
    } catch (e) {
      console.error("Failed to resolve:", e);
    }
  };

  const handleSendReply = async (text) => {
    if (!selectedSessionId) return;
    setSendingReply(true);
    try {
      const user = await base44.auth.me();
      const session = sessions.find(s => s.session_id === selectedSessionId);
      await base44.entities.ChatMessage.create({
        shop_email: user.email,
        session_id: selectedSessionId,
        sender_type: "owner",
        sender_name: user.full_name || user.business_name || "Shop Owner",
        message: text,
        customer_name: session?.customer_name || "",
        customer_phone: session?.customer_phone || "",
        customer_email: session?.customer_email || "",
        vehicle_info: session?.vehicle_info || "",
        service_requested: session?.service_requested || "",
        status: "owner_replied",
        is_read: true,
        source: "dashboard",
      });
      await loadMessages();
    } catch (e) {
      console.error("Failed to send reply:", e);
    }
    setSendingReply(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-sky-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Chat Inbox</h1>
          <p className="text-sm text-gray-500">AI-handled customer conversations from your website widget</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] h-[calc(100vh-220px)] min-h-[500px]">
          <div className="border-r border-gray-200 dark:border-gray-800 overflow-hidden">
            <ConversationList
              sessions={filteredSessions}
              selectedSessionId={selectedSessionId}
              onSelect={handleSelectSession}
              filter={filter}
              setFilter={setFilter}
            />
          </div>

          <div className="overflow-hidden">
            <ConversationThread
              session={selectedSession}
              messages={selectedMessages}
              onResolve={handleResolve}
              onSendReply={handleSendReply}
              sendingReply={sendingReply}
            />
          </div>
        </div>
      </div>
    </div>
  );
}