import React, { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const OIL_OPTIONS = [
  { label: "3,000 km", note: "🛢 Oil change due in 3,000 km" },
  { label: "5,000 km", note: "🛢 Oil change due in 5,000 km" },
  { label: "8,000 km", note: "🛢 Oil change due in 8,000 km" },
  { label: "10,000 km", note: "🛢 Oil change due in 10,000 km" },
];

const RETORQUE_OPTIONS = [
  { label: "3 days", note: "🔩 Return in 3 days to re-torque lug nuts" },
  { label: "5 days", note: "🔩 Return in 5 days to re-torque lug nuts" },
  { label: "1 week", note: "🔩 Return in 1 week to re-torque lug nuts" },
];

const QUICK_REMINDERS = [
  "🔧 Return in 2 weeks to check alignment",
  "🚗 Tire rotation recommended at next visit",
  "⚠️ Brake pads at 30% — monitor closely",
  "🔋 Battery health low — replacement recommended soon",
  "💧 Check coolant level in 1 month",
];

const CUSTOM_REMINDERS_KEY = "tech_custom_reminders";

function Pill({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
        selected
          ? "bg-emerald-500 border-emerald-500 text-gray-900"
          : "bg-gray-800/60 border-gray-700 text-gray-300 hover:border-emerald-500/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export default function TechnicianNotes({ value, onChange }) {
  // value is a string (the full notes text)
  // We maintain an array of selected reminder lines + a freeform text
  const [activeNotes, setActiveNotes] = useState([]);
  const [freeText, setFreeText] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [customReminders, setCustomReminders] = useState([]);
  const [initialized, setInitialized] = useState(false);

  // Load custom reminders from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_REMINDERS_KEY);
      if (saved) setCustomReminders(JSON.parse(saved));
    } catch {}
  }, []);

  // Initialize from existing value
  useEffect(() => {
    if (!initialized && value !== undefined) {
      if (value) {
        // Split existing notes into lines, classify into reminders vs free text
        const lines = value.split("\n").filter(Boolean);
        const allKnown = [
          ...OIL_OPTIONS.map(o => o.note),
          ...RETORQUE_OPTIONS.map(o => o.note),
          ...QUICK_REMINDERS,
        ];
        const knownLines = lines.filter(l => allKnown.includes(l));
        const freeLines = lines.filter(l => !allKnown.includes(l));
        setActiveNotes(knownLines);
        setFreeText(freeLines.join("\n"));
      }
      setInitialized(true);
    }
  }, [value, initialized]);

  const buildOutput = (notes, free) => {
    const parts = [...notes];
    if (free.trim()) parts.push(free.trim());
    return parts.join("\n");
  };

  const toggleNote = (note, group) => {
    let updated;
    if (group === "oil") {
      const oilNotes = OIL_OPTIONS.map(o => o.note);
      const withoutOil = activeNotes.filter(n => !oilNotes.includes(n));
      updated = activeNotes.includes(note) ? withoutOil : [...withoutOil, note];
    } else if (group === "retorque") {
      const retorqueNotes = RETORQUE_OPTIONS.map(o => o.note);
      const withoutRetorque = activeNotes.filter(n => !retorqueNotes.includes(n));
      updated = activeNotes.includes(note) ? withoutRetorque : [...withoutRetorque, note];
    } else {
      updated = activeNotes.includes(note)
        ? activeNotes.filter(n => n !== note)
        : [...activeNotes, note];
    }
    setActiveNotes(updated);
    onChange(buildOutput(updated, freeText));
  };

  const removeNote = (note) => {
    const updated = activeNotes.filter(n => n !== note);
    setActiveNotes(updated);
    onChange(buildOutput(updated, freeText));
  };

  const handleFreeTextChange = (val) => {
    setFreeText(val);
    onChange(buildOutput(activeNotes, val));
  };

  const saveCustomReminder = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const updated = [...customReminders, trimmed];
    setCustomReminders(updated);
    localStorage.setItem(CUSTOM_REMINDERS_KEY, JSON.stringify(updated));
    setCustomInput("");
  };

  const removeCustomReminder = (idx) => {
    const updated = customReminders.filter((_, i) => i !== idx);
    setCustomReminders(updated);
    localStorage.setItem(CUSTOM_REMINDERS_KEY, JSON.stringify(updated));
    // Also remove from active if selected
    const note = customReminders[idx];
    const updatedActive = activeNotes.filter(n => n !== note);
    setActiveNotes(updatedActive);
    onChange(buildOutput(updatedActive, freeText));
  };

  const selectedOil = OIL_OPTIONS.find(o => activeNotes.includes(o.note));
  const selectedRetorque = RETORQUE_OPTIONS.find(o => activeNotes.includes(o.note));

  return (
    <div className="space-y-5">
      {/* Oil Change */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase mb-2">🛢 Oil Change Due In</p>
        <div className="flex flex-wrap gap-2">
          {OIL_OPTIONS.map(opt => (
            <Pill
              key={opt.label}
              label={opt.label}
              selected={selectedOil?.label === opt.label}
              onClick={() => toggleNote(opt.note, "oil")}
            />
          ))}
        </div>
      </div>

      {/* Re-torque */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase mb-2">🔩 Return to Re-Torque In</p>
        <div className="flex flex-wrap gap-2">
          {RETORQUE_OPTIONS.map(opt => (
            <Pill
              key={opt.label}
              label={opt.label}
              selected={selectedRetorque?.label === opt.label}
              onClick={() => toggleNote(opt.note, "retorque")}
            />
          ))}
        </div>
      </div>

      {/* Quick Reminders */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase mb-2">Quick Reminders</p>
        <div className="flex flex-wrap gap-2">
          {QUICK_REMINDERS.map(note => (
            <Pill
              key={note}
              label={note}
              selected={activeNotes.includes(note)}
              onClick={() => toggleNote(note, "quick")}
            />
          ))}
          {customReminders.map((note, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <Pill
                label={note}
                selected={activeNotes.includes(note)}
                onClick={() => toggleNote(note, "quick")}
              />
              <button
                type="button"
                onClick={() => removeCustomReminder(idx)}
                className="text-gray-600 hover:text-rose-400 transition-colors"
                title="Delete custom reminder"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Selected notes preview */}
      {activeNotes.length > 0 && (
        <div className="bg-gray-800/40 rounded-lg p-3 space-y-1.5">
          <p className="text-gray-500 text-xs uppercase mb-2">Selected Reminders</p>
          {activeNotes.map(note => (
            <div key={note} className="flex items-center justify-between gap-2">
              <span className="text-gray-300 text-sm">{note}</span>
              <button
                type="button"
                onClick={() => removeNote(note)}
                className="text-gray-600 hover:text-rose-400 transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Free text area */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase mb-2">Additional Notes</p>
        <textarea
          value={freeText}
          onChange={e => handleFreeTextChange(e.target.value)}
          placeholder="Type any custom technician notes here..."
          rows={3}
          className="w-full bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-sm placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500/60 transition-colors"
        />
      </div>

      {/* Custom Quick Button */}
      <div>
        <p className="text-gray-400 text-xs font-semibold uppercase mb-2">Save Custom Quick Button</p>
        <div className="flex gap-2">
          <Input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveCustomReminder()}
            placeholder="Type your own reminder..."
            className="bg-gray-800/60 border-gray-700 text-white text-sm h-8 flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={saveCustomReminder}
            disabled={!customInput.trim()}
            className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
          >
            <Plus className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}