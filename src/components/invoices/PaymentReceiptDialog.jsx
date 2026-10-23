import React, { useEffect, useRef, useState } from "react";
import { resolvePaymentInvoiceId, paymentDialogState } from "@/lib/paymentTarget";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";

export default function PaymentReceiptDialog({ open, onClose, invoice, onSaved, entityName = "Invoice", source }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Authoritative saved invoice loaded from the server (null = none saved yet).
  const [saved, setSaved] = useState(undefined);
  // Reused across retries of the same payment so a replay after an uncertain failure is deduplicated.
  const keyRef = useRef("");

  const descriptor = invoice ? (source || { type: entityName === "Estimate" ? "estimate" : entityName === "RepairOrder" ? "repair_order" : "invoice", id: invoice.id }) : null;
  const requestedId = invoice ? resolvePaymentInvoiceId({ invoice, entityName }) : "";

  useEffect(() => {
    if (!open || !descriptor) return;
    let live = true;
    setSaved(undefined);
    setError("");
    base44.functions.invoke("financialDocumentAction", { action: "load", source_type: descriptor.type, source_id: descriptor.id, ...(requestedId ? { invoice_id: requestedId } : {}) })
      .then((res) => { if (live) setSaved(res.data?.invoice || null); })
      .catch((e) => { if (live) { setSaved(null); setError(e?.response?.data?.error || e.message || "Could not load the saved invoice"); } });
    return () => { live = false; };
  }, [open, descriptor?.type, descriptor?.id, requestedId]);

  if (!invoice) return null;

  const view = paymentDialogState({ saved, fallback: invoice, loadError: !!error && saved === null });

  const save = async () => {
    const value = parseFloat(amount);
    if (isNaN(value) || value <= 0) { setError("Enter a valid payment amount."); return; }
    if (value > view.balance + 0.01) { setError("Payment cannot exceed the balance due."); return; }
    setSaving(true);
    setError("");
    try {
      if (!keyRef.current) keyRef.current = crypto.randomUUID();
      const key = keyRef.current;
      let invoiceId = saved?.id || "";
      if (!invoiceId) {
        const created = await base44.functions.invoke("financialDocumentAction", { action: "create", source_type: descriptor.type, source_id: descriptor.id, idempotency_key: key, intent: {} });
        invoiceId = created.data.invoice.id;
        setSaved(created.data.invoice);
      }
      await base44.functions.invoke("financialDocumentAction", { action: "record_payment", source_type: descriptor.type, source_id: descriptor.id, invoice_id: invoiceId, idempotency_key: `${key}-payment`, intent: { payments: [{ amount: value, method, note }] } });
      keyRef.current = "";
      await onSaved?.();
    } catch (e) {
      setError(e?.response?.data?.error || e.message || "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent className="max-w-md border-gray-800 bg-gray-950 text-white" onInteractOutside={e => e.preventDefault()} onEscapeKeyDown={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm">
          <div className="flex justify-between text-gray-400"><span>Invoice</span><span className="text-white">{view.label}</span></div>
          <div className="mt-2 flex justify-between text-gray-400"><span>Balance due</span><b className={view.paidInFull ? "text-emerald-400" : "text-amber-400"}>{view.loading ? "Loading…" : `$${view.balance.toFixed(2)}`}</b></div>
          {view.paidInFull && <p className="mt-2 text-xs text-emerald-400">This invoice is paid in full. No further payment can be recorded.</p>}
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Amount</label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={!view.canPay} className="bg-gray-900 text-white" placeholder="0.00" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} disabled={!view.canPay} className="h-9 w-full rounded-md border border-gray-700 bg-gray-900 px-3 text-white">
              <option value="card">Credit / Debit Card</option>
              <option value="cash">Cash</option>
              <option value="e-transfer">E-Transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Receipt note</label>
            <Input value={note} onChange={e => setNote(e.target.value)} disabled={!view.canPay} className="bg-gray-900 text-white" />
          </div>
          {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700">{view.paidInFull ? "Close" : "Cancel"}</Button>
          <Button onClick={save} disabled={saving || !view.canPay} className="flex-1 bg-emerald-600">{saving ? "Recording…" : "Record Payment"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}