import React, { useEffect, useState } from "react";
import { Ghost, Pencil, FileText, Wrench, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { calcGhostTotals, lineTotal } from "@/utils/ghostTax";
import GhostEditorDialog from "./GhostEditorDialog";

// Renders the "Remaining Work — Ghost" section on a document.
// readOnly = true for the customer portal (no edit/convert controls).
export default function GhostSection({
  record,
  taxRate,
  taxAppliesTo,
  readOnly = false,
  onNotesChange,
  onEditGhost,
  onConvert,
  onViewConverted,
}) {
  const items = record.ghost_items || [];
  const totals = calcGhostTotals(items, taxRate, taxAppliesTo);
  const status = record.ghost_status || "none";
  const converted = status === "converted";
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState(record.ghost_notes || "");
  const [converting, setConverting] = useState(null);

  useEffect(() => { setNote(record.ghost_notes || ""); }, [record.ghost_notes]);

  const handleConvert = async (targetType) => {
    setConverting(targetType);
    try { await onConvert?.(targetType); } finally { setConverting(null); }
  };

  return (
    <div
      className={`mt-6 rounded-xl border border-dashed p-5 ${converted ? "border-gray-700 bg-gray-900/30 opacity-70" : "border-sky-500/40 bg-gray-900/40"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Ghost className="w-5 h-5 text-sky-400" />
          <h3 className="font-bold text-white">Remaining Work — Ghost</h3>
          {converted ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ghost Converted
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
              PENDING — Not Yet Invoiced
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No remaining items.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800/60">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-center">Type</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {items.map((it, i) => (
                <tr key={i} className="bg-gray-900/30">
                  <td className="px-3 py-2 text-white">
                    {it.name || it.description || "—"}
                    {it.description && it.name && <div className="text-xs text-gray-500">{it.description}</div>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${it.type === "labor" ? "bg-sky-500/20 text-sky-300" : "bg-amber-500/20 text-amber-300"}`}>
                      {it.type === "labor" ? "Labor" : "Part"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-300">{it.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-300">${(Number(it.unit_price) || 0).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right font-medium text-white tabular-nums">${lineTotal(it).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="mt-3 ml-auto w-full sm:w-64 text-sm space-y-1">
        <div className="flex justify-between text-gray-300"><span>Subtotal</span><span>${totals.subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-300"><span>Tax</span><span>${totals.tax.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-white border-t border-gray-700 pt-1"><span>Remaining Total</span><span>${totals.total.toFixed(2)}</span></div>
      </div>

      {/* What's Next note */}
      <div className="mt-4 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-400 mb-1">What's Next</div>
        {readOnly ? (
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{record.ghost_notes || ""}</p>
        ) : (
          <>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => { if (note !== (record.ghost_notes || "")) onNotesChange?.(note); }}
              rows={3}
              className="bg-gray-950 border-gray-700 text-white text-sm"
              placeholder="Auto-generated explanation — edit as needed."
            />
            {converted && (
              <p className="text-xs text-gray-500 mt-1">Note: this ghost has been converted.</p>
            )}
          </>
        )}
      </div>

      {/* Actions (shop only) */}
      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!converted && (
            <>
              <Button variant="outline" onClick={() => setEditOpen(true)} className="gap-2 border-gray-700 text-gray-300 hover:text-white">
                <Pencil className="w-4 h-4" /> Edit Ghost
              </Button>
              <Button onClick={() => handleConvert("Invoice")} disabled={!!converting} className="gap-2 bg-purple-600 hover:bg-purple-700">
                {converting === "Invoice" ? "Converting…" : <><FileText className="w-4 h-4" /> Convert to Invoice</>}
              </Button>
              <Button variant="outline" onClick={() => handleConvert("RepairOrder")} disabled={!!converting} className="gap-2 border-gray-700 text-gray-300 hover:text-white">
                {converting === "RepairOrder" ? "Converting…" : <><Wrench className="w-4 h-4" /> Convert to RO</>}
              </Button>
            </>
          )}
          {converted && record.ghost_converted_to && (
            <Button variant="outline" onClick={onViewConverted} className="gap-2 border-gray-700 text-gray-300 hover:text-white">
              <ExternalLink className="w-4 h-4" /> View {record.ghost_converted_type} {record.ghost_converted_number || ""}
            </Button>
          )}
        </div>
      )}

      {/* Portal hint */}
      {readOnly && !converted && (
        <p className="mt-3 text-xs text-amber-300/80">
          Pending — schedule your next visit to complete this work.
        </p>
      )}

      {!readOnly && !converted && (
        <GhostEditorDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          items={items}
          taxRate={taxRate}
          taxAppliesTo={taxAppliesTo}
          notes={note}
          onSave={(newItems, newNotes) => {
            onEditGhost?.(newItems, newNotes);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}