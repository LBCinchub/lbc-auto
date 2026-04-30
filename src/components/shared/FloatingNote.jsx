import React, { useState, useEffect } from "react";
import { StickyNote, ChevronDown, ChevronUp, Trash2 } from "lucide-react";

export default function FloatingNote() {
  const [open, setOpen] = useState(false);
  const [currentNote, setCurrentNote] = useState("");
  const [notes, setNotes] = useState(() => {
    const stored = localStorage.getItem("daily_notes");
    return stored ? JSON.parse(stored) : {};
  });

  const today = new Date().toISOString().split("T")[0];
  const hasNotes = Object.keys(notes).length > 0;
  const todayNote = notes[today] || "";

  useEffect(() => {
    localStorage.setItem("daily_notes", JSON.stringify(notes));
  }, [notes]);

  const handleSave = () => {
    if (currentNote.trim()) {
      setNotes(prev => ({ ...prev, [today]: currentNote }));
      setCurrentNote("");
    }
  };

  const handleDelete = (date) => {
    setNotes(prev => {
      const updated = { ...prev };
      delete updated[date];
      return updated;
    });
  };

  const sortedDates = Object.keys(notes).sort().reverse();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="bg-gradient-to-b from-yellow-50 to-yellow-100 border border-yellow-300 rounded-xl shadow-2xl w-80 flex flex-col overflow-hidden">
          {/* Input Section */}
          <div className="px-4 py-3 bg-yellow-200/60 border-b border-yellow-300">
            <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm mb-2">
              <StickyNote className="w-4 h-4" /> Today's Note
            </div>
            <textarea
              className="w-full h-28 p-2 text-sm text-gray-800 bg-white rounded border border-yellow-200 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 placeholder-yellow-500"
              placeholder="Add today's note..."
              value={currentNote}
              onChange={e => setCurrentNote(e.target.value)}
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={!currentNote.trim()}
              className="mt-2 w-full px-3 py-1.5 text-xs font-semibold text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 rounded transition-colors"
            >
              Save Note
            </button>
          </div>

          {/* History Section */}
          {sortedDates.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              <div className="space-y-2 p-3">
                {sortedDates.map(date => (
                  <div key={date} className="bg-white rounded-lg p-3 border-l-4 border-yellow-400">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                        {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </p>
                      <button
                        onClick={() => handleDelete(date)}
                        className="text-yellow-600 hover:text-red-600 flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-700">{notes[date]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2 bg-yellow-100/50 border-t border-yellow-300 flex items-center justify-between">
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
        className="w-12 h-12 rounded-full bg-yellow-400 hover:bg-yellow-300 shadow-lg flex items-center justify-center transition-all relative"
      >
        <StickyNote className="w-5 h-5 text-yellow-900" />
        {hasNotes && !open && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  );
}