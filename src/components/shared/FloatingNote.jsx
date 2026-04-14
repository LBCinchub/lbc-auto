import React, { useState, useEffect } from "react";
import { StickyNote, X, ChevronDown, ChevronUp } from "lucide-react";

export default function FloatingNote() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(() => localStorage.getItem("floating_note") || "");

  useEffect(() => {
    localStorage.setItem("floating_note", note);
  }, [note]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl shadow-2xl w-72 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-yellow-200/70 border-b border-yellow-300">
            <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm">
              <StickyNote className="w-4 h-4" /> Quick Note
            </div>
            <button onClick={() => setOpen(false)} className="text-yellow-700 hover:text-yellow-900">
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <textarea
            className="w-full h-40 p-3 text-sm text-gray-800 bg-yellow-50 resize-none focus:outline-none placeholder-yellow-400"
            placeholder="Write a quick note..."
            value={note}
            onChange={e => setNote(e.target.value)}
            autoFocus
          />
          {note && (
            <button
              onClick={() => setNote("")}
              className="text-xs text-yellow-600 hover:text-red-500 px-3 py-1.5 text-right border-t border-yellow-200 bg-yellow-100/50"
            >
              Clear note
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-yellow-400 hover:bg-yellow-300 shadow-lg flex items-center justify-center transition-all relative"
      >
        <StickyNote className="w-5 h-5 text-yellow-900" />
        {note && !open && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
}