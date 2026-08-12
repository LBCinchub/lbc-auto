import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DEFAULT_QUICK_NOTES } from "@/utils/quickNotes";

/**
 * Shared Quick Notes editor used on Estimates, Invoices, and Repair Orders.
 * Free-text notes + one-tap "popular notes" chips that toggle on/off.
 * Default popular notes are always available; shop custom notes load per tenant.
 */
export default function QuickNotesEditor({ value, onChange, label = "Notes (shown on print)" }) {
  const [customNotes, setCustomNotes] = useState([]);

  useEffect(() => {
    let mounted = true;
    base44.entities.ShopQuickNote.list("-created_date", 100)
      .then((rows) => { if (mounted) setCustomNotes((rows || []).map((r) => r.text)); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const allNotes = [...DEFAULT_QUICK_NOTES, ...customNotes];
  const activeLines = (value || "").split("\n").map((l) => l.trim()).filter(Boolean);

  const toggleNote = (note) => {
    const trimmed = note.trim();
    const lines = [...activeLines];
    const idx = lines.indexOf(trimmed);
    if (idx >= 0) lines.splice(idx, 1);
    else lines.push(trimmed);
    onChange(lines.join("\n"));
  };

  const isActive = (note) => activeLines.includes(note.trim());

  return (
    <div>
      <Label className="text-gray-300">{label}</Label>
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 border-gray-700 bg-gray-950 text-white"
        placeholder="Type custom notes, or tap the quick notes below to add them…"
      />
      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Quick notes — tap to add / remove</p>
        <div className="flex flex-wrap gap-2">
          {allNotes.map((note, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleNote(note)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive(note)
                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                  : "border-gray-700 bg-gray-800/50 text-gray-300 hover:border-sky-500/50 hover:text-white"
              }`}
            >
              {isActive(note) ? "✓ " : ""}{note}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}