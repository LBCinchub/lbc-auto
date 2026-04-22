import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { CreditCard, Receipt } from "lucide-react";

export default function PaymentReceiptDialog({ open, onClose, invoice, onSaved }) {
  const [form, setForm] = useState({
    amount: "",
    payment_method: "card",
    card_last4: "",
    receipt_number: "",
    cashier_code: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  // Reset form whenever a new invoice is opened
  React.useEffect(() => {
    if (open) {
      setForm({ amount: "", payment_method: "card", card_last4: "", receipt_number: "", cashier_code: "", note: "" });
    }
  }, [open, invoice?.id]);

  if (!invoice) return null;

  // Compute live balance: total minus what's already been paid
  const balanceDue = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0));

  const handleSave = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return alert("Please enter a valid payment amount.");

    setSaving(true);
    const paymentEntry = {
      date: new Date().toISOString().split("T")[0],
      amount,
      method: form.payment_method,
      note: [
        form.card_last4 ? `Card ****${form.card_last4}` : "",
        form.receipt_number ? `Receipt #${form.receipt_number}` : "",
        form.cashier_code ? `Cashier: ${form.cashier_code}` : "",
        form.note,
      ].filter(Boolean).join(" · "),
    };

    const newAmountPaid = (invoice.amount_paid || 0) + amount;
    const newBalance = (invoice.total || 0) - newAmountPaid;
    const newStatus = newBalance <= 0 ? "paid" : "partial";

    // Determine combined payment method label for the invoice
    const existingMethods = (invoice.payment_history || []).map(p => p.method).filter(Boolean);
    const allMethods = [...new Set([...existingMethods, form.payment_method])];
    const combinedMethod = allMethods.length > 1 ? allMethods.join("+") : allMethods[0] || form.payment_method;

    await base44.entities.Invoice.update(invoice.id, {
      amount_paid: newAmountPaid,
      balance_due: Math.max(0, newBalance),
      status: newStatus,
      payment_method: combinedMethod,
      card_last4: form.card_last4 || invoice.card_last4 || undefined,
      paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : undefined,
      payment_history: [...(invoice.payment_history || []), paymentEntry],
    });

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-sky-400" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Invoice summary */}
          <div className="rounded-lg bg-gray-800/60 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400">Invoice</span>
              <span className="text-white font-medium">{invoice.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Customer</span>
              <span className="text-white">{invoice.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Balance Due</span>
              <span className="text-yellow-400 font-bold">${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Payment Amount ($)</Label>
            <Input type="number" step="0.01" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder={`Max: $${balanceDue.toFixed(2)}`} />
          </div>

          <div>
            <Label className="text-gray-400">Payment Method</Label>
            <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="card">Credit / Debit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="e-transfer">E-Transfer</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.payment_method === "card" && (
            <div>
              <Label className="text-gray-400 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Last 4 Digits</Label>
              <Input value={form.card_last4} onChange={e => setForm({ ...form, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="e.g. 4242" maxLength={4} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Receipt #</Label>
              <Input value={form.receipt_number} onChange={e => setForm({ ...form, receipt_number: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. 00123" />
            </div>
            <div>
              <Label className="text-gray-400">Cashier Code</Label>
              <Input value={form.cashier_code} onChange={e => setForm({ ...form, cashier_code: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. C01" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Note (optional)</Label>
            <Input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Any additional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.amount}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saving ? "Saving..." : "Record Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}