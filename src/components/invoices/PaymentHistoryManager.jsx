import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Trash2, Pencil, Check, X, AlertTriangle, Loader2, History } from "lucide-react";

/**
 * PaymentHistoryManager
 * Opens from InvoiceDetail — shows all payment_history entries,
 * lets you edit amount/method/note or delete entries,
 * then recalculates amount_paid + status + balance_due and saves.
 */
export default function PaymentHistoryManager({ open, onClose, invoice, onSaved }) {
  const [entries, setEntries] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editBuf, setEditBuf] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load fresh when opened
  React.useEffect(() => {
    if (open && invoice) {
      setEntries((invoice.payment_history || []).map((e, i) => ({ ...e, _key: i })));
      setEditingIdx(null);
      setDirty(false);
    }
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const grandTotal = invoice.total || invoice.grand_total || 0;

  // Recalculate totals from current entries
  const totalPaid   = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const balanceDue  = Math.max(0, grandTotal - totalPaid);
  const newStatus   = balanceDue <= 0.01 ? "paid" : totalPaid > 0 ? "partial" : "unpaid";

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditBuf({ ...entries[idx] });
  };

  const cancelEdit = () => { setEditingIdx(null); setEditBuf({}); };

  const confirmEdit = () => {
    const amount = Number(editBuf.amount);
    if (!amount || amount <= 0) return alert("Amount must be greater than $0");
    setEntries(prev => prev.map((e, i) => i === editingIdx ? { ...editBuf, amount } : e));
    setEditingIdx(null);
    setEditBuf({});
    setDirty(true);
  };

  const deleteEntry = (idx) => {
    if (!window.confirm("Remove this payment entry? This will recalculate the invoice balance.")) return;
    setEntries(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const combinedMethod = [...new Set(entries.map(e => e.method).filter(Boolean))].join("+") || "cash";
      const patch = {
        payment_history: entries.map(({ _key, ...e }) => e), // strip internal _key
        amount_paid:     totalPaid,
        balance_due:     balanceDue,
        status:          newStatus,
        payment_method:  combinedMethod,
        paid_date:       newStatus === "paid" ? (invoice.paid_date || new Date().toISOString().split("T")[0]) : null,
      };
      await base44.entities.Invoice.update(invoice.id, patch);
      onSaved?.();
      onClose();
    } catch(e) {
      alert("Save failed: " + (e?.message || e));
    } finally {
      setSaving(false);
    }
  };

  const METHOD_LABELS = { card: "Card", cash: "Cash", e_transfer: "E-Transfer", cheque: "Cheque", financing: "Financing", other: "Other" };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="bg-gray-900 border-gray-800 text-white max-w-lg"
        onInteractOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-sky-400" />
            Payment History — {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex gap-4 text-xs px-1 py-2 rounded-lg bg-gray-800/60 border border-gray-700 mb-1">
          <span className="text-gray-400">Invoice Total <strong className="text-sky-400">${grandTotal.toFixed(2)}</strong></span>
          <span className="text-gray-400">Paid <strong className="text-emerald-400">${totalPaid.toFixed(2)}</strong></span>
          <span className="text-gray-400">Balance <strong className={balanceDue > 0 ? "text-yellow-400" : "text-emerald-400"}>${balanceDue.toFixed(2)}</strong></span>
          <span className="ml-auto">
            <span style={{
              background: newStatus === "paid" ? "rgba(74,222,128,0.15)" : newStatus === "partial" ? "rgba(251,191,36,0.15)" : "rgba(148,163,184,0.1)",
              border: `1px solid ${newStatus === "paid" ? "rgba(74,222,128,0.4)" : newStatus === "partial" ? "rgba(251,191,36,0.4)" : "rgba(148,163,184,0.2)"}`,
              color: newStatus === "paid" ? "#4ade80" : newStatus === "partial" ? "#fbbf24" : "#94a3b8",
              borderRadius: "20px", padding: "2px 10px", fontSize: "11px", fontWeight: 700, textTransform: "capitalize",
            }}>{newStatus}</span>
          </span>
        </div>

        {/* Payment entries */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {entries.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No payment entries — this invoice has no recorded payments.
            </div>
          )}

          {entries.map((entry, idx) => (
            <div key={entry._key ?? idx}
              className="rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2">
              {editingIdx === idx ? (
                /* ── Edit mode ── */
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Amount ($)</label>
                      <Input
                        type="number" min="0.01" step="0.01"
                        value={editBuf.amount}
                        onChange={e => setEditBuf(b => ({ ...b, amount: e.target.value }))}
                        className="bg-gray-700 border-gray-600 text-white h-8 text-sm"
                        onFocus={e => e.target.select()}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Method</label>
                      <Select value={editBuf.method} onValueChange={v => setEditBuf(b => ({ ...b, method: v }))}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {Object.entries(METHOD_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Note</label>
                    <Input
                      value={editBuf.note || ""}
                      onChange={e => setEditBuf(b => ({ ...b, note: e.target.value }))}
                      className="bg-gray-700 border-gray-600 text-white h-8 text-sm"
                      placeholder="Receipt #, cashier, card info..."
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button size="sm" variant="outline" onClick={cancelEdit}
                      className="border-gray-600 text-gray-300 h-7 text-xs px-3 gap-1">
                      <X className="w-3 h-3" /> Cancel
                    </Button>
                    <Button size="sm" onClick={confirmEdit}
                      className="bg-sky-500 hover:bg-sky-600 h-7 text-xs px-3 gap-1">
                      <Check className="w-3 h-3" /> Confirm
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── View mode ── */
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-emerald-400">${Number(entry.amount || 0).toFixed(2)}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 capitalize">
                        {METHOD_LABELS[entry.method] || entry.method || "—"}
                      </span>
                      {entry.date && <span className="text-xs text-gray-500">{entry.date}</span>}
                    </div>
                    {entry.note && <p className="text-xs text-gray-500 truncate mt-0.5">{entry.note}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost"
                      className="h-7 w-7 text-gray-500 hover:text-sky-400"
                      onClick={() => startEdit(idx)} title="Edit this payment">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost"
                      className="h-7 w-7 text-gray-500 hover:text-rose-400"
                      onClick={() => deleteEntry(idx)} title="Remove this payment">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        {dirty && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Unsaved changes — save below to update the invoice analytics.
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose}
            className="flex-1 border-gray-700 text-gray-300 h-9">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty}
            className="flex-1 bg-sky-500 hover:bg-sky-600 h-9 font-semibold gap-2"
            style={dirty ? {} : { opacity: 0.5 }}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save & Recalculate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
