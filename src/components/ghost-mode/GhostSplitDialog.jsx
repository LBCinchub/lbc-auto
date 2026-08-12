import React, { useState } from "react";
import { Ghost } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { calcGhostTotals, lineTotal, generateGhostNote } from "@/utils/ghostTax";

// Split modal: each line item toggles between "Done Now" (default) and "Remaining".
// A live dual summary shows Completed vs Ghost totals (tax included).
export default function GhostSplitDialog({ open, onClose, lineItems, taxRate, taxAppliesTo, onConfirm, initialRemaining }) {
  const [remaining, setRemaining] = useState(() => new Set());

  // Seed selection each time the dialog opens — pre-check items already in the
  // ghost so the shop can re-split and move items between Done Now and Remaining.
  React.useEffect(() => {
    if (open) setRemaining(new Set(Array.isArray(initialRemaining) ? initialRemaining : []));
  }, [open]);

  const items = lineItems || [];
  const toggle = (i) => {
    const next = new Set(remaining);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setRemaining(next);
  };

  const doneNow = items.filter((_, i) => !remaining.has(i));
  const ghost = items.filter((_, i) => remaining.has(i));
  const doneTotals = calcGhostTotals(doneNow, taxRate, taxAppliesTo);
  const ghostTotals = calcGhostTotals(ghost, taxRate, taxAppliesTo);

  const confirm = async () => {
    if (ghost.length === 0) {
      onClose();
      return;
    }
    const note = generateGhostNote(ghost, taxRate, ghostTotals);
    onConfirm({
      doneNowItems: doneNow,
      ghostItems: ghost,
      ghostNotes: note,
      ghostTotal: ghostTotals.total,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="bg-gray-900 border-gray-800 text-white sm:max-w-3xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ghost className="w-5 h-5 text-sky-400" /> Ghost Mode — Split Work
          </DialogTitle>
          <p className="text-sm text-gray-400 -mt-1">
            Check the items to defer as <span className="text-sky-400">Remaining (Ghost)</span>.
            Unchecked items stay as <span className="text-emerald-400">Done Now</span> (completed &amp; billed).
          </p>
        </DialogHeader>

        <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/70 text-left text-xs uppercase tracking-wide text-gray-400 sticky top-0">
              <tr>
                <th className="px-3 py-2 w-12"></th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-center">Type</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {items.map((it, i) => {
                const isRem = remaining.has(i);
                return (
                  <tr key={i} className={isRem ? "bg-sky-500/5" : "bg-gray-900/40"}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isRem}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 accent-sky-500 cursor-pointer"
                        title="Move to Remaining (Ghost)"
                      />
                    </td>
                    <td className="px-3 py-2 text-white">{it.name || it.description || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${it.type === "labor" ? "bg-sky-500/20 text-sky-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {it.type === "labor" ? "Labor" : "Part"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-300">{it.quantity}</td>
                    <td className="px-3 py-2 text-right text-gray-300">${(Number(it.unit_price) || 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium text-white tabular-nums">${lineTotal(it).toFixed(2)}</td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No line items to split.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dual summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-1">Completed Now</div>
            <div className="flex justify-between text-sm text-gray-300"><span>Subtotal</span><span>${doneTotals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-300"><span>Tax</span><span>${doneTotals.tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold text-white border-t border-emerald-500/20 mt-1 pt-1"><span>Total</span><span>${doneTotals.total.toFixed(2)}</span></div>
          </div>
          <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-400 mb-1 flex items-center gap-1"><Ghost className="w-3.5 h-3.5" /> Remaining (Ghost)</div>
            <div className="flex justify-between text-sm text-gray-300"><span>Subtotal</span><span>${ghostTotals.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sm text-gray-300"><span>Tax</span><span>${ghostTotals.tax.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold text-white border-t border-sky-500/20 mt-1 pt-1"><span>Total</span><span>${ghostTotals.total.toFixed(2)}</span></div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
          <Button onClick={confirm} disabled={ghost.length === 0} className="bg-sky-500 hover:bg-sky-600 gap-2">
            <Ghost className="w-4 h-4" /> Confirm Split ({ghost.length} remaining)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}