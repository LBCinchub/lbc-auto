import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ItemNameAutocomplete from "@/components/shared/ItemNameAutocomplete";
import { calcGhostTotals, lineTotal } from "@/utils/ghostTax";

// Edit the ghost: add/remove items, edit prices/qty, edit the "What's Next" note.
// Uses the item library autocomplete for names (same as the main editors).
export default function GhostEditorDialog({ open, onClose, items, taxRate, taxAppliesTo, notes, onSave }) {
  const [local, setLocal] = useState([]);
  const [localNotes, setLocalNotes] = useState("");

  useEffect(() => {
    if (open) {
      setLocal((items || []).map((i) => ({ ...i })));
      setLocalNotes(notes || "");
    }
  }, [open, items, notes]);

  const update = (i, field, val) => setLocal(local.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  const add = (type) => setLocal([...local, { type, name: "", description: "", quantity: 1, unit_price: 0, taxable: true }]);
  const remove = (i) => setLocal(local.filter((_, idx) => idx !== i));
  const totals = calcGhostTotals(local, taxRate, taxAppliesTo);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="bg-gray-900 border-gray-800 text-white sm:max-w-3xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Edit Ghost — Remaining Work</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button type="button" size="sm" variant="outline" onClick={() => add("labor")} className="gap-1 border-gray-700 text-gray-300"><Plus /> Labor</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => add("part")} className="gap-1 border-gray-700 text-gray-300"><Plus /> Part</Button>
        </div>

        <div className="max-h-[44vh] overflow-y-auto rounded-lg border border-gray-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-800/70 text-left text-xs uppercase tracking-wide text-gray-400 sticky top-0">
              <tr>
                <th className="px-2 py-2 w-20">Type</th>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2 w-20">Qty</th>
                <th className="px-2 py-2 w-28">Price</th>
                <th className="px-2 py-2 w-24 text-right">Amount</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {local.map((it, i) => (
                <tr key={i} className="bg-gray-900/40 align-top">
                  <td className="px-2 py-2">
                    <select value={it.type} onChange={(e) => update(i, "type", e.target.value)} className="h-9 rounded-md border border-gray-700 bg-gray-950 px-1 text-white">
                      <option value="labor">Labor</option>
                      <option value="part">Part</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <ItemNameAutocomplete value={it.name || ""} type={it.type} onChange={(name) => update(i, "name", name)} onPriceSelect={(price) => update(i, "unit_price", price)} className="border-gray-700 bg-gray-950 text-white" />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" min="0" step="0.01" value={it.quantity} onChange={(e) => update(i, "quantity", e.target.value)} className="border-gray-700 bg-gray-950 text-right text-white" />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" min="0" step="0.01" value={it.unit_price} onChange={(e) => update(i, "unit_price", e.target.value)} className="border-gray-700 bg-gray-950 text-right text-white" />
                  </td>
                  <td className="px-2 py-2 text-right font-medium text-white tabular-nums">${lineTotal(it).toFixed(2)}</td>
                  <td className="px-1 py-2 text-right">
                    <button type="button" onClick={() => remove(i)} className="text-gray-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {local.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No items. Add a part or labor above.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full sm:w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-300"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-300"><span>Tax</span><span>${totals.tax.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-white border-t border-gray-700 pt-1"><span>Total</span><span>${totals.total.toFixed(2)}</span></div>
        </div>

        <div>
          <Label className="text-gray-400">What's Next note</Label>
          <Textarea value={localNotes} onChange={(e) => setLocalNotes(e.target.value)} rows={3} className="bg-gray-950 border-gray-700 text-white mt-1" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
          <Button onClick={() => onSave(local, localNotes)} className="bg-sky-500 hover:bg-sky-600">Save Ghost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}