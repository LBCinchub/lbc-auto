import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";

export default function InvoiceFormDialog({ open, onClose, invoice, orders, customers, onSaved, initialOrderId, sourceEstimate }) {
  const [form, setForm] = useState({
    repair_order_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "",
    parts_total: 0, labor_total: 0, tax_rate: 15, status: "unpaid",
    due_date: "", payment_method: "", amount_paid: 0, payment_history: [],
    receipt_number: "", card_last4: "", cashier_name: "", parts_used: [], customer_note: "",
    discount_type: "none", discount_value: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setForm({
        repair_order_id: invoice.repair_order_id || "",
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name || "",
        customer_phone: invoice.customer_phone || "",
        vehicle_info: invoice.vehicle_info || "",
        parts_total: invoice.parts_total || 0,
        labor_total: invoice.labor_total || 0,
        tax_rate: invoice.tax_rate ?? 15,
        status: invoice.status || "unpaid",
        due_date: invoice.due_date || "",
        payment_method: invoice.payment_method || "",
        amount_paid: invoice.amount_paid || 0,
        payment_history: invoice.payment_history || [],
        receipt_number: invoice.receipt_number || "",
        card_last4: invoice.card_last4 || "",
        cashier_name: invoice.cashier_name || "",
        parts_used: invoice.parts_used || [],
        customer_note: invoice.customer_note || "",
        discount_type: invoice.discount_type || "none",
        discount_value: invoice.discount_value || 0,
      });
    } else {
      setForm({
        repair_order_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "",
        parts_total: 0, labor_total: 0, tax_rate: 15, status: "unpaid",
        due_date: "", payment_method: "", amount_paid: 0, payment_history: [],
        receipt_number: "", card_last4: "", cashier_name: "", parts_used: [], customer_note: "",
        discount_type: "none", discount_value: 0
      });
    }
    // Auto-select order if opened from RepairOrders
    if (!invoice && initialOrderId) {
      const order = orders.find(o => o.id === initialOrderId);
      if (order) {
        setForm(f => ({
          ...f,
          repair_order_id: order.id,
          customer_id: order.customer_id,
          customer_name: order.customer_name,
          vehicle_info: order.vehicle_info,
          parts_total: order.parts_cost || 0,
          labor_total: order.labor_cost || 0,
        }));
      }
    }
    // Auto-populate from estimate
    if (!invoice && sourceEstimate) {
      setForm(f => ({
        ...f,
        estimate_id: sourceEstimate.id,
        customer_id: sourceEstimate.customer_id,
        customer_name: sourceEstimate.customer_name,
        vehicle_info: sourceEstimate.vehicle_info,
        parts_total: sourceEstimate.parts_total || 0,
        labor_total: sourceEstimate.labor_total || 0,
        parts_used: sourceEstimate.parts_items?.map(p => ({
          name: p.name,
          quantity: p.quantity,
          unit_price: p.unit_price,
          total: p.total,
        })) || [],
        customer_note: sourceEstimate.notes || "",
      }));
    }
  }, [invoice, open, initialOrderId, sourceEstimate]);

  const handleOrderSelect = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      let customerPhone = "";
      let description = "";
      try {
        const customer = await base44.entities.Customer.get(order.customer_id);
        customerPhone = customer.phone || "";
        const fullOrder = await base44.entities.RepairOrder.get(orderId);
        description = fullOrder.description || "";
      } catch (error) {
        console.error("Error fetching data:", error);
      }
      setForm({
        ...form,
        repair_order_id: orderId,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        customer_phone: customerPhone,
        vehicle_info: order.vehicle_info,
        parts_total: order.parts_cost || 0,
        labor_total: order.labor_cost || (order.labor_hours ? order.labor_hours * 120 : 0),
        parts_used: order.parts_used || [],
        customer_note: description,
      });
    }
  };

  const subtotal = (form.parts_total || 0) + (form.labor_total || 0);
  const discountAmount = form.discount_type === "percentage" 
    ? subtotal * ((form.discount_value || 0) / 100)
    : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const isCash = form.payment_method === "cash";
  const taxAmount = isCash ? 0 : (form.labor_total || 0) * ((form.tax_rate || 0) / 100);
  const total = subtotalAfterDiscount + taxAmount;
  const balanceDue = total - (form.amount_paid || 0);

  const handleSave = async () => {
   setSaving(true);
   const lineItems = [];
   if (form.labor_total > 0) lineItems.push({ description: "Labor", type: "labor", quantity: 1, unit_price: form.labor_total, total: form.labor_total });
   // Add individual parts as line items
   if (form.parts_used && form.parts_used.length > 0) {
     form.parts_used.forEach(p => {
       lineItems.push({ description: p.name, type: "part", quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0 });
     });
   } else if (form.parts_total > 0) {
     lineItems.push({ description: "Parts", type: "parts", quantity: 1, unit_price: form.parts_total, total: form.parts_total });
   }

   let finalStatus = form.status;
   let paidDate = invoice?.paid_date;
   if (balanceDue <= 0) {
     finalStatus = "paid";
     // Set paid_date to today if transitioning to paid status
     if (invoice?.status !== "paid") {
       paidDate = new Date().toISOString().substring(0, 10);
     }
   } else if (form.amount_paid > 0) {
     finalStatus = "partial";
   }

   // Auto-detect overdue
   if (finalStatus !== "paid" && form.due_date) {
     const today = new Date().toISOString().split("T")[0];
     if (form.due_date < today) finalStatus = "overdue";
   }

   const data = {
     ...form,
     invoice_number: invoice?.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`,
     customer_phone: form.customer_phone || "",
     parts_used: form.parts_used || [],
     tax_amount: taxAmount,
     total,
     balance_due: balanceDue,
     status: finalStatus,
     paid_date: paidDate,
     line_items: lineItems,
     estimate_id: form.estimate_id || sourceEstimate?.id || "",
   };

   if (invoice) {
     await base44.entities.Invoice.update(invoice.id, data);
   } else {
     await base44.entities.Invoice.create(data);
   }
   setSaving(false);
   onSaved();
   onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {invoice ? "Edit Invoice" : sourceEstimate ? `Invoice from Estimate #${sourceEstimate.estimate_number}` : "Create Invoice"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2 overflow-y-auto flex-1">
          {!sourceEstimate && (
            <div>
              <Label className="text-gray-400">Repair Order</Label>
              <Select value={form.repair_order_id} onValueChange={handleOrderSelect}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Link to repair order" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number} - {o.customer_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {sourceEstimate && (
            <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-3 text-sm">
              <p className="text-sky-400 font-medium text-xs uppercase tracking-wider mb-1">Source: Estimate</p>
              <p className="text-white">{sourceEstimate.estimate_number} — {sourceEstimate.customer_name}</p>
              <p className="text-gray-400 text-xs">{sourceEstimate.vehicle_info}</p>
            </div>
          )}

          {form.customer_name && (
            <div className="rounded-lg bg-gray-800/50 p-3 text-sm">
              <p className="text-white">{form.customer_name}</p>
              <p className="text-gray-500 text-xs">{form.vehicle_info}</p>
            </div>
          )}

          {form.parts_used && form.parts_used.length > 0 && (
            <div className="rounded-lg border border-gray-700/50 p-3 space-y-2">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Parts Used</p>
              <div className="space-y-1">
                {form.parts_used.map((p, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-300">{p.name} <span className="text-gray-500">x{p.quantity}</span></span>
                    <span className="text-white">${(p.total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Parts Total</Label>
              <Input type="number" step="0.01" value={form.parts_total}
                onChange={e => setForm({...form, parts_total: Number(e.target.value)})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Labor Total</Label>
              <Input type="number" step="0.01" value={form.labor_total}
                onChange={e => setForm({...form, labor_total: Number(e.target.value)})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Tax Rate (%)</Label>
              <Input type="number" step="0.1" value={form.tax_rate}
                onChange={e => setForm({...form, tax_rate: Number(e.target.value)})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Due Date</Label>
              <Input type="date" value={form.due_date}
                onChange={e => setForm({...form, due_date: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-gray-400 text-sm">Discount Type</Label>
              <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v, discount_value: 0})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discount_type !== "none" && (
              <div className="col-span-2">
                <Label className="text-gray-400 text-sm">Discount {form.discount_type === "percentage" ? "(%)" : "($)"}</Label>
                <Input type="number" step="0.01" value={form.discount_value}
                  onChange={e => setForm({...form, discount_value: Number(e.target.value)})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            )}
          </div>

          {/* Payment Method & Receipt Info Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Payment Method */}
              <div>
                <Label className="text-gray-400 text-sm">Payment Method</Label>
                <div className="flex flex-col gap-2 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" value="cash" checked={form.payment_method === "cash"}
                      onChange={e => setForm({...form, payment_method: e.target.value, card_last4: ""})}
                      className="w-4 h-4" />
                    <span className="text-sm text-gray-300">Cash</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" value="card" checked={form.payment_method === "card"}
                      onChange={e => setForm({...form, payment_method: e.target.value})}
                      className="w-4 h-4" />
                    <span className="text-sm text-gray-300">Card</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" value="e-transfer" checked={form.payment_method === "e-transfer"}
                      onChange={e => setForm({...form, payment_method: e.target.value, card_last4: ""})}
                      className="w-4 h-4" />
                    <span className="text-sm text-gray-300">E-Transfer</span>
                  </label>
                </div>
              </div>

            {/* Receipt Info */}
            <div className="rounded-lg border border-gray-700/50 p-3 space-y-3">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Receipt Info</p>
              <div className="space-y-2">
                {form.payment_method === "card" && (
                  <div>
                    <Label className="text-gray-400 text-xs">Card Last 4</Label>
                    <Input value={form.card_last4} onChange={e => setForm({...form, card_last4: e.target.value.slice(0,4)})}
                      className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. 4242" maxLength={4} />
                  </div>
                )}
                <div>
                  <Label className="text-gray-400 text-xs">Receipt #</Label>
                  <Input value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="e.g. 001234" />
                </div>
                <div>
                  <Label className="text-gray-400 text-xs">Cashier</Label>
                  <Input value={form.cashier_name} onChange={e => setForm({...form, cashier_name: e.target.value})}
                    className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Name or #" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Upfront Payment (Cash)</Label>
            <Input type="number" step="0.01" value={form.amount_paid}
              onChange={e => setForm({...form, amount_paid: Number(e.target.value)})}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="0.00" />
          </div>

          <div className="rounded-lg bg-gray-800/50 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-white">${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Discount {form.discount_type === "percentage" ? `(${form.discount_value}%)` : ""}</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Tax on Labor ({isCash ? "Cash - No Tax" : `${form.tax_rate}%`})</span>
              <span className="text-white">${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2">
              <span className="text-white">Total</span>
              <span className="text-sky-400">${total.toFixed(2)}</span>
            </div>
            {form.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-400">
                  <span>Paid Upfront</span>
                  <span>-${form.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-2">
                  <span className="text-white">Balance Due</span>
                  <span className={balanceDue <= 0 ? "text-green-400" : "text-yellow-400"}>
                    ${balanceDue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div>
            <Label className="text-gray-400">Note for Customer</Label>
            <Textarea value={form.customer_note || ""}
              onChange={e => setForm({...form, customer_note: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1"
              placeholder="e.g. Please come back for a follow-up check in 1 month..."
              rows={2} />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.customer_id}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}