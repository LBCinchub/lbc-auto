import React from "react";
import { MessageSquare, Phone, Clock } from "lucide-react";

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "ai_handled", label: "AI Handled" },
  { value: "resolved", label: "Resolved" },
];

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLES = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ai_handled: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  owner_replied: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

const STATUS_LABELS = {
  open: "Open",
  ai_handled: "AI",
  owner_replied: "Replied",
  resolved: "Resolved",
};

export default function ConversationList({ sessions, selectedSessionId, onSelect, filter, setFilter }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex gap-1 p-2 border-b border-gray-200 dark:border-gray-800">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.value
                ? "bg-sky-500 text-white"
                : "bg-transparent text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8">
            <MessageSquare style={{ width: 32, height: 32 }} className="mb-2 opacity-40" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          sessions.map(session => (
            <button
              key={session.session_id}
              onClick={() => onSelect(session.session_id)}
              className={`w-full text-left p-3 border-b transition-colors ${
                selectedSessionId === session.session_id
                  ? "bg-sky-50 dark:bg-sky-900/20 border-l-4 border-l-sky-500"
                  : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate text-gray-900 dark:text-white">
                      {session.customer_name || "Unknown Customer"}
                    </span>
                    {session.unread_count > 0 && (
                      <span className="flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {session.unread_count > 99 ? "99+" : session.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {session.last_message || "No messages"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock style={{ width: 10, height: 10 }} />
                      {formatTime(session.last_timestamp)}
                    </span>
                    {session.customer_phone && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Phone style={{ width: 10, height: 10 }} />
                        {session.customer_phone}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[session.status] || STATUS_STYLES.open}`}>
                  {STATUS_LABELS[session.status] || session.status}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}