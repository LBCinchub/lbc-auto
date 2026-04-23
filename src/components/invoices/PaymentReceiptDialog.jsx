import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { CreditCard, Receipt } from "lucide-react";

export default function PaymentReceiptDialog({ open, onClose, invoice, onSaved }) {
  const [payments, setPayments] = useState([]); // Array of individual payment entries
  const [currentPayment, setCurrentPayment] = useState({
    amount: "",
    payment_method: "card",
    card_last4: "",
  });
  const [receiptNumber, setReceiptNumber] = useState("");
  const [cashierCode, setCashierCode] = useState("");
  const [saving, setSaving] = useState(false);

  // Reset form whenever a new invoice is opened
  React.useEffect(() => {
    if (open) {
      setPayments([]);
      setCurrentPayment({ amount: "", payment_method: "card", card_last4: "" });
      setReceiptNumber("");
      setCashierCode("");
    }
  }, [open, invoice?.id]);

  const addPaymentEntry = () => {
    const amount = Number(currentPayment.amount);
    if (!amount || amount <= 0) return alert("Please enter a valid payment amount.");
    setPayments([...payments, { ...currentPayment, amount }]);
    setCurrentPayment({ amount: "", payment_method: "card", card_last4: "" });
  };

  const removePaymentEntry = (idx) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  if (!invoice) return null;

  // Compute live balance: total minus what's already been paid
  const balanceDue = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0));
  const totalFromPayments = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  const handleSave = async () => {
    if (payments.length === 0) return alert("Please add at least one payment entry.");

    setSaving(true);
    const newAmountPaid = (invoice.amount_paid || 0) + totalFromPayments;
    const newBalance = (invoice.total || 0) - newAmountPaid;
    const newStatus = newBalance <= 0 ? "paid" : "partial";

    // Create payment history entries for each payment
    const newPaymentHistory = payments.map(p => ({
      date: new Date().toISOString().split("T")[0],
      amount: p.amount,
      method: p.method,
      note: [
        p.card_last4 ? `Card ****${p.card_last4}` : "",
        receiptNumber ? `Receipt #${receiptNumber}` : "",
        cashierCode ? `Cashier: ${cashierCode}` : "",
      ].filter(Boolean).join(" · "),
    }));

    // Determine combined payment method label
    const existingMethods = (invoice.payment_history || []).map(p => p.method).filter(Boolean);
    const allNewMethods = payments.map(p => p.method);
    const allMethods = [...new Set([...existingMethods, ...allNewMethods])];
    const combinedMethod = allMethods.length > 1 ? allMethods.join("+") : allMethods[0] || "cash";

    await base44.entities.Invoice.update(invoice.id, {
      amount_paid: newAmountPaid,
      balance_due: Math.max(0, newBalance),
      status: newStatus,
      payment_method: combinedMethod,
      card_last4: payments.find(p => p.card_last4)?.card_last4 || invoice.card_last4 || undefined,
      paid_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : undefined,
      payment_history: [...(invoice.payment_history || []), ...newPaymentHistory],
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
            {totalFromPayments > 0 && (
              <div className="flex justify-between border-t border-gray-700/50 pt-1 mt-1">
                <span className="text-gray-400">Total Adding</span>
                <span className="text-emerald-400 font-bold">${totalFromPayments.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Add individual payment entries */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Payment Entry</p>

            <div>
              <Label className="text-gray-400">Amount ($)</Label>
              <Input type="number" step="0.01" value={currentPayment.amount}
                onChange={e => setCurrentPayment({ ...currentPayment, amount: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="e.g. 20.00" />
            </div>

            <div>
              <Label className="text-gray-400">Payment Method</Label>
              <Select value={currentPayment.payment_method} onValueChange={v => setCurrentPayment({ ...currentPayment, payment_method: v })}>
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

            {currentPayment.payment_method === "card" && (
              <div>
                <Label className="text-gray-400 flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Last 4 Digits</Label>
                <Input value={currentPayment.card_last4} onChange={e => setCurrentPayment({ ...currentPayment, card_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="e.g. 4242" maxLength={4} />
              </div>
            )}

            <button onClick={addPaymentEntry} className="w-full py-2 px-3 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 rounded-md text-sky-400 text-sm font-medium transition-colors">
              + Add This Payment
            </button>
          </div>

          {/* Show added payments */}
          {payments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Payments Added</p>
              {payments.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="text-sm">
                    <p className="text-white font-medium">${p.amount.toFixed(2)} — {p.payment_method === "card" ? `Card ****${p.card_last4}` : p.payment_method.toUpperCase()}</p>
                  </div>
                  <button onClick={() => removePaymentEntry(idx)} className="text-rose-400 hover:text-rose-300 text-sm font-medium">Remove</button>
                </div>
              ))}
            </div>
          )}

          {/* Receipt info (applies to all payments) */}
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receipt Info (Optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Receipt #</Label>
                <Input value={receiptNumber} onChange={e => setReceiptNumber(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. 00123" />
              </div>
              <div>
                <Label className="text-gray-400">Cashier Code</Label>
                <Input value={cashierCode} onChange={e => setCashierCode(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. C01" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || payments.length === 0}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saving ? "Saving..." : `Record ${payments.length > 0 ? payments.length : ""} Payment${payments.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}