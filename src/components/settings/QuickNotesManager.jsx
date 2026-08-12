import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";

/**
 * Settings panel for managing shop-specific custom Quick Notes.
 * Notes are tenant-scoped (ShopQuickNote entity, RLS by shop_owner_email).
 */
export default function QuickNotesManager() {
  const { theme } = useTheme();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.ShopQuickNote.list("-created_date", 100);
      setNotes(rows || []);
    } catch (e) {
      setNotes([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addNote = async () => {
    const text = newText.trim();
    if (!text) return;
    const user = await base44.auth.me();
    setSaving(true);
    try {
      await base44.entities.ShopQuickNote.create({ shop_owner_email: user.email, text });
      setNewText("");
      await load();
    } catch (e) {
      alert("Could not save note: " + e.message);
    }
    setSaving(false);
  };

  const deleteNote = async (id) => {
    try { await base44.entities.ShopQuickNote.delete(id); await load(); } catch {}
  };

  const card = theme === "light" ? "bg-white border-gray-200" : "bg-gray-900 border-gray-800";
  const chip = theme === "light" ? "bg-gray-50 border-gray-300 text-gray-700" : "bg-gray-800/50 border-gray-700/50 text-gray-300";

  return (
    <div className={`${card} border rounded-lg p-6`}>
      <h2 className={`text-xl font-semibold mb-1 ${theme === "light" ? "text-gray-900" : "text-white"}`}>Quick Notes</h2>
      <p className={`text-sm mb-4 ${theme === "light" ? "text-gray-600" : "text-gray-500"}`}>
        Custom one-tap notes shown alongside the defaults on Estimates, Invoices &amp; Repair Orders.
      </p>

      <div className="flex gap-2 mb-4">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
          placeholder="Add a custom quick note…"
          className={`${theme === "light" ? "bg-gray-50 border-gray-300 text-gray-900" : "bg-gray-800 border-gray-700 text-white"}`}
        />
        <Button onClick={addNote} disabled={saving || !newText.trim()} className="bg-sky-500 hover:bg-sky-600 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Add
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-500">No custom quick notes yet. The default popular notes are always available.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {notes.map((n) => (
            <div key={n.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${chip}`}>
              <span>{n.text}</span>
              <button onClick={() => deleteNote(n.id)} className="text-gray-400 hover:text-rose-500 transition-colors" title="Delete">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}