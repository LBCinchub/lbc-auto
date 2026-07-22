import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { CreditCard, Receipt } from "lucide-react";
import { invoiceFieldsFromRepairOrder, resolveVehicleId } from "@/utils/recordLinking";

export default function PaymentReceiptDialog({ open, onClose, invoice, onSaved, entityName = "Invoice" }) {
  const [payments, setPayments] = useState([]); // Array of individual payment entries
  const [currentPayment, setCurrentPayment] = useState({
    amount: "",
    payment_method: "card",
    card_last4: "",
  });
  const [receiptNumber, setReceiptNumber] = useState("");
  const [cashierCode, setCashierCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Reset form whenever a new invoice is opened
  React.useEffect(() => {
    if (open) {
      setPayments([]);
      setCurrentPayment({ amount: "", payment_method: "card", card_last4: "" });
      setReceiptNumber("");
      setCashierCode("");
      setSaveError("");
    }
  }, [open, invoice?.id]);

  const addPaymentEntry = () => {
    const amount = Number(currentPayment.amount);
    if (!amount || amount <= 0) return alert("Please enter a valid payment amount.");
    // Bug 9: Prevent overpayment
    const remainingBalance = Math.max(0, balanceDue - totalFromPayments);
    if (amount > remainingBalance + 0.01) {
      alert(`Payment $${amount.toFixed(2)} exceeds remaining balance $${remainingBalance.toFixed(2)}. Please check the amount.`);
      return;
    }
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

    // BUG 2: Block cash-out if any parts_item has unit_price = 0 and quantity > 0
    if (entityName === "Estimate" && invoice.parts_items) {
      const zeroPriceParts = invoice.parts_items.filter(p => 
        (parseFloat(p.unit_price) || 0) === 0 && (parseFloat(p.quantity) || 0) > 0
      );
      if (zeroPriceParts.length > 0) {
        const names = zeroPriceParts.map(p => p.name || "Unknown Part").join(", ");
        return alert(`Cannot cash out — ${names} has a $0 price. Please update all part prices first.`);
      }
    }

    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    // Bug 4: Calculate totalPaid from payment_history to avoid drift between amount_paid and history
    const existingHistoryTotal = (invoice.payment_history || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const newAmountPaid = Math.round((existingHistoryTotal + totalFromPayments) * 100) / 100;
    const newBalance = Math.round(((invoice.total || 0) - newAmountPaid) * 100) / 100;
    // BUG 22: if paid, balance_due must be exactly 0. BUG 23: if balance is 0, status must be "paid"
    const newStatus = newBalance <= 0.01 ? "paid" : "partial";
    const safeBalance = newStatus === "paid" ? 0 : Math.max(0, newBalance);

    // Build payment history entries
    const newPaymentHistory = payments.map(p => ({
      date: today,
      amount: p.amount,
      method: p.payment_method,
      note: [
        p.card_last4 ? `Card ****${p.card_last4}` : "",
        receiptNumber ? `Receipt #${receiptNumber}` : "",
        cashierCode ? `Cashier: ${cashierCode}` : "",
      ].filter(Boolean).join(" · "),
    }));

    const existingMethods = (invoice.payment_history || []).map(p => p.method).filter(Boolean);
    const allNewMethods = payments.map(p => p.payment_method);
    const allMethods = [...new Set([...existingMethods, ...allNewMethods])];
    const combinedMethod = allMethods.length > 1 ? allMethods.join("+") : allMethods[0] || "cash";

    const paymentFields = {
      amount_paid: newAmountPaid,
      balance_due: safeBalance,
      status: newStatus,
      payment_method: combinedMethod,
      card_last4: payments.find(p => p.card_last4)?.card_last4 || invoice.card_last4 || undefined,
      paid_date: newStatus === "paid" ? today : undefined,
      payment_history: [...(invoice.payment_history || []), ...newPaymentHistory],
    };

    if (entityName === "RepairOrder") {
      try {
        const currentRO = await base44.entities.RepairOrder.get(invoice.id);
        if (!currentRO?.id) throw new Error("Repair Order no longer exists.");
        const { status: paymentStatus, ...roPaymentFields } = paymentFields;
        const savedRO = await base44.entities.RepairOrder.update(currentRO.id, { ...roPaymentFields, status: paymentStatus === "paid" ? "delivered" : currentRO.status });
        const vehicleId = await resolveVehicleId({ customerId: savedRO.customer_id, vehicleId: savedRO.vehicle_id, vehicleInfo: savedRO.vehicle_info });
        if (!vehicleId) throw new Error("No matching customer vehicle could be found.");
        const invoiceNum = savedRO.linked_invoice_number || `INV-RO-${savedRO.id.slice(-6).toUpperCase()}`;
        const invoiceData = { ...invoiceFieldsFromRepairOrder(savedRO, vehicleId, invoiceNum), ...paymentFields, tax_amount: savedRO.tax_amount || 0 };
        const linkedInvoice = savedRO.linked_invoice_id ? await base44.entities.Invoice.get(savedRO.linked_invoice_id).catch(() => null) : null;
        const savedInvoice = linkedInvoice
          ? await base44.entities.Invoice.update(linkedInvoice.id, invoiceData)
          : await base44.entities.Invoice.create(invoiceData);
        await base44.entities.RepairOrder.update(savedRO.id, {
          customer_id: savedRO.customer_id, customer_name: savedRO.customer_name || "", vehicle_id: vehicleId,
          vehicle_info: savedRO.vehicle_info || "", estimate_id: savedRO.estimate_id || "", order_number: savedRO.order_number,
          description: savedRO.description, status: newStatus === "paid" ? "delivered" : savedRO.status,
          labor_items: savedRO.labor_items || [], parts_used: savedRO.parts_used || [], labor_cost: Number(savedRO.labor_cost) || 0,
          parts_cost: Number(savedRO.parts_cost) || 0, total_cost: Number(savedRO.total_cost) || 0,
          notes: savedRO.notes || "", photos: savedRO.photos || [], linked_invoice_id: savedInvoice.id,
          linked_invoice_number: invoiceNum,
          history: [...(savedRO.history || []), { timestamp: new Date().toISOString(), user: cashierCode || "system", action: "payment_recorded", changes: { invoice_id: savedInvoice.id } }],
        });
      } catch (e) {
        setSaveError(e?.message || "Could not finish and link this Repair Order.");
        setSaving(false);
        return;
      }
    } else if (entityName === "Estimate") {
      // Auto-create or update a linked Invoice with full line items, mark estimate as invoiced
      const invoiceNum = invoice.linked_invoice_number || `INV-EST-${invoice.id.slice(-6).toUpperCase()}` || `INV-${Date.now().toString(36).toUpperCase().slice(-8)}`;
      let invId = invoice.linked_invoice_id;

      // ── Build line_items from estimate labor_items + parts_items (no data loss) ──
      const line_items = [
        ...(invoice.labor_items || []).map(item => ({
          description: item.description || 'Labour',
          quantity: Number(item.hours) || 1,
          unit_price: Number(item.rate) || 0,
          total: Math.round((Number(item.total) || 0) * 100) / 100,
          type: 'labor'
        })),
        ...(invoice.parts_items || []).map(item => ({
          description: item.name || item.description || 'Part',
          quantity: Number(item.quantity) || 1,
          unit_price: Number(item.unit_price) || 0,
          total: Math.round((Number(item.total) || 0) * 100) / 100,
          type: 'part'
        })),
      ];

      // Recalculate tax_amount and total with proper rounding to fix floating point errors
      const _laborTotal = Math.round((Number(invoice.labor_total || invoice.labor_cost || 0)) * 100) / 100;
      const _partsTotal = Math.round((Number(invoice.parts_total || invoice.parts_cost || 0)) * 100) / 100;
      const _subtotal = _laborTotal + _partsTotal;
      const _discount = Number(invoice.discount || 0);
      // BUG 1: Normalize discount_type — handles '$', 'fixed', '%', 'percent', null
      const _normDiscType = (!invoice.discount_type || invoice.discount_type === 'none' || invoice.discount_type === 'null') ? 'none'
        : (invoice.discount_type === '$' || invoice.discount_type === 'fixed') ? 'fixed'
        : (invoice.discount_type === '%' || invoice.discount_type === 'percent') ? 'percent'
        : 'none';
      const _discountType = _normDiscType === 'percent' ? '%' : _normDiscType === 'fixed' ? '$' : '$';
      const _discountAmount = _normDiscType === 'percent' ? Math.round((_subtotal * _discount / 100) * 100) / 100 : _normDiscType === 'fixed' ? Math.round(_discount * 100) / 100 : 0;
      const _taxRate = Number(invoice.tax_rate || 0);
      const _taxAppliesTo = invoice.tax_applies_to || "both";
      const _taxableBase = _taxAppliesTo === "labor" ? _laborTotal
        : _taxAppliesTo === "parts" ? _partsTotal
        : _taxAppliesTo === "none" ? 0
        : Math.max(0, _subtotal - _discountAmount);
      const _taxAmount = Math.round(_taxableBase * (_taxRate / 100) * 100) / 100;
      const _total = Math.round(Math.max(0, _subtotal - _discountAmount + _taxAmount) * 100) / 100;

      const estimateInvoiceFields = {
        invoice_number: invoiceNum,
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name || "",
        vehicle_info: invoice.vehicle_info || "",
        estimate_id: invoice.id,
        line_items,
        labor_total: _laborTotal,
        parts_total: _partsTotal,
        tax_rate: _taxRate,
        tax_amount: _taxAmount,
        tax_applies_to: _taxAppliesTo,
        discount: _discount,
        discount_type: _discountType,
        total: _total,
        service_reason: invoice.service_reason || "",
        customer_note: invoice.notes || "",
      };

      if (invId) {
        await base44.entities.Invoice.update(invId, {
          ...estimateInvoiceFields,
          ...paymentFields,
        });
      } else {
        const created = await base44.entities.Invoice.create({
          ...estimateInvoiceFields,
          ...paymentFields,
        });
        invId = created.id;
      }
      // Mark estimate as invoiced and record payment reference
      await base44.entities.Estimate.update(invoice.id, {
        status: "invoiced",
        amount_paid: newAmountPaid,
        linked_invoice_id: invId,
        linked_invoice_number: invoiceNum,
        payment_history: [...(invoice.payment_history || []), ...newPaymentHistory],
      });
    } else {
      // Standard Invoice update
      await base44.entities.Invoice.update(invoice.id, paymentFields);
    }

    // Bug 2: Update customer visit stats on payment
    try {
      if (invoice.customer_id) {
        const cust = await base44.entities.Customer.get(invoice.customer_id);
        if (cust) {
          await base44.entities.Customer.update(cust.id, {
            total_visits: (cust.total_visits || 0) + 1,
            last_visit: today,
            last_vehicle_info: invoice.vehicle_info || cust.last_vehicle_info,
          });
        }
      }
    } catch (e) { console.warn("Customer visit update failed:", e); }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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
              <span className="text-gray-400">{entityName === "RepairOrder" ? "Order" : entityName === "Estimate" ? "Estimate" : "Invoice"}</span>
              <span className="text-white font-medium">{invoice.invoice_number || invoice.order_number || "—"}</span>
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

          {saveError && <p className="text-sm text-rose-400">Save failed: {saveError}</p>}
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