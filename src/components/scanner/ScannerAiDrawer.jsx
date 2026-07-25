import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import ScannerAiMessage from "@/components/scanner/ScannerAiMessage";

const prompts = ["Can I drive with this code?", "What part should I replace first?", "How many labor hours?", "Explain this to the customer"];

export default function ScannerAiDrawer({ open, messages, loading, focus, onClose, onSend, onRepairOrder, onEstimate, onPrint, onSave }) {
  const [input, setInput] = useState("");
  if (!open) return null;
  const submit = () => { const text = input.trim(); if (!text || loading) return; setInput(""); onSend(text); };
  const latestAssistant = messages.map(m => m.role).lastIndexOf("assistant");
  return <div className="fixed inset-0 z-[140] bg-black/70 flex justify-end">
    <aside className="w-full md:max-w-xl h-full bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl">
      <header className="shrink-0 px-4 py-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
        <div><h2 className="text-white font-bold flex items-center gap-2"><Sparkles className="w-4 h-4 text-sky-400" /> Lumina Scan Follow-up</h2><p className="text-xs text-gray-500">{focus?.code ? `Focused on ${focus.code}` : focus?.connectionIssue ? "Connection diagnosis" : "Full health report context loaded"}</p></div>
        <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-800"><X className="w-5 h-5" /></button>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => <ScannerAiMessage key={index} message={message} isLatest={index === latestAssistant} showRepairActions={!focus?.connectionIssue} onRepairOrder={onRepairOrder} onEstimate={onEstimate} onPrint={onPrint} onSave={onSave} />)}
        {loading && <div className="flex items-center gap-2 text-sm text-sky-400"><Loader2 className="w-4 h-4 animate-spin" /> Lumina is reviewing the scan…</div>}
      </div>
      <div className="shrink-0 border-t border-gray-800 bg-gray-900 p-3 space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">{prompts.map(prompt => <button key={prompt} onClick={() => onSend(prompt)} disabled={loading} className="shrink-0 text-xs border border-gray-700 rounded-full px-3 py-1.5 text-gray-300 hover:border-sky-500">{prompt}</button>)}</div>
        <div className="flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} placeholder="Ask about this scan…" className="flex-1 min-w-0 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-sm text-white outline-none focus:border-sky-500" /><Button onClick={submit} disabled={loading || !input.trim()} className="bg-sky-600 hover:bg-sky-700"><Send className="w-4 h-4" /></Button></div>
      </div>
    </aside>
  </div>;
}