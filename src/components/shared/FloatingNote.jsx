import React, { useState, useEffect } from "react";
import { StickyNote, ChevronDown, Trash2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function FloatingNote() {
  const [open, setOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && notes.length === 0) {
      loadNotes();
    }
  }, [open]);

  const loadNotes = async () => {
    setLoading(true);
    const data = await base44.entities.Note.list("-created_date", 100);
    setNotes(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentNote.trim()) return;
    setSaving(true);
    const created = await base44.entities.Note.create({
      content: currentNote.trim(),
      timestamp: new Date().toISOString(),
    });
    setNotes(prev => [created, ...prev]);
    setCurrentNote("");
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Note.delete(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  const formatTimestamp = (iso) => {
    const d = new Date(iso);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ` ${time}`;
  };

  return (
    <div className="fixed top-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-gradient-to-b from-yellow-50 to-yellow-100 border border-yellow-300 rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden max-h-[80vh]">
          {/* Input Section */}
          <div className="px-4 py-3 bg-yellow-200/60 border-b border-yellow-300 flex-shrink-0">
            <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm mb-2">
              <StickyNote className="w-4 h-4" /> Notes
            </div>
            <textarea
              className="w-full h-24 p-2 text-sm text-gray-800 bg-white rounded border border-yellow-200 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-yellow-500"
              placeholder="Write a note... (Ctrl+Enter to save)"
              value={currentNote}
              onChange={e => setCurrentNote(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!currentNote.trim() || saving}
              className="mt-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded transition-colors flex items-center justify-center gap-1"
            >
              {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</> : "Save Note"}
            </button>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-yellow-600" /></div>
            ) : notes.length === 0 ? (
              <div className="p-4 text-center text-xs text-yellow-600 opacity-70">No notes yet. Write one above!</div>
            ) : (
              <div className="space-y-2 p-3">
                {notes.map(note => (
                  <div key={note.id} className="bg-white rounded-lg p-3 border-l-4 border-yellow-400 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-yellow-700">
                        {formatTimestamp(note.timestamp || note.created_date)}
                      </p>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="text-yellow-400 hover:text-red-600 flex-shrink-0 transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-yellow-100/50 border-t border-yellow-300 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-yellow-600">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
            <button
              onClick={() => setOpen(false)}
              className="text-yellow-700 hover:text-yellow-900 flex items-center gap-1"
            >
              <ChevronDown className="w-4 h-4" />
              <span className="text-xs font-medium">Collapse</span>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        className="w-12 h-12 rounded-full bg-yellow-400 hover:bg-yellow-300 flex items-center justify-center transition-all relative"
        style={{ boxShadow: "0 0 14px #facc15, 0 0 28px #facc1580" }}
      >
        <StickyNote className="w-5 h-5 text-yellow-900" />
        {notes.length > 0 && !open && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold px-0.5">
            {notes.length > 99 ? "99+" : notes.length}
          </span>
        )}
      </button>
    </div>
  );
}