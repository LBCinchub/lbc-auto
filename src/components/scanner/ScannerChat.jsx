import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Send } from "lucide-react";

export default function ScannerChat({ messages, input, loading, onInputChange, onSend }) {
  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="text-white font-semibold text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-400" /> Ask LBC Auto AI
      </h3>
      <p className="text-xs text-gray-500">Ask follow-up questions about these codes, repair procedures, or parts.</p>

      {messages.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-sky-500/20 text-sky-100" : "bg-gray-700/60 text-gray-200"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-700/60 rounded-lg px-3 py-2">
                <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          placeholder="e.g. What's the torque spec for the brake caliper bolts?"
          disabled={loading}
          className="flex-1 bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-600 focus:outline-none focus:border-sky-500"
        />
        <Button size="sm" onClick={onSend} disabled={loading || !input.trim()} className="bg-purple-500 hover:bg-purple-600 text-white gap-2">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}