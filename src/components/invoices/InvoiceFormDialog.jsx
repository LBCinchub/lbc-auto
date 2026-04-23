import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, Store } from "lucide-react";
import { TAX_RATE } from "@/lib/constants";

export default function InvoiceFormDialog({ open, onClose, invoice, orders, customers, onSaved, initialOrderId, sourceEstimate }) {
  const [form, setForm] = useState({
    repair_order_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "",
    parts_total: 0, labor_total: 0, tax_rate: TAX_RATE, apply_tax_parts: true, apply_tax_labor: true, status: "unpaid",
    due_date: "", payment_method: "", amount_paid: 0, payment_history: [],
    receipt_number: "", card_last4: "", cashier_name: "", parts_used: [], customer_note: "",
    discount_type: "none", discount_value: 0
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return; // Only populate when dialog opens

    if (invoice && invoice.id) {
      // Editing existing invoice
      setForm({
        repair_order_id: invoice.repair_order_id || "",
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name || "",
        customer_phone: invoice.customer_phone || "",
        vehicle_info: invoice.vehicle_info || "",
        parts_total: invoice.parts_total || 0,
        labor_total: invoice.labor_total || 0,
        tax_rate: TAX_RATE,
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
        apply_tax_parts: invoice.apply_tax_parts !== false,
        apply_tax_labor: invoice.apply_tax_labor !== false,
      });
    } else if (invoice && !invoice.id) {
      // New invoice pre-filled from customer profile (has customer_id but no id)
      setForm(f => ({
        ...f,
        customer_id: invoice.customer_id || "",
        customer_name: invoice.customer_name || "",
      }));
    } else if (sourceEstimate) {
      // Creating from estimate
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
    } else if (initialOrderId) {
      // Creating from repair order
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
          parts_used: order.parts_used || [],
        }));
      }
    } else {
      // New blank invoice
      setForm({
        repair_order_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "",
        parts_total: 0, labor_total: 0, tax_rate: TAX_RATE, apply_tax_parts: true, apply_tax_labor: true, status: "unpaid",
        due_date: "", payment_method: "", amount_paid: 0, payment_history: [],
        receipt_number: "", card_last4: "", cashier_name: "", parts_used: [], customer_note: "",
        discount_type: "none", discount_value: 0
      });
    }
  }, [open, invoice, initialOrderId, sourceEstimate, orders]);

  const handleOrderSelect = useCallback(async (orderId) => {
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
      setForm(prev => ({
        ...prev,
        repair_order_id: orderId,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        customer_phone: customerPhone,
        vehicle_info: order.vehicle_info,
        parts_total: order.parts_cost || 0,
        labor_total: order.labor_cost || (order.labor_hours ? order.labor_hours * 120 : 0),
        parts_used: order.parts_used || [],
        customer_note: description,
      }));
    }
  }, [orders]);

  const calculations = useMemo(() => {
    const subtotal = (form.parts_total || 0) + (form.labor_total || 0);
    const discountAmount = form.discount_type === "percentage" 
      ? subtotal * ((form.discount_value || 0) / 100)
      : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
    const subtotalAfterDiscount = subtotal - discountAmount;
    const isCash = form.payment_method === "cash";

    let taxableAmount = 0;
    if (form.apply_tax_labor) taxableAmount += form.labor_total || 0;
    if (form.apply_tax_parts) taxableAmount += form.parts_total || 0;

    const taxAmount = isCash ? 0 : taxableAmount * ((form.tax_rate || 0) / 100);
    const total = subtotalAfterDiscount + taxAmount;
    const balanceDue = total - (form.amount_paid || 0);
    return { subtotal, discountAmount, subtotalAfterDiscount, isCash, taxAmount, total, balanceDue };
  }, [form.parts_total, form.labor_total, form.discount_type, form.discount_value, form.payment_method, form.tax_rate, form.amount_paid, form.apply_tax_labor, form.apply_tax_parts]);

  const { subtotal, discountAmount, isCash, taxAmount, total, balanceDue } = calculations;

  const handleSave = async () => {
  setSaving(true);

  // If manual entry (no repair order, no existing customer_id), create Customer + Vehicle
  let resolvedCustomerId = form.customer_id;
  if (!form.repair_order_id && !form.customer_id && form.customer_name) {
    const newCustomer = await base44.entities.Customer.create({
      full_name: form.customer_name,
      phone: form.customer_phone || "",
    });
    resolvedCustomerId = newCustomer.id;

    // Parse vehicle info (e.g. "2020 Honda Civic") into year/make/model
    if (form.vehicle_info) {
      const parts = form.vehicle_info.trim().split(" ");
      const year = parseInt(parts[0]) || new Date().getFullYear();
      const make = parts[1] || "Unknown";
      const model = parts.slice(2).join(" ") || "Unknown";
      await base44.entities.Vehicle.create({
        customer_id: newCustomer.id,
        customer_name: form.customer_name,
        year,
        make,
        model,
      });
    }
  }

  const lineItems = [];
   if (form.labor_total > 0) lineItems.push({ description: "Labor", type: "labor", quantity: 1, unit_price: form.labor_total, total: form.labor_total });
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
     if (invoice?.status !== "paid") {
       paidDate = new Date().toISOString().substring(0, 10);
     }
   } else if (form.amount_paid > 0) {
     finalStatus = "partial";
   }

   if (finalStatus !== "paid" && form.due_date) {
     const today = new Date().toISOString().split("T")[0];
     if (form.due_date < today) finalStatus = "overdue";
   }

   const data = {
     ...form,
     customer_id: resolvedCustomerId,
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

   if (invoice && invoice.id) {
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
            <DialogTitle className="text-lg font-semibold">
              {invoice ? "Edit Invoice" : sourceEstimate ? `Invoice from Estimate #${sourceEstimate.estimate_number}` : "Create Invoice"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-4 overflow-y-auto flex-1">
          {!sourceEstimate && (
            <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
              <Label className="text-gray-300 font-semibold text-sm">Repair Order</Label>
              <Select value={form.repair_order_id} onValueChange={handleOrderSelect}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-2">
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

          {form.repair_order_id ? (
            <div className="rounded-lg bg-sky-500/10 border border-sky-500/20 p-4">
              <p className="text-white font-medium">{form.customer_name}</p>
              <p className="text-gray-400 text-sm mt-1">{form.vehicle_info}</p>
            </div>
          ) : !sourceEstimate && (
            <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer Info (Manual)</p>
              <div>
                <Label className="text-gray-300 text-sm">Customer Name</Label>
                <Input value={form.customer_name || ""}
                  onChange={e => setForm({...form, customer_name: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5"
                  placeholder="e.g. John Smith" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Phone</Label>
                <Input value={form.customer_phone || ""}
                  onChange={e => setForm({...form, customer_phone: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5"
                  placeholder="e.g. 555-123-4567" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Vehicle Info</Label>
                <Input value={form.vehicle_info || ""}
                  onChange={e => setForm({...form, vehicle_info: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5"
                  placeholder="e.g. 2020 Honda Civic" />
              </div>
            </div>
          )}

          {form.parts_used && form.parts_used.length > 0 && (
            <div className="rounded-lg border border-gray-700/50 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Store className="w-3.5 h-3.5 text-sky-400" />
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Parts Used & Suppliers</p>
              </div>
              <div className="space-y-2">
                {form.parts_used.map((p, i) => (
                  <div key={i} className="space-y-1.5 bg-gray-800/40 rounded-lg p-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300 font-medium">{p.name} <span className="text-gray-500">x{p.quantity}</span></span>
                      <span className="text-white">${(p.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Store className="w-3 h-3 text-gray-500 flex-shrink-0" />
                      <Input
                        value={p.supplier || ""}
                        onChange={e => {
                          const updated = form.parts_used.map((part, idx) =>
                            idx === i ? { ...part, supplier: e.target.value } : part
                          );
                          setForm({ ...form, parts_used: updated });
                        }}
                        className="bg-gray-700/50 border-gray-600 text-white h-7 text-xs placeholder-gray-500"
                        placeholder="Supplier / where bought (for warranty)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Costs & Totals</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Parts Total</Label>
                <Input type="number" step="0.01" value={form.parts_total}
                  onChange={e => setForm({...form, parts_total: Number(e.target.value)})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Labor Total</Label>
                <Input type="number" step="0.01" value={form.labor_total}
                  onChange={e => setForm({...form, labor_total: Number(e.target.value)})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Tax Rate (%)</Label>
              <Input type="number" step="0.1" value={form.tax_rate}
                onChange={e => setForm({...form, tax_rate: Number(e.target.value)})}
                className="bg-gray-800 border-gray-700 text-white mt-1.5" />
            </div>
            <div className="flex gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.apply_tax_labor}
                  onChange={e => setForm({...form, apply_tax_labor: e.target.checked})}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-300">Tax on Labor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.apply_tax_parts}
                  onChange={e => setForm({...form, apply_tax_parts: e.target.checked})}
                  className="w-4 h-4 rounded" />
                <span className="text-sm text-gray-300">Tax on Parts</span>
              </label>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Due Date</Label>
              <Input type="date" value={form.due_date}
                onChange={e => setForm({...form, due_date: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1.5" />
            </div>
          </div>

          <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Discount</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-gray-300 text-sm">Type</Label>
                <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v, discount_value: 0})}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1.5">
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
                  <Label className="text-gray-300 text-sm">Amount {form.discount_type === "percentage" ? "(%)" : "($)"}</Label>
                  <Input type="number" step="0.01" value={form.discount_value}
                    onChange={e => setForm({...form, discount_value: Number(e.target.value)})}
                    className="bg-gray-800 border-gray-700 text-white mt-1.5" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Method</p>
              <div className="flex gap-4">
                {[
                  { value: "cash", label: "Cash" },
                  { value: "card", label: "Card" },
                  { value: "e-transfer", label: "E-Transfer" }
                ].map(method => (
                  <label key={method.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="paymentMethod" value={method.value} checked={form.payment_method === method.value}
                      onChange={e => setForm({...form, payment_method: e.target.value, card_last4: ""})}
                      className="w-4 h-4" />
                    <span className="text-sm text-gray-300">{method.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Receipt Info</p>
              {form.payment_method === "card" && (
                <div>
                  <Label className="text-gray-300 text-sm">Card Last 4</Label>
                  <Input value={form.card_last4} onChange={e => setForm({...form, card_last4: e.target.value.slice(0,4)})}
                    className="bg-gray-800 border-gray-700 text-white mt-1.5" placeholder="e.g. 4242" maxLength={4} />
                </div>
              )}
              <div>
                <Label className="text-gray-300 text-sm">Receipt #</Label>
                <Input value={form.receipt_number} onChange={e => setForm({...form, receipt_number: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5" placeholder="e.g. 001234" />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Cashier Name</Label>
                <Input value={form.cashier_name} onChange={e => setForm({...form, cashier_name: e.target.value})}
                  className="bg-gray-800 border-gray-700 text-white mt-1.5" placeholder="Name or ID" />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 text-sm">Upfront Payment (Cash)</Label>
              <Input type="number" step="0.01" value={form.amount_paid}
                onChange={e => setForm({...form, amount_paid: Number(e.target.value)})}
                className="bg-gray-800 border-gray-700 text-white mt-1.5"
                placeholder="0.00" />
            </div>
          </div>

          <div className="rounded-lg bg-gradient-to-b from-sky-500/10 to-sky-500/5 p-4 border border-sky-500/20 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subtotal</span>
              <span className="text-gray-200 font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-400">
                <span>Discount {form.discount_type === "percentage" ? `(${form.discount_value}%)` : ""}</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
               <span className="text-gray-400">Tax {isCash ? <span className="text-xs text-amber-400">(No Tax - Cash)</span> : <span>({form.tax_rate}%)</span>}</span>
               <span className="text-gray-200 font-medium">${taxAmount.toFixed(2)}</span>
             </div>
            <div className="flex justify-between text-lg font-bold border-t border-sky-500/30 pt-2.5">
              <span className="text-gray-200">Total</span>
              <span className="text-sky-400">${total.toFixed(2)}</span>
            </div>
            {form.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-400">
                  <span>Paid Upfront</span>
                  <span>-${form.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-sky-500/30 pt-2.5">
                  <span className="text-gray-200">Balance Due</span>
                  <span className={balanceDue <= 0 ? "text-emerald-400" : "text-amber-400"}>
                    ${balanceDue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-800/20 rounded-lg p-4 border border-gray-700/50">
            <Label className="text-gray-300 font-semibold text-sm">Note for Customer</Label>
            <Textarea value={form.customer_note || ""}
              onChange={e => setForm({...form, customer_note: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-2"
              placeholder="e.g. Please come back for a follow-up check in 1 month..."
              rows={3} />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || (!form.customer_id && !form.customer_name)}
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white font-semibold">
              {saving ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}