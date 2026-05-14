import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Textarea } from "@/components/ui/textarea";
import { Search, X, Plus, Trash2, Store, Loader2 } from "lucide-react";
import { fuzzyMatch } from "@/utils/fuzzySearch";

const emptyForm = {
  repair_order_id: "", estimate_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "",
  parts_total: 0, labor_total: 0, tax_rate: 0, apply_tax_parts: true, apply_tax_labor: true, status: "unpaid",
  due_date: "", payment_method: "", amount_paid: 0, payment_history: [],
  receipt_number: "", card_last4: "", cashier_name: "", parts_used: [], labor_items: [], customer_note: "",
  discount_type: "none", discount_value: 0,
};

const emptyLaborRow = () => ({ description: "", hours: 1, rate: 0, total: 0 });
const emptyPartRow = () => ({ name: "", quantity: 1, unit_price: 0, total: 0 });

export default function InvoiceFormDialog({ open, onClose, invoice, orders, customers, vehicles = [], invoices = [], estimates = [], onSaved, initialOrderId, sourceEstimate }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [estimateSearch, setEstimateSearch] = useState("");
  const [linkMode, setLinkMode] = useState("order"); // "order" | "invoice" | "estimate"
  const [customerSearch, setCustomerSearch] = useState("");
  const [laborItems, setLaborItems] = useState([emptyLaborRow()]);
  const [partsItems, setPartsItems] = useState([emptyPartRow()]);

  useEffect(() => {
    if (!open) return;
    setLinkMode("order");
    setInvoiceSearch("");
    setEstimateSearch("");

    base44.auth.me().then(u => {
      const userTaxRate = u?.tax_rate != null ? u.tax_rate : 0;
      
      if (invoice && invoice.id) {
        setForm({
          ...emptyForm,
          repair_order_id: invoice.repair_order_id || "",
          estimate_id: invoice.estimate_id || "",
          customer_id: invoice.customer_id || "",
          customer_name: invoice.customer_name || "",
          customer_phone: invoice.customer_phone || "",
          vehicle_info: invoice.vehicle_info || "",
          parts_total: invoice.parts_total || 0,
          labor_total: invoice.labor_total || 0,
          tax_rate: userTaxRate,
          status: invoice.status || "unpaid",
          due_date: invoice.due_date || "",
          payment_method: invoice.payment_method || "",
          amount_paid: invoice.amount_paid || 0,
          payment_history: invoice.payment_history || [],
          receipt_number: invoice.receipt_number || "",
          card_last4: invoice.card_last4 || "",
          cashier_name: invoice.cashier_name || "",
          parts_used: invoice.parts_used || [],
          labor_items: invoice.labor_items || [],
          customer_note: invoice.customer_note || "",
          discount_type: invoice.discount_type || "none",
          discount_value: invoice.discount_value || 0,
          apply_tax_parts: invoice.apply_tax_parts !== false,
          apply_tax_labor: invoice.apply_tax_labor !== false,
        });
        const li = invoice.line_items || [];
        setLaborItems(li.filter(i => i.type === "labor").map(i => ({ description: i.description || "", hours: i.quantity || 1, rate: i.unit_price || 0, total: i.total || 0 })));
        setPartsItems(invoice.parts_used?.length ? invoice.parts_used.map(p => ({ name: p.name, quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0, supplier: p.supplier || "" })) : [emptyPartRow()]);
      } else if (sourceEstimate) {
        setForm(f => ({
          ...f,
          estimate_id: sourceEstimate.id,
          customer_id: sourceEstimate.customer_id,
          customer_name: sourceEstimate.customer_name,
          vehicle_info: sourceEstimate.vehicle_info,
          parts_total: sourceEstimate.parts_total || 0,
          labor_total: sourceEstimate.labor_total || 0,
          customer_note: sourceEstimate.notes || "",
          tax_rate: userTaxRate,
        }));
        setLaborItems(sourceEstimate.labor_items?.length ? sourceEstimate.labor_items.map(i => ({ description: i.description, hours: i.hours || 1, rate: i.rate || 0, total: i.total || 0 })) : [emptyLaborRow()]);
        setPartsItems(sourceEstimate.parts_items?.length ? sourceEstimate.parts_items.map(p => ({ name: p.name, quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0 })) : [emptyPartRow()]);
      } else if (initialOrderId) {
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
            customer_note: order.notes || "",
            tax_rate: userTaxRate,
          }));
          setLaborItems(order.labor_items?.length ? order.labor_items.map(i => ({ description: i.description, hours: i.hours || 1, rate: i.rate || 0, total: i.total || 0 })) : [emptyLaborRow()]);
          setPartsItems(order.parts_used?.length ? order.parts_used.map(p => ({ name: p.name, quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0 })) : [emptyPartRow()]);
        }
      } else if (invoice && !invoice.id) {
        setForm(f => ({ ...f, customer_id: invoice.customer_id || "", customer_name: invoice.customer_name || "", vehicle_info: invoice.vehicle_info || "", tax_rate: userTaxRate }));
        setLaborItems([emptyLaborRow()]);
        setPartsItems([emptyPartRow()]);
      } else {
        setForm({ ...emptyForm, tax_rate: userTaxRate });
        setLaborItems([emptyLaborRow()]);
        setPartsItems([emptyPartRow()]);
      }
      });
      }, [open, invoice, initialOrderId, sourceEstimate, orders]);

  const handleOrderSelect = useCallback(async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;
    let customerPhone = "";
    try {
      const customer = await base44.entities.Customer.get(order.customer_id);
      customerPhone = customer.phone || "";
      const fullOrder = await base44.entities.RepairOrder.get(orderId);
      setLaborItems(fullOrder.labor_items?.length ? fullOrder.labor_items.map(i => ({ description: i.description, hours: i.hours || 1, rate: i.rate || 0, total: i.total || 0 })) : [emptyLaborRow()]);
      setPartsItems(fullOrder.parts_used?.length ? fullOrder.parts_used.map(p => ({ name: p.name, quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0 })) : [emptyPartRow()]);
    } catch (e) {}
    setForm(prev => ({
      ...prev,
      repair_order_id: orderId,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_phone: customerPhone,
      vehicle_info: order.vehicle_info,
      parts_total: order.parts_cost || 0,
      labor_total: order.labor_cost || 0,
      customer_note: order.notes || prev.customer_note || "",
    }));
    setOrderSearch("");
  }, [orders]);

  const filteredOrders = orders.filter(o => !orderSearch || fuzzyMatch(orderSearch, [o.order_number, o.customer_name, o.vehicle_info]));
  const filteredInvoices = invoices.filter(i => i.id !== invoice?.id && (!invoiceSearch || fuzzyMatch(invoiceSearch, [i.invoice_number, i.customer_name, i.vehicle_info])));
  const filteredEstimates = estimates.filter(e => !estimateSearch || fuzzyMatch(estimateSearch, [e.estimate_number, e.customer_name, e.vehicle_info]));

  const handleEstimateLink = async (estId) => {
    const est = estimates.find(e => e.id === estId);
    if (!est) return;
    let customerPhone = "";
    try { const c = await base44.entities.Customer.get(est.customer_id); customerPhone = c.phone || ""; } catch (e) {}
    setForm(prev => ({
      ...prev,
      repair_order_id: "",
      estimate_id: estId,
      customer_id: est.customer_id,
      customer_name: est.customer_name,
      customer_phone: customerPhone,
      vehicle_info: est.vehicle_info || "",
      parts_total: est.parts_total || 0,
      labor_total: est.labor_total || 0,
      customer_note: est.notes || "",
    }));
    setLaborItems(est.labor_items?.length ? est.labor_items.map(i => ({ description: i.description, hours: i.hours || 1, rate: i.rate || 0, total: i.total || 0 })) : [emptyLaborRow()]);
    setPartsItems(est.parts_items?.length ? est.parts_items.map(p => ({ name: p.name, quantity: p.quantity || 1, unit_price: p.unit_price || 0, total: p.total || 0 })) : [emptyPartRow()]);
    setEstimateSearch("");
    setLinkMode("estimate-linked");
  };

  const handleInvoiceLink = async (linkedInvId) => {
    const linked = invoices.find(i => i.id === linkedInvId);
    if (!linked) return;
    let customerPhone = "";
    try { const c = await base44.entities.Customer.get(linked.customer_id); customerPhone = c.phone || ""; } catch (e) {}
    setForm(prev => ({
      ...prev,
      repair_order_id: "",
      customer_id: linked.customer_id,
      customer_name: linked.customer_name,
      customer_phone: customerPhone,
      vehicle_info: linked.vehicle_info || "",
    }));
    setInvoiceSearch("");
    setLinkMode("invoice-linked");
  };

  // Live-calculated totals from editable rows
  const laborTotal = laborItems.reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0), 0);
  const partsTotal = partsItems.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0), 0);

  const calculations = useMemo(() => {
    const subtotal = laborTotal + partsTotal;
    const discountAmount = form.discount_type === "percentage"
      ? subtotal * ((form.discount_value || 0) / 100)
      : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
    const subtotalAfterDiscount = subtotal - discountAmount;
    let taxableAmount = 0;
    if (form.apply_tax_labor) taxableAmount += laborTotal;
    if (form.apply_tax_parts) taxableAmount += partsTotal;
    const taxAmount = taxableAmount * ((form.tax_rate || 0) / 100);
    const total = subtotalAfterDiscount + taxAmount;
    const balanceDue = total - (form.amount_paid || 0);
    return { subtotal, discountAmount, subtotalAfterDiscount, taxAmount, total, balanceDue };
  }, [laborTotal, partsTotal, form.discount_type, form.discount_value, form.payment_method, form.tax_rate, form.amount_paid, form.apply_tax_labor, form.apply_tax_parts]);

  const { subtotal, discountAmount, taxAmount, calculations: _c, ..._ } = calculations;
  const { total, balanceDue } = calculations;

  const updateLabor = (idx, field, value) => {
    setLaborItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: value };
      u.total = (parseFloat(u.hours) || 0) * (parseFloat(u.rate) || 0);
      return u;
    }));
  };

  const updatePart = (idx, field, value) => {
    setPartsItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const u = { ...r, [field]: value };
      u.total = (parseFloat(u.quantity) || 0) * (parseFloat(u.unit_price) || 0);
      return u;
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    let resolvedCustomerId = form.customer_id;
    if (!form.repair_order_id && !form.customer_id && form.customer_name) {
      const newCustomer = await base44.entities.Customer.create({ full_name: form.customer_name, phone: form.customer_phone || "" });
      resolvedCustomerId = newCustomer.id;
      if (form.vehicle_info) {
        const parts = form.vehicle_info.trim().split(" ");
        await base44.entities.Vehicle.create({ customer_id: newCustomer.id, customer_name: form.customer_name, year: parseInt(parts[0]) || new Date().getFullYear(), make: parts[1] || "Unknown", model: parts.slice(2).join(" ") || "Unknown" });
      }
    }

    const line_items = [
      ...laborItems.filter(r => r.description).map(r => ({ description: r.description, type: "labor", quantity: parseFloat(r.hours) || 1, unit_price: parseFloat(r.rate) || 0, total: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0) })),
      ...partsItems.filter(r => r.name).map(r => ({ description: r.name, type: "part", quantity: parseFloat(r.quantity) || 1, unit_price: parseFloat(r.unit_price) || 0, total: (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0) })),
    ];
    const parts_used = partsItems.filter(r => r.name).map(r => ({ name: r.name, quantity: parseFloat(r.quantity) || 1, unit_price: parseFloat(r.unit_price) || 0, total: r.total, supplier: r.supplier || "" }));

    let finalStatus = form.status;
    let paidDate = invoice?.paid_date;
    let paymentHistory = form.payment_history || [];
    const invoiceNum = invoice?.invoice_number || `INV-${Date.now().toString(36).toUpperCase()}`;
    const { total: finalTotal, balanceDue: finalBalance, taxAmount: finalTax } = calculations;

    if (finalBalance <= 0) {
      finalStatus = "paid";
      if (invoice?.status !== "paid") paidDate = new Date().toISOString().substring(0, 10);
      if (form.amount_paid > 0 && form.payment_method) {
        paymentHistory = [...paymentHistory, { date: new Date().toISOString().substring(0, 10), amount: form.amount_paid, method: form.payment_method, note: "Payment received" }];
      }
    } else if (form.amount_paid > 0) {
      finalStatus = "partial";
      if (form.payment_method) {
        paymentHistory = [...paymentHistory, { date: new Date().toISOString().substring(0, 10), amount: form.amount_paid, method: form.payment_method, note: "Partial payment received" }];
      }
    }
    if (finalStatus !== "paid" && form.due_date) {
      if (form.due_date < new Date().toISOString().split("T")[0]) finalStatus = "overdue";
    }

    const data = { ...form, customer_id: resolvedCustomerId, invoice_number: invoiceNum, labor_items: laborItems, parts_used, labor_total: laborTotal, parts_total: partsTotal, tax_amount: finalTax, total: finalTotal, balance_due: finalBalance, status: finalStatus, paid_date: paidDate, payment_history: paymentHistory, line_items, estimate_id: form.estimate_id || sourceEstimate?.id || "" };

    if (invoice && invoice.id) {
      await base44.entities.Invoice.update(invoice.id, data);
      if (data.repair_order_id) {
        try {
          const ro = await base44.entities.RepairOrder.get(data.repair_order_id);
          if (ro) await base44.entities.RepairOrder.update(data.repair_order_id, { customer_id: data.customer_id, customer_name: data.customer_name, vehicle_info: data.vehicle_info, labor_cost: laborTotal, parts_cost: partsTotal, total_cost: finalTotal, parts_used: data.parts_used?.length ? data.parts_used : ro.parts_used, description: ro.description, notes: ro.notes });
        } catch (e) {}
      }
      if (data.estimate_id) {
        try {
          const est = await base44.entities.Estimate.get(data.estimate_id);
          if (est) {
            const estTax = est.apply_tax ? (laborTotal + partsTotal) * ((est.tax_rate || 0) / 100) : 0;
            await base44.entities.Estimate.update(data.estimate_id, { customer_id: data.customer_id, customer_name: data.customer_name, vehicle_info: data.vehicle_info, labor_total: laborTotal, parts_total: partsTotal, tax_amount: estTax, grand_total: laborTotal + partsTotal + estTax, notes: est.notes });
          }
        } catch (e) {}
      }
    } else {
      await base44.entities.Invoice.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const statusColor = { unpaid: "bg-gray-500/20 text-gray-300", paid: "bg-green-500/20 text-green-400", partial: "bg-yellow-500/20 text-yellow-400", overdue: "bg-red-500/20 text-red-400" };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl flex flex-col p-0" style={{ maxHeight: "90vh", height: "90vh" }}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-white">
            {invoice?.id ? "Edit Invoice" : sourceEstimate ? `Invoice from Estimate #${sourceEstimate.estimate_number}${sourceEstimate.created_date ? ` · ${new Date(sourceEstimate.created_date).toLocaleDateString()}` : ""}` : "Create Invoice"}
          </DialogTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-gray-700 text-gray-300">Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || (!form.customer_id && !form.customer_name)} className="bg-sky-500 hover:bg-sky-600 text-white gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save Invoice"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-6">

          {/* Customer + Vehicle + Repair Order Link — unified layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Customer */}
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Customer *</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={form.customer_id ? (customers.find(c => c.id === form.customer_id)?.full_name || form.customer_name || "") : customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setForm(f => ({ ...f, customer_id: "", customer_name: e.target.value, vehicle_id: "", vehicle_info: "", repair_order_id: "" })); }}
                  placeholder="Search by name or phone..."
                  className="bg-gray-800 border-gray-700 text-white pl-8"
                  readOnly={!!form.repair_order_id || !!sourceEstimate}
                />
                {customerSearch && !form.customer_id && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                    {customers.filter(c => !customerSearch || c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || "").includes(customerSearch)).slice(0, 8).map(c => (
                      <button key={c.id} onClick={() => {
                        setForm(f => ({ ...f, customer_id: c.id, customer_name: c.full_name, customer_phone: c.phone || "", vehicle_id: "", vehicle_info: "" }));
                        setCustomerSearch("");
                      }} className="w-full px-3 py-2 text-left hover:bg-sky-500/20 text-sm text-white flex justify-between gap-2">
                        <span>{c.full_name}</span>
                        <span className="text-gray-400 text-xs">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.customer_id && !form.repair_order_id && !sourceEstimate && (
                  <button onClick={() => { setForm(f => ({ ...f, customer_id: "", customer_name: "", customer_phone: "", vehicle_id: "", vehicle_info: "" })); setCustomerSearch(""); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div>
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Vehicle</Label>
              <div className="mt-1">
                {form.customer_id && !form.repair_order_id && !sourceEstimate ? (
                  <Select value={form.vehicle_id || ""} onValueChange={vid => {
                    const v = vehicles.find(v => v.id === vid);
                    setForm(f => ({ ...f, vehicle_id: vid, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" }));
                  }}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder="Select vehicle..." />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                      {vehicles.filter(v => v.customer_id === form.customer_id).map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}{v.license_plate ? ` (${v.license_plate})` : ""}</SelectItem>
                      ))}
                      {vehicles.filter(v => v.customer_id === form.customer_id).length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-500">No vehicles found for this customer</div>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.vehicle_info} onChange={e => !form.repair_order_id && !sourceEstimate && setForm({ ...form, vehicle_info: e.target.value })} className="bg-gray-800 border-gray-700 text-white" placeholder={form.customer_name ? "e.g. 2020 Honda Civic" : "Select customer first..."} readOnly={!!form.repair_order_id || !!sourceEstimate} />
                )}
              </div>
            </div>

            {/* Link Estimate / Repair / Invoice */}
            {!sourceEstimate && (
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-gray-400 text-xs uppercase tracking-wider">Link Estimate / Repair / Invoice</Label>
                  {!form.repair_order_id && !["invoice-linked", "estimate-linked"].includes(linkMode) && (
                    <div className="flex gap-1">
                      <button onClick={() => { setLinkMode("order"); setInvoiceSearch(""); setEstimateSearch(""); }} className={`text-xs px-2 py-0.5 rounded ${linkMode === "order" ? "bg-sky-500/20 text-sky-400" : "text-gray-500 hover:text-gray-300"}`}>Repair Order</button>
                      <button onClick={() => { setLinkMode("estimate"); setOrderSearch(""); setInvoiceSearch(""); }} className={`text-xs px-2 py-0.5 rounded ${linkMode === "estimate" ? "bg-emerald-500/20 text-emerald-400" : "text-gray-500 hover:text-gray-300"}`}>Estimate</button>
                      <button onClick={() => { setLinkMode("invoice"); setOrderSearch(""); setEstimateSearch(""); }} className={`text-xs px-2 py-0.5 rounded ${linkMode === "invoice" ? "bg-purple-500/20 text-purple-400" : "text-gray-500 hover:text-gray-300"}`}>Invoice</button>
                    </div>
                  )}
                </div>

                {/* Linked repair order pill */}
                {form.repair_order_id && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-sky-500/40 rounded-md">
                    <span className="text-sky-400 text-sm font-medium flex-1">
                      RO #{orders.find(o => o.id === form.repair_order_id)?.order_number} — {form.customer_name} · {form.vehicle_info}
                      {(() => { const o = orders.find(o => o.id === form.repair_order_id); return o?.created_date ? <span className="text-gray-500 text-xs ml-2">{new Date(o.created_date).toLocaleDateString()}</span> : null; })()}
                    </span>
                    <button onClick={() => { setForm(f => ({ ...f, repair_order_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "" })); setOrderSearch(""); setLinkMode("order"); }}
                      className="text-gray-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {/* Linked estimate pill */}
                {!form.repair_order_id && linkMode === "estimate-linked" && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-emerald-500/40 rounded-md">
                    <span className="text-emerald-400 text-sm font-medium flex-1">
                      EST #{estimates.find(e => e.id === form.estimate_id)?.estimate_number} — {form.customer_name} · {form.vehicle_info}
                    </span>
                    <button onClick={() => { setForm(f => ({ ...f, estimate_id: "", customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "" })); setLaborItems([emptyLaborRow()]); setPartsItems([emptyPartRow()]); setLinkMode("estimate"); }}
                      className="text-gray-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {/* Linked invoice pill */}
                {!form.repair_order_id && linkMode === "invoice-linked" && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-purple-500/40 rounded-md">
                    <span className="text-purple-400 text-sm font-medium flex-1">Invoice linked — {form.customer_name} · {form.vehicle_info}</span>
                    <button onClick={() => { setForm(f => ({ ...f, customer_id: "", customer_name: "", customer_phone: "", vehicle_info: "" })); setLinkMode("invoice"); }}
                      className="text-gray-500 hover:text-rose-400"><X className="w-4 h-4" /></button>
                  </div>
                )}

                {/* Repair order search */}
                {!form.repair_order_id && linkMode === "order" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                      placeholder="Search by #, customer, or vehicle..."
                      className="w-full pl-10 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
                    {orderSearch && <button onClick={() => setOrderSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>}
                    {orderSearch && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-gray-700 bg-gray-800 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {filteredOrders.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No orders found</div>}
                        {filteredOrders.map(o => (
                          <button key={o.id} onClick={() => handleOrderSelect(o.id)} className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm border-b border-gray-700 last:border-0 flex items-center justify-between gap-2">
                            <span>
                              <span className="text-white font-medium">#{o.order_number}</span>
                              <span className="text-gray-400 text-xs ml-2">{o.customer_name} · {o.vehicle_info}</span>
                            </span>
                            {o.created_date && <span className="text-gray-500 text-xs flex-shrink-0">{new Date(o.created_date).toLocaleDateString()}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Estimate search */}
                {!form.repair_order_id && linkMode === "estimate" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={estimateSearch} onChange={e => setEstimateSearch(e.target.value)}
                      placeholder="Search by estimate #, customer, or vehicle..."
                      className="w-full pl-10 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                    {estimateSearch && <button onClick={() => setEstimateSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>}
                    {estimateSearch && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-gray-700 bg-gray-800 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {filteredEstimates.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No estimates found</div>}
                        {filteredEstimates.map(e => (
                          <button key={e.id} onClick={() => handleEstimateLink(e.id)} className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm border-b border-gray-700 last:border-0 flex items-center justify-between gap-2">
                            <span>
                              <span className="text-white font-medium">#{e.estimate_number}</span>
                              <span className="text-gray-400 text-xs ml-2">{e.customer_name} · {e.vehicle_info}</span>
                              {e.status && <span className="text-gray-500 text-xs ml-1">({e.status})</span>}
                            </span>
                            {e.created_date && <span className="text-gray-500 text-xs flex-shrink-0">{new Date(e.created_date).toLocaleDateString()}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Invoice search */}
                {!form.repair_order_id && linkMode === "invoice" && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)}
                      placeholder="Search by invoice #, customer, or vehicle..."
                      className="w-full pl-10 pr-9 py-2 bg-gray-800 border border-gray-700 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500" />
                    {invoiceSearch && <button onClick={() => setInvoiceSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>}
                    {invoiceSearch && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-md border border-gray-700 bg-gray-800 overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                        {filteredInvoices.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No invoices found</div>}
                        {filteredInvoices.map(i => (
                          <button key={i.id} onClick={() => handleInvoiceLink(i.id)} className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm border-b border-gray-700 last:border-0 flex items-center justify-between gap-2">
                            <span>
                              <span className="text-white font-medium">{i.invoice_number}</span>
                              <span className="text-gray-400 text-xs ml-2">{i.customer_name} · {i.vehicle_info}</span>
                            </span>
                            {i.created_date && <span className="text-gray-500 text-xs flex-shrink-0">{new Date(i.created_date).toLocaleDateString()}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-gray-800">
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Due Date</p>
              <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} className="bg-gray-800 border-gray-700 text-white h-7 text-xs" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Amount Paid</p>
              <Input type="number" step="0.01" value={form.amount_paid} onChange={e => setForm({ ...form, amount_paid: Number(e.target.value) })} className="bg-gray-800 border-gray-700 text-white h-7 text-xs" />
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Balance Due</p>
              <p className={`font-bold text-sm ${balanceDue > 0 ? "text-yellow-400" : "text-emerald-400"}`}>${balanceDue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {["unpaid", "partial", "paid", "overdue"].map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Labor Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold">Labor</h3>
              <Button size="sm" variant="ghost" onClick={() => setLaborItems(p => [...p, emptyLaborRow()])} className="text-sky-400 hover:text-sky-300 h-7 px-2 gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Labor
              </Button>
            </div>
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-500 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right w-20">Hours</th>
                    <th className="px-3 py-2 text-right w-24">Rate/hr</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {laborItems.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-600 text-xs">No labor items</td></tr>}
                  {laborItems.map((row, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5"><Input value={row.description} onChange={e => updateLabor(idx, "description", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Change" /></td>
                      <td className="px-2 py-1.5"><Input type="number" value={row.hours} onChange={e => updateLabor(idx, "hours", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="1" step="0.5" /></td>
                      <td className="px-2 py-1.5"><Input type="number" value={row.rate} onChange={e => updateLabor(idx, "rate", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" /></td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}</td>
                      <td className="pr-2 py-1.5 text-center"><button onClick={() => setLaborItems(p => p.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parts Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-semibold">Parts</h3>
              <Button size="sm" variant="ghost" onClick={() => setPartsItems(p => [...p, emptyPartRow()])} className="text-sky-400 hover:text-sky-300 h-7 px-2 gap-1">
                <Plus className="w-3.5 h-3.5" /> Add Part
              </Button>
            </div>
            <div className="rounded-lg border border-gray-800 overflow-hidden" style={{ maxHeight: "220px", overflowY: "auto" }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-500 text-xs sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Part Name</th>
                    <th className="px-3 py-2 text-right w-16">Qty</th>
                    <th className="px-3 py-2 text-right w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {partsItems.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-gray-600 text-xs">No parts</td></tr>}
                  {partsItems.map((row, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5"><Input value={row.name} onChange={e => updatePart(idx, "name", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" /></td>
                      <td className="px-2 py-1.5"><Input type="number" value={row.quantity} onChange={e => updatePart(idx, "quantity", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="1" /></td>
                      <td className="px-2 py-1.5"><Input type="number" value={row.unit_price} onChange={e => updatePart(idx, "unit_price", e.target.value)} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0.00" /></td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toFixed(2)}</td>
                      <td className="pr-2 py-1.5 text-center"><button onClick={() => setPartsItems(p => p.filter((_, i) => i !== idx))} className="text-gray-600 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
            {laborItems.map((r, i) => r.description && (
              <div key={i} className="flex justify-between text-gray-400">
                <span>{r.description} <span className="text-gray-600 text-xs">({r.hours}h × ${parseFloat(r.rate || 0).toFixed(2)}/hr)</span></span>
                <span>${((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0)).toFixed(2)}</span>
              </div>
            ))}
            {partsItems.map((r, i) => r.name && (
              <div key={i} className="flex justify-between text-gray-400">
                <span>{r.name} <span className="text-gray-600 text-xs">(x{r.quantity})</span></span>
                <span>${((parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0)).toFixed(2)}</span>
              </div>
            ))}
            {discountAmount > 0 && <div className="flex justify-between text-emerald-400"><span>Discount</span><span>-${discountAmount.toFixed(2)}</span></div>}
            {calculations.taxAmount > 0 && (
              <div className="flex justify-between text-gray-400 border-t border-gray-700/50 pt-2">
                <span>Tax ({form.tax_rate}%)</span>
                <span>${calculations.taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-base border-t border-gray-700 pt-2">
              <span>Grand Total</span><span className="text-sky-400">${total.toFixed(2)}</span>
            </div>
            {form.amount_paid > 0 && <div className="flex justify-between text-emerald-400"><span>Amount Paid</span><span>${parseFloat(form.amount_paid).toFixed(2)}</span></div>}
            <div className="flex justify-between font-semibold">
              <span className="text-gray-300">Balance Due</span>
              <span className={balanceDue <= 0 ? "text-emerald-400" : "text-yellow-400"}>${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment & Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Payment Method</Label>
              <div className="flex gap-3">
                {["cash", "card", "e-transfer"].map(m => (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" name="payMethod" value={m} checked={form.payment_method === m} onChange={e => setForm({ ...form, payment_method: e.target.value, card_last4: "" })} className="w-3.5 h-3.5" />
                    <span className="text-sm text-gray-300 capitalize">{m}</span>
                  </label>
                ))}
              </div>
              {form.payment_method === "card" && (
                <Input value={form.card_last4} onChange={e => setForm({ ...form, card_last4: e.target.value.slice(0, 4) })} className="bg-gray-800 border-gray-700 text-white" placeholder="Card last 4 digits" maxLength={4} />
              )}
              <Input value={form.receipt_number} onChange={e => setForm({ ...form, receipt_number: e.target.value })} className="bg-gray-800 border-gray-700 text-white" placeholder="Receipt #" />
              <Input value={form.cashier_name} onChange={e => setForm({ ...form, cashier_name: e.target.value })} className="bg-gray-800 border-gray-700 text-white" placeholder="Cashier name" />
            </div>
            <div className="space-y-3">
              <Label className="text-gray-400 text-xs uppercase tracking-wider">Tax & Discount</Label>
              <div className="rounded-md bg-gray-800/50 border border-gray-700 p-3">
                <Label className="text-gray-400 text-xs">Tax Rate (%) *</Label>
                <Input type="number" step="0.1" value={form.tax_rate} onChange={e => setForm({ ...form, tax_rate: Number(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1 font-semibold" placeholder="0" />
                <p className="text-gray-500 text-xs mt-1">Your saved tax rate: {form.tax_rate}%</p>
              </div>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={form.apply_tax_labor} onChange={e => setForm({ ...form, apply_tax_labor: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-xs text-gray-300">Tax on Labor</span></label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={form.apply_tax_parts} onChange={e => setForm({ ...form, apply_tax_parts: e.target.checked })} className="w-4 h-4 rounded" /><span className="text-xs text-gray-300">Tax on Parts</span></label>
              </div>
              <div className="flex gap-2">
                <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v, discount_value: 0 })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-24"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    <SelectItem value="none">No Disc.</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">$</SelectItem>
                  </SelectContent>
                </Select>
                {form.discount_type !== "none" && (
                  <Input type="number" step="0.01" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: Number(e.target.value) })} className="bg-gray-800 border-gray-700 text-white flex-1" placeholder="0" />
                )}
              </div>
            </div>
          </div>

          {/* Note */}
          <div>
            <Label className="text-gray-400 text-xs uppercase tracking-wider">Note for Customer</Label>
            <Textarea value={form.customer_note || ""} onChange={e => setForm({ ...form, customer_note: e.target.value })} className="bg-gray-800 border-gray-700 text-white mt-2" placeholder="e.g. Please come back for a follow-up..." rows={2} />
          </div>

        </div>{/* end space-y-6 */}
        </div>{/* end scrollable body */}
      </DialogContent>
    </Dialog>
  );
}