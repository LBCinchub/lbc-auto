import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Store, Plus, Trash2, Save, Loader2, CreditCard, X, Printer, Download, Share2, Mail, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatPhone } from "@/utils/formatPhone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import PrintTemplate from "@/components/shared/PrintTemplate";
import TechnicianNotes from "@/components/invoices/TechnicianNotes";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import { useEmailSend } from "@/hooks/useEmailSend";




// Auto-capitalise: first letter of every word
const toTitleCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());
const capWords = (e, setter, key) => {
  const val = toTitleCase(e.target.value);
  if (key) setter(p => ({ ...p, [key]: val }));
  else setter(val);
};

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Editable line item state
  const [laborItems, setLaborItems] = useState([]);
  const [partsItems, setPartsItems] = useState([]);
  const [partsUsed, setPartsUsed] = useState([]);
  const [taxAppliesTo, setTaxAppliesTo] = useState("both");
  const [initialized, setInitialized] = useState(false);
  const [techNotes, setTechNotes] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [serviceReason, setServiceReason] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("$"); // "$" or "%"
  const [showCashoutDialog, setShowCashoutDialog] = useState(false);
  const { sendEmail, sending: sendingEmail } = useEmailSend();

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: () => base44.entities.Invoice.get(invoiceId),
    enabled: !!invoiceId,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", invoice?.customer_id],
    queryFn: () => base44.entities.Customer.get(invoice.customer_id),
    enabled: !!invoice?.customer_id,
  });

  const { data: repairOrder } = useQuery({
    queryKey: ["repairOrder", invoice?.repair_order_id],
    queryFn: () => base44.entities.RepairOrder.get(invoice.repair_order_id),
    enabled: !!invoice?.repair_order_id,
  });

  const vehicleId = repairOrder?.vehicle_id || invoice?.vehicle_id;
  const { data: vehicleRecord } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => base44.entities.Vehicle.get(vehicleId),
    enabled: !!vehicleId,
  });

  // Initialize editable state from invoice data once loaded
  useEffect(() => {
    if (invoice && !initialized) {
      const lineItems = invoice.line_items || [];
      setLaborItems(
        lineItems
          .filter(i => i.type === "labor")
          .map(i => ({ description: i.description || "", hours: i.quantity || 0, rate: i.unit_price || 0, total: i.total || 0 }))
      );
      setPartsItems(
        lineItems
          .filter(i => i.type !== "labor")
          .map(i => ({ name: i.description || "", quantity: i.quantity || 1, unit_price: i.unit_price || 0, total: i.total || 0 }))
      );
      setPartsUsed(invoice.parts_used || []);
      setTechNotes(invoice.technician_notes || "");
    setInvoiceDate(invoice.invoice_date || invoice.created_date?.split("T")[0] || "");
    setDueDate(invoice.due_date || "");
    setCustomerNote(invoice.customer_note || "");
    setServiceReason(invoice.service_reason || "");
      setTaxAppliesTo(invoice.tax_applies_to || "both");
      setInitialized(true);
    }
  }, [invoice, initialized]);

  // Calculations — zero-qty items are "Recommended" and excluded from all totals
  const laborTotal = laborItems.reduce((s, r) => {
    const qty = parseFloat(r.hours) || 0;
    return qty > 0 ? s + qty * (parseFloat(r.rate) || 0) : s;
  }, 0);
  const partsTotal = partsItems.reduce((s, r) => {
    const qty = parseFloat(r.quantity) || 0;
    return qty > 0 ? s + qty * (parseFloat(r.unit_price) || 0) : s;
  }, 0);
  const subtotal = laborTotal + partsTotal;
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = discountType === "%" ? (subtotal * discountValue / 100) : discountValue;
  const taxRate = invoice?.tax_rate ?? (user?.tax_rate ?? 0);
  const taxableBase = taxAppliesTo === "labor" ? laborTotal
    : taxAppliesTo === "parts" ? partsTotal
    : taxAppliesTo === "none" ? 0
    : Math.max(0, (laborTotal + partsTotal) - discountAmount); // "both" after discount
  const taxAmount = taxableBase * (taxRate / 100);
  const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);

  // ── Share / Print / Save as PDF ──────────────────────────────────────────
  const handlePrint = () => {
    // Hide everything except the print preview, then trigger browser print
    const printEl = document.getElementById("invoice-print-area");
    if (!printEl) { window.print(); return; }
    const original = document.body.innerHTML;
    document.body.innerHTML = printEl.outerHTML;
    window.print();
    document.body.innerHTML = original;
    window.location.reload();
  };

  const handleShare = async () => {
    const title = `Invoice #${invoice?.invoice_number} — ${invoice?.customer_name || ""}`;
    const text  = `Invoice #${invoice?.invoice_number}\nVehicle: ${invoice?.vehicle_info || ""}\nTotal: $${(invoice?.total || 0).toFixed(2)}\nBalance Due: $${(invoice?.balance_due || 0).toFixed(2)}\n\nThank you for your business!`;
    if (navigator.share) {
      try { await navigator.share({ title, text }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard ✓", description: "Invoice summary copied — paste anywhere to share." });
    }
  };

  const updateLabor = (idx, field, value) => {
    setLaborItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      updated.total = (parseFloat(updated.hours) || 0) * (parseFloat(updated.rate) || 0);
      return updated;
    }));
  };

  const updatePart = (idx, field, value) => {
    setPartsItems(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
      return updated;
    }));
  };

  const updatePartUsed = (idx, field, value) => {
    setPartsUsed(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      return { ...r, [field]: value };
    }));
  };


  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setSavedOk(false);
    const line_items = [
      ...laborItems.map(r => ({
        type: "labor",
        description: r.description,
        quantity: parseFloat(r.hours) || 0,
        unit_price: parseFloat(r.rate) || 0,
        total: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0),
      })),
      ...partsItems.map(r => ({
        type: "part",
        description: r.name,
        quantity: parseFloat(r.quantity) || 1,
        unit_price: parseFloat(r.unit_price) || 0,
        total: (parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0),
      })),
    ];
    const newTax = taxableBase * (taxRate / 100);
    const newTotal = Math.max(0, subtotal - discountAmount + newTax);
    const amountPaid = invoice.amount_paid || 0;
    await base44.entities.Invoice.update(invoiceId, {
      line_items,
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_amount: newTax,
      tax_applies_to: taxAppliesTo,
      discount: discountValue,
      discount_type: discountType,
      total: newTotal,
      balance_due: Math.max(0, newTotal - amountPaid),
      parts_used: partsUsed,
      technician_notes: techNotes,
      invoice_date: invoiceDate,
      due_date: dueDate,
      customer_note: customerNote,
      service_reason: serviceReason,
    });
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  const handleSendEmail = async () => {
    if (!invoice) return;
    try {
      await sendEmail({
        to: invoice.customer_email || customer?.email,
        subject: `Invoice #${invoice.invoice_number}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        customerName: invoice.customer_name,
        vehicleInfo: invoice.vehicle_info,
        total: grandTotal,
      });
    } catch(e) { console.error("Email error", e); }
  };



  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/Invoices")} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Button>
        <div className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Invoice not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">


      {/* Header */}
      {/* Header + Action Bar */}
      {/* Header + Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate("/Invoices")} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Invoices
        </Button>
        <div className="flex flex-wrap gap-2">
          {/* Repair Order link if exists */}
          {invoice?.repair_order_id && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/RepairOrderDetail/${invoice.repair_order_id}`)}
              className="border-gray-700 text-gray-300 h-9 gap-1.5 text-xs hover:border-gray-500">
              View Repair Order
            </Button>
          )}
          {/* Email */}
          <Button variant="outline" size="sm" onClick={handleSendEmail} disabled={sendingEmail}
            className="border-gray-700 text-gray-300 h-9 gap-1.5 text-xs hover:border-sky-500 hover:text-sky-400">
            {sendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Email
          </Button>
          {/* Cashout — full PaymentReceiptDialog */}
          {invoice?.status !== "paid" && (
            <Button size="sm" onClick={() => setShowCashoutDialog(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-9 text-xs">
              <CreditCard className="w-3.5 h-3.5" /> Cashout
            </Button>
          )}
          {/* Print / Save PDF */}
          <Button variant="outline" size="sm" onClick={() => window.print()}
            className="border-gray-700 text-gray-300 h-9 gap-1.5 text-xs hover:border-sky-500 hover:text-sky-400">
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </Button>
          {/* Share */}
          <Button variant="outline" size="sm" onClick={handleShare}
            className="border-gray-700 text-gray-300 h-9 gap-1.5 text-xs hover:border-violet-500 hover:text-violet-400">
            <Share2 className="w-3.5 h-3.5" /> Share
          </Button>
          {/* Save Changes */}
          <Button size="sm" onClick={handleSave} disabled={saving}
            className={`gap-1.5 h-9 text-xs ${savedOk ? "bg-emerald-600 hover:bg-emerald-700" : "bg-sky-500 hover:bg-sky-600"}`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : savedOk ? "Saved ✓" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Print Preview — same style as Estimates */}
      {/* Print styles — hides everything except the document */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #invoice-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; background: white; }
          #invoice-print-area * { display: revert !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
      <div id="invoice-print-area" className="rounded-xl border border-gray-800/50 bg-white p-8">
        <PrintTemplate
          type="Invoice"
          docNumber={invoice.invoice_number}
          createdDate={new Date((invoiceDate || invoice.created_date) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          user={user}
          customer={{ name: invoice.customer_name || customer?.full_name || "—", phone: customer?.phone, email: customer?.email, address: customer?.address }}
          vehicle={{ info: invoice.vehicle_info, vin: vehicleRecord?.vin, license_plate: vehicleRecord?.license_plate, color: vehicleRecord?.color, mileage: vehicleRecord?.mileage }}
          lineItems={[
            ...(laborItems.map(r => ({
              name: r.description || "Labor",
              description: `${r.hours}h @ $${parseFloat(r.rate || 0).toFixed(2)}/hr`,
              unit_price: parseFloat(r.rate) || 0,
              qty: parseFloat(r.hours) || 0,
              amount: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0),
            }))),
            ...(partsItems.map(r => ({
              name: r.name || "Part",
              description: "",
              unit_price: parseFloat(r.unit_price) || 0,
              qty: parseFloat(r.quantity) || 0,
              amount: (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0),
            }))),
          ]}
          paymentHistory={invoice.payment_history || []}
          financials={{
            partsTotal,
            laborTotal,
            subtotal: laborTotal + partsTotal,
            discount: discountValue,
      discount_type: discountType,
            taxRate,
            taxAmount,
            grandTotal,
            amountPaid: invoice.amount_paid || 0,
            balanceDue: invoice.balance_due || 0,
          }}
          notes={[customerNote, techNotes].filter(Boolean).join("\n\n")}
          serviceReason={serviceReason}
        />
      </div>

      {/* ── Action Strip: below print preview, above edit section ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 print:hidden">
        <p className="text-xs text-gray-500 italic">↑ Print preview above · Edit details below</p>
        <div className="flex flex-wrap gap-2">
          {invoice?.status !== "paid" && (
            <button
              onClick={() => setShowCashoutDialog(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-lg shadow-emerald-900/30"
            >
              <CreditCard className="w-4 h-4" />
              Cashout — Record Payment
            </button>
          )}
          {invoice?.status === "paid" && (
            <span className="flex items-center gap-2 text-emerald-400 text-sm font-semibold bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-lg">
              ✓ Paid in Full
            </span>
          )}
          {invoice?.balance_due > 0 && invoice?.status !== "paid" && (
            <span className="text-yellow-400 text-sm font-medium bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 rounded-lg">
              Balance Due: ${(invoice.balance_due || 0).toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Editable Line Items */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-6">
        {/* Invoice Header — matches screenshot layout */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sky-400 text-sm font-semibold mb-0.5">{customer?.full_name || invoice.customer_name}</p>
            <h1 className="text-3xl font-bold text-white">Invoice #{invoice.invoice_number}</h1>
            <p className="text-gray-400 mt-1">{invoice.customer_name}</p>
            {(invoice.customer_phone || customer?.phone) && (
              <a href={`tel:${invoice.customer_phone || customer?.phone}`}
                className="text-sky-400 hover:text-sky-300 text-sm font-semibold mt-1 inline-flex items-center gap-1">
                📞 {formatPhone(invoice.customer_phone || customer?.phone)}
              </a>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            invoice.status === "paid" ? "bg-green-500/20 text-green-400"
            : invoice.status === "partial" ? "bg-yellow-500/20 text-yellow-400"
            : invoice.status === "overdue" ? "bg-red-500/20 text-red-400"
            : "bg-gray-500/20 text-gray-400"
          }`}>
            {invoice.status}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-gray-800">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Vehicle</p>
            <p className="text-white font-bold text-sm">{invoice.vehicle_info || "—"}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Customer</p>
            <p className="text-white font-bold text-sm">{customer?.full_name || invoice.customer_name || "—"}</p>
            {customer?.phone && <p className="text-sky-400 text-xs">{formatPhone(customer.phone)}</p>}
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Invoice Date</p>
            <input type="date" value={invoiceDate}
              onChange={e => setInvoiceDate(e.target.value)}
              className="mt-0.5 w-full rounded-md bg-gray-800 border border-gray-700 text-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Due Date</p>
            <input type="date" value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="mt-0.5 w-full rounded-md bg-gray-800 border border-gray-700 text-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Amount Paid</p>
            <p className="text-emerald-400 font-semibold text-sm">${(invoice.amount_paid || 0).toFixed(2)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Balance Due</p>
            <p className={`font-bold text-sm ${invoice.balance_due > 0 ? "text-yellow-400" : "text-emerald-400"}`}>
              ${(invoice.balance_due || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Labor Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Labor</h2>
            <Button size="sm" variant="ghost" onClick={() => setLaborItems(p => [...p, { description: "", hours: 0, rate: parseFloat(user?.labor_rate) || 0, total: 0 }])}
              className="text-sky-400 hover:text-sky-300 h-7 px-2">
              <Plus className="w-4 h-4 mr-1" /> Add Labor
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
                {laborItems.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-600 text-xs">No labor items — click Add Labor</td></tr>
                )}
                {laborItems.map((row, idx) => (
                  <tr key={idx} className="bg-gray-900">
                    <td className="px-2 py-1.5">
                      <Input value={row.description} autoCapitalize="sentences" onChange={e => updateLabor(idx, "description", toTitleCase(e.target.value))}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Engine Diagnosis" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.hours} onChange={e => updateLabor(idx, "hours", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" step="0.5" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.rate} onChange={e => updateLabor(idx, "rate", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-medium">
                      ${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}
                    </td>
                    <td className="pr-2 py-1.5 text-center">
                      <button onClick={() => setLaborItems(p => p.filter((_, i) => i !== idx))}
                        className="text-gray-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Parts Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Parts</h2>
            <Button size="sm" variant="ghost" onClick={() => setPartsItems(p => [...p, { name: "", quantity: 1, unit_price: 0, total: 0 }])}
              className="text-sky-400 hover:text-sky-300 h-7 px-2">
              <Plus className="w-4 h-4 mr-1" /> Add Part
            </Button>
          </div>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Part Name</th>
                  <th className="px-3 py-2 text-right w-20">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Unit Price</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {partsItems.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-600 text-xs">No parts — click Add Part</td></tr>
                )}
                {partsItems.map((row, idx) => (
                  <tr key={idx} className="bg-gray-900">
                    <td className="px-2 py-1.5">
                      <Input value={row.name} autoCapitalize="words" onChange={e => updatePart(idx, "name", toTitleCase(e.target.value))}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.quantity} onChange={e => updatePart(idx, "quantity", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="1" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.unit_price} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0.00" />
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-300 font-medium">
                      ${((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toFixed(2)}
                    </td>
                    <td className="pr-2 py-1.5 text-center">
                      <button onClick={() => setPartsItems(p => p.filter((_, i) => i !== idx))}
                        className="text-gray-600 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Technician Notes & Reminders */}
        <div className="rounded-xl border border-emerald-800/40 bg-gray-900/60 p-5">
          <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
            🔧 Technician Notes &amp; Reminders
          </h2>
          <TechnicianNotes value={techNotes} onChange={setTechNotes} />
        </div>

        {/* Totals */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
          {/* Individual labor items */}
          {laborItems.map((row, idx) => (
            <div key={`l-${idx}`} className="flex justify-between text-gray-400">
              <span>{row.description || "Labor"} <span className="text-gray-600 text-xs">({row.hours}h × ${parseFloat(row.rate || 0).toFixed(2)}/hr)</span></span>
              <span>${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}</span>
            </div>
          ))}
          {/* Individual parts items */}
          {partsItems.map((row, idx) => (
            <div key={`p-${idx}`} className="flex justify-between text-gray-400">
              <span>{row.name || "Part"} <span className="text-gray-600 text-xs">(x{row.quantity})</span></span>
              <span>${((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0)).toFixed(2)}</span>
            </div>
          ))}
          {/* Discount — $ or % toggle, always visible */}
          <div className="flex items-center justify-between border-t border-gray-700/50 pt-2 gap-3">
            <span className="text-gray-400 text-sm">Discount</span>
            <div className="flex items-center gap-1.5">
              {/* $ / % toggle */}
              <div className="flex rounded-md overflow-hidden border border-gray-700">
                {["$", "%"].map(t => (
                  <button
                    key={t}
                    onClick={() => setDiscountType(t)}
                    className={`px-2.5 py-1 text-xs font-bold transition-colors ${
                      discountType === t
                        ? "bg-rose-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >{t}</button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                max={discountType === "%" ? 100 : undefined}
                step="0.01"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
                onFocus={e => e.target.select()}
                placeholder="0"
                className="w-24 rounded-md bg-gray-800 border border-gray-700 text-rose-400 font-semibold text-sm text-right px-2 py-1 focus:border-sky-500 focus:outline-none"
              />
              {discountAmount > 0 && (
                <span className="text-rose-400 text-sm font-semibold whitespace-nowrap">= -${discountAmount.toFixed(2)}</span>
              )}
            </div>
          </div>
          {taxRate > 0 && (
            <div className="flex items-center justify-between border-t border-gray-700/50 pt-2 gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 text-xs whitespace-nowrap">Tax ({taxRate}%) applies to:</span>
                <div className="flex gap-1">
                  {[
                    { value: "both", label: "Both" },
                    { value: "labor", label: "Labor Only" },
                    { value: "parts", label: "Parts Only" },
                    { value: "none", label: "No Tax" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setTaxAppliesTo(opt.value)}
                      className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                        taxAppliesTo === opt.value
                          ? "bg-sky-500 text-white"
                          : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-gray-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-gray-400 whitespace-nowrap">${taxAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-white font-bold text-base border-t border-gray-700 pt-2">
            <span>Grand Total</span>
            <span className="text-sky-400">${grandTotal.toFixed(2)}</span>
          </div>
          {invoice.amount_paid > 0 && (
            <div className="flex justify-between text-emerald-400"><span>Amount Paid</span><span>${(invoice.amount_paid || 0).toFixed(2)}</span></div>
          )}
          {invoice.balance_due > 0 && (
            <div className="flex justify-between text-yellow-400 font-semibold">
              <span>Balance Due</span>
              <div className="flex items-center gap-3">
                <span>${invoice.balance_due.toFixed(2)}</span>
                {invoice.status !== "paid" && (
                  <button onClick={() => setShowCashoutDialog(true)}
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors">
                    <CreditCard className="w-3 h-3" /> Record Payment
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Parts & Suppliers section placeholder */}
      </div>

      {/* ── Unified Payment Dialog — opened by ALL payment buttons ── */}
      {showCashoutDialog && invoice && (
        <PaymentReceiptDialog
          open={showCashoutDialog}
          onClose={() => setShowCashoutDialog(false)}
          entityName="Invoice"
          invoice={{
            id: invoiceId,
            invoice_number: invoice.invoice_number,
            customer_name: invoice.customer_name,
            vehicle_info: invoice.vehicle_info,
            total: grandTotal,
            amount_paid: invoice.amount_paid || 0,
            balance_due: invoice.balance_due || 0,
            payment_history: invoice.payment_history || [],
            tax_amount: taxAmount,
            tax_rate: taxRate,
            status: invoice.status,
          }}
          onSaved={() => {
            setShowCashoutDialog(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
