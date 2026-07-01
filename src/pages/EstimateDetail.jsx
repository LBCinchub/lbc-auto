import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { syncCustomerActivity } from "@/utils/syncCustomerActivity";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CreditCard, CheckCircle2, Plus, Trash2, Save, Loader2, Printer, Share2, History } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PaymentHistoryManager from "@/components/invoices/PaymentHistoryManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PrintTemplate from "@/components/shared/PrintTemplate";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";


// Auto-capitalise: first letter of every word
const toTitleCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());
const capWords = (e, setter, key) => {
  const val = toTitleCase(e.target.value);
  if (key) setter(p => ({ ...p, [key]: val }));
  else setter(val);
};

export default function EstimateDetail() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showCashoutDialog, setShowCashoutDialog] = useState(false);
  const [showHistoryManager, setShowHistoryManager] = useState(false);
  
  // Editable line items state
  const [laborItems, setLaborItems] = useState([]);
  const [partsItems, setPartsItems] = useState([]);
  const [taxAppliesTo, setTaxAppliesTo] = useState("both");
  const [initialized, setInitialized] = useState(false);
  const [estimateDate, setEstimateDate] = useState("");
  const [estimateNotes, setEstimateNotes] = useState("");
  const [estimateServiceReason, setEstimateServiceReason] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState("$"); // "$" or "%"

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: estimate, isLoading } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: () => base44.entities.Estimate.get(estimateId),
    enabled: !!estimateId,
  });

  const { data: customer } = useQuery({
    queryKey: ["customer", estimate?.customer_id],
    queryFn: () => base44.entities.Customer.get(estimate.customer_id),
    enabled: !!estimate?.customer_id,
  });

  const { data: vehicleRecord } = useQuery({
    queryKey: ["vehicle", estimate?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.get(estimate.vehicle_id),
    enabled: !!estimate?.vehicle_id,
  });

  // Initialize editable state from estimate data once loaded
  useEffect(() => {
    if (estimate && !initialized) {
      setLaborItems(
        (estimate.labor_items || []).map(i => ({ 
          description: i.description || "", 
          hours: i.hours || 0, 
          rate: i.rate || 0, 
          total: i.total || 0 
        }))
      );
      setPartsItems(
        (estimate.parts_items || []).map(i => ({
          name: i.name || "",
          part_number: i.part_number || "",
          quantity: i.quantity || 0,
          unit_price: i.unit_price || 0,
          total: i.total || 0
        }))
      );
      setTaxAppliesTo(estimate.tax_applies_to || "both");
      setEstimateDate(estimate.estimate_date || estimate.created_date?.split("T")[0] || "");
      setEstimateNotes(estimate.notes || "");
      setEstimateServiceReason(estimate.service_reason || "");
      setInitialized(true);
    }
  }, [estimate, initialized]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="h-40 rounded-xl bg-gray-800/30 animate-pulse" />
      </div>
    );
  }

  if (!estimate) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Estimate not found</p>
      </div>
    );
  }

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
  const taxRate = estimate?.tax_rate ?? (user?.tax_rate ?? 0);
  const taxableBase = taxAppliesTo === "labor" ? laborTotal
    : taxAppliesTo === "parts" ? partsTotal
    : taxAppliesTo === "none" ? 0
    : laborTotal + partsTotal; // "both"
  const taxAmount = taxableBase * (taxRate / 100);
  const discountValue = parseFloat(discount) || 0;
  const discountAmount = discountType === "%" ? (subtotal * discountValue / 100) : discountValue;
  const grandTotal = Math.max(0, subtotal - discountAmount + taxAmount);

  // ── Share / Print ────────────────────────────────────────────────────────
  const handleShare = async () => {
    const title = `Estimate #${estimate?.estimate_number} — ${estimate?.customer_name || ""}`;
    const text  = `Estimate #${estimate?.estimate_number}\nVehicle: ${estimate?.vehicle_info || ""}\nTotal: $${(estimate?.grand_total || 0).toFixed(2)}\n${estimate?.service_reason ? "Reason: " + estimate.service_reason + "\n" : ""}\nThank you for choosing us!`;
    if (navigator.share) {
      try { await navigator.share({ title, text }); } catch (_) {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard ✓", description: "Estimate summary copied — paste anywhere to share." });
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

  const handleSave = async () => {
    setSaving(true);
    const updatedLaborItems = laborItems.map(r => ({ description: r.description, hours: parseFloat(r.hours) || 0, rate: parseFloat(r.rate) || 0, total: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0) }));
    const updatedPartsItems = partsItems.map(r => ({ name: r.name, part_number: r.part_number || "", quantity: parseFloat(r.quantity) || 0, unit_price: parseFloat(r.unit_price) || 0, total: (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0) }));

    await base44.entities.Estimate.update(estimateId, {
      labor_items: updatedLaborItems,
      parts_items: updatedPartsItems,
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_amount: taxAmount,
      tax_applies_to: taxAppliesTo,
      grand_total: grandTotal,
      estimate_date: estimateDate,
      notes: estimateNotes,
      service_reason: estimateServiceReason,
    });

    // FIX 1: Sync to linked Repair Orders (by estimate_id)
    try {
      const linkedROs = await base44.entities.RepairOrder.filter({ estimate_id: estimateId });
      for (const ro of linkedROs) {
        const roLaborCost = updatedLaborItems.reduce((s, l) => s + l.total, 0);
        const roPartsCost = updatedPartsItems.reduce((s, p) => s + p.total, 0);
        await base44.entities.RepairOrder.update(ro.id, {
          customer_name: estimate.customer_name,
          vehicle_info: estimate.vehicle_info,
          labor_items: updatedLaborItems,
          labor_cost: roLaborCost,
          labor_hours: updatedLaborItems.reduce((s, l) => s + l.hours, 0),
          parts_used: updatedPartsItems.map(p => ({ name: p.name, part_number: p.part_number || "", quantity: p.quantity, unit_price: p.unit_price, total: p.total })),
          parts_cost: roPartsCost,
          total_cost: roLaborCost + roPartsCost,
        });
      }
      if (linkedROs.length > 0) toast({ title: "Repair Order also updated" });
    } catch (e) { console.warn("Estimate→RO sync failed:", e); }

    // FIX 3: Sync to linked Invoices (by estimate_id)
    try {
      const linkedInvoices = await base44.entities.Invoice.filter({ estimate_id: estimateId });
      const lineItems = [
        ...updatedPartsItems.filter(p => p.name).map(p => ({ description: p.name, type: "part", quantity: p.quantity, unit_price: p.unit_price, total: p.total })),
        ...updatedLaborItems.filter(l => l.description).map(l => ({ description: l.description, type: "labor", quantity: l.hours, unit_price: l.rate, total: l.total })),
      ];
      for (const inv of linkedInvoices) {
        const newTotal = grandTotal;
        const newBalanceDue = newTotal - (inv.amount_paid || 0);
        await base44.entities.Invoice.update(inv.id, {
          customer_name: estimate.customer_name,
          vehicle_info: estimate.vehicle_info,
          line_items: lineItems,
          labor_total: laborTotal,
          parts_total: partsTotal,
          tax_amount: taxAmount,
          total: newTotal,
          balance_due: newBalanceDue > 0 ? newBalanceDue : 0,
        });
      }
      if (linkedInvoices.length > 0) toast({ title: "Invoice also updated" });
    } catch (e) { console.warn("Estimate→Invoice sync failed:", e); }

    // ── CENTER CONTROL — sync to Customer record ──────────────────────────────
    try {
      await syncCustomerActivity({
        customerId: estimate.customer_id,
        vehicleId: estimate.vehicle_id,
        vehicleInfo: estimate.vehicle_info,
        customerName: estimate.customer_name,
        customerPhone: estimate.customer_phone,
        customerEmail: estimate.customer_email,
        isNewVisit: false,
      });
    } catch(e) { /* non-fatal */ }

    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 3000);
  };

  const handleConvertToInvoice = async () => {
    if (!window.confirm("Convert this estimate to an invoice?")) return;
    try {
      const lineItems = [
        ...(estimate.parts_items || []).map(p => ({
          description: p.name,
          type: "part",
          quantity: p.quantity || 1,
          unit_price: p.unit_price || 0,
          total: p.total || 0,
        })),
        ...(estimate.labor_items || []).map(l => ({
          description: l.description || "Labor",
          type: "labor",
          quantity: l.hours || 1,
          unit_price: l.rate || 0,
          total: l.total || 0,
        })),
      ];
      const inv = await base44.entities.Invoice.create({
        estimate_id: estimate.id,
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_info: estimate.vehicle_info,
        line_items: lineItems,
        parts_total: estimate.parts_total || 0,
        labor_total: estimate.labor_total || 0,
        tax_rate: estimate.tax_rate || 0,
        tax_amount: estimate.tax_amount || 0,
        total: estimate.grand_total || 0,
        balance_due: estimate.grand_total || 0,
        amount_paid: 0,
        status: "unpaid",
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      navigate(`/InvoiceDetail/${inv.id}`);
    } catch (error) {
      console.error("Error converting estimate to invoice:", error);
    }
  };

  const handleConvertToRepairOrder = async () => {
    if (!window.confirm("Convert this estimate to a repair order?")) return;
    try {
      await base44.entities.RepairOrder.create({
        estimate_id: estimate.id,
        customer_id: estimate.customer_id,
        customer_name: estimate.customer_name,
        vehicle_id: estimate.vehicle_id,
        vehicle_info: estimate.vehicle_info,
        description: estimate.notes || "Created from estimate #" + estimate.estimate_number,
        status: "waiting",
        labor_hours: estimate.labor_items?.reduce((sum, item) => sum + (parseFloat(item.hours) || 0), 0) || 0,
        labor_cost: estimate.labor_total || 0,
        labor_items: estimate.labor_items || [],
        parts_used: estimate.parts_items?.map(item => ({
          name: item.name,
          part_number: item.part_number || "",
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        })) || [],
        parts_cost: estimate.parts_total || 0,
        total_cost: estimate.grand_total || 0,
      });
      await base44.entities.Estimate.update(estimate.id, { status: "approved" });
      queryClient.invalidateQueries({ queryKey: ["estimates", "repairOrders"] });
      navigate("/RepairOrders");
    } catch (error) {
      console.error("Error converting estimate:", error);
    }
  };

  // Build line items for print template
  const lineItems = [];
  (estimate.parts_items || []).forEach(p => {
    lineItems.push({
      name: p.name,
      description: p.part_number ? `Part #: ${p.part_number}` : "",
      unit_price: p.unit_price || 0,
      qty: p.quantity || 1,
      amount: p.total || (p.unit_price || 0) * (p.quantity || 1),
    });
  });
  (estimate.labor_items || []).forEach(l => {
    lineItems.push({
      name: l.description || "Labor",
      description: `${l.hours}h @ $${(l.rate || 0).toFixed(2)}/hr`,
      unit_price: l.rate || 0,
      qty: l.hours || 0,
      amount: l.total || 0,
    });
  });

  const financials = {
    partsTotal: estimate.parts_total || 0,
    laborTotal: estimate.labor_total || 0,
    subtotal: (estimate.parts_total || 0) + (estimate.labor_total || 0),
    taxRate: estimate.tax_rate || 0,
    taxAmount: estimate.tax_amount || 0,
    taxAppliesTo: estimate.tax_applies_to || "both",
    grandTotal: estimate.grand_total || 0,
    amountPaid: 0,
    balanceDue: estimate.grand_total || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header + Action Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex flex-wrap gap-2">
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
          {/* Save */}
          <Button size="sm" onClick={handleSave} disabled={saving}
            className="bg-sky-500 hover:bg-sky-600 gap-1.5 h-9 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {estimate.status === "approved" && (
            <Button size="sm" onClick={handleConvertToInvoice}
              className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 h-9 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Convert to Invoice
            </Button>
          )}
          {estimate.status !== "approved" && (
            <Button size="sm" onClick={handleConvertToRepairOrder}
              className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-1.5 h-9 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" /> Convert to Repair Order
            </Button>
          )}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #estimate-print-area { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; background: white; }
          #estimate-print-area * { display: revert !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
      <div id="estimate-print-area" className="rounded-xl border border-gray-800/50 bg-white p-8">
        <PrintTemplate
          type="Estimate"
          docNumber={estimate.estimate_number}
          createdDate={new Date((estimateDate || estimate.created_date) + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          user={user}
          customer={{ name: estimate.customer_name || customer?.full_name || "—", phone: customer?.phone, email: customer?.email, address: customer?.address }}
          vehicle={{ info: estimate.vehicle_info, vin: vehicleRecord?.vin, license_plate: vehicleRecord?.license_plate, color: vehicleRecord?.color, make: vehicleRecord?.make, model: vehicleRecord?.model, year: vehicleRecord?.year, engine_type: vehicleRecord?.engine_type, mileage: vehicleRecord?.mileage //icleRecord?.color, mileage: vehicleRecord?.mileage }}
          lineItems={[
            ...laborItems.map(l => ({ name: l.description || "Labor", description: `${parseFloat(l.hours)||0}h @ $${parseFloat(l.rate)||0}/hr`, qty: parseFloat(l.hours) || 0, unit_price: parseFloat(l.rate) || 0 })),
            ...partsItems.map(p => ({ name: p.name || "Part", description: p.part_number ? `Part #: ${p.part_number}` : "", qty: parseFloat(p.quantity) || 0, unit_price: parseFloat(p.unit_price) || 0 }))
          ]}
          paymentHistory={[]}
          financials={{ laborTotal, partsTotal, subtotal, discount: discountAmount, discountType, taxRate, taxAmount, grandTotal }}
          notes={estimateNotes}
          serviceReason={estimateServiceReason}
        />
      </div>

      {/* ── Section divider ── */}
      <div className="flex items-center gap-3 px-1 mb-2 print:hidden">
        <p className="text-xs text-gray-500 italic">↑ Print preview above · Edit details below</p>
        <div className="flex-1 border-t border-gray-800" />
      </div>

      {/* Editable Line Items */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-6">
        {/* Estimate Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Estimate #{estimate.estimate_number}</h1>
            <button onClick={() => estimate.customer_id && navigate(`/CustomerDetails?id=${estimate.customer_id}`)} className="text-sky-400 hover:text-sky-300 hover:underline mt-1 text-left transition-colors font-medium">{estimate.customer_name}</button>
            {estimate.vehicle_info && <button onClick={() => estimate.vehicle_id && navigate(`/VehicleTimeline/${estimate.vehicle_id}`)} className="text-emerald-400 hover:text-emerald-300 hover:underline text-sm font-medium text-left transition-colors mt-0.5 block">{estimate.vehicle_info} 🚗</button>}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            estimate.status === "approved" ? "bg-green-500/20 text-green-400"
            : estimate.status === "sent" ? "bg-blue-500/20 text-blue-400"
            : estimate.status === "declined" ? "bg-red-500/20 text-red-400"
            : estimate.status === "expired" ? "bg-gray-500/20 text-gray-400"
            : "bg-gray-500/20 text-gray-400"
          }`}>
            {estimate.status}
          </span>
        </div>

        {/* Editable Date / Reason / Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Estimate Date</p>
            <input type="date" value={estimateDate}
              onChange={e => setEstimateDate(e.target.value)}
              className="w-full rounded-md bg-gray-800 border border-gray-700 text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>
          <div>
            <p className="text-gray-500 text-xs uppercase mb-1">Reason for Visit</p>
            <input type="text" value={estimateServiceReason}
              onChange={e => setEstimateServiceReason(e.target.value)}
              placeholder="e.g. Engine light on, oil change..."
              className="w-full rounded-md bg-gray-800 border border-gray-700 text-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-gray-600" />
          </div>
          <div className="sm:col-span-2">
            <p className="text-gray-500 text-xs uppercase mb-1">Notes (shown on print)</p>
            <textarea value={estimateNotes} rows={2}
              onChange={e => setEstimateNotes(e.target.value)}
              placeholder="Additional notes for the customer..."
              className="w-full rounded-md bg-gray-800 border border-gray-700 text-white px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-gray-600" />
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
            <Button size="sm" variant="ghost" onClick={() => setPartsItems(p => [...p, { name: "", part_number: "", quantity: 0, unit_price: 0, total: 0 }])}
              className="text-sky-400 hover:text-sky-300 h-7 px-2">
              <Plus className="w-4 h-4 mr-1" /> Add Part
            </Button>
          </div>
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/60 text-gray-500 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Part Name</th>
                  <th className="px-3 py-2 text-left w-28">Part #</th>
                  <th className="px-3 py-2 text-right w-20">Qty</th>
                  <th className="px-3 py-2 text-right w-24">Unit Price</th>
                  <th className="px-3 py-2 text-right w-24">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {partsItems.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-600 text-xs">No parts — click Add Part</td></tr>
                )}
                {partsItems.map((row, idx) => (
                  <tr key={idx} className="bg-gray-900">
                    <td className="px-2 py-1.5">
                      <Input value={row.name} autoCapitalize="words" onChange={e => updatePart(idx, "name", toTitleCase(e.target.value))}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={row.part_number} onChange={e => updatePart(idx, "part_number", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="SKU" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={row.quantity} onChange={e => updatePart(idx, "quantity", e.target.value)}
                        className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" />
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

        {/* Totals */}
        <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
          {laborItems.map((row, idx) => (
            <div key={`l-${idx}`} className="flex justify-between text-gray-400">
              <span>{row.description || "Labor"} <span className="text-gray-600 text-xs">({row.hours}h × ${parseFloat(row.rate || 0).toFixed(2)}/hr)</span></span>
              <span>${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 0)).toFixed(2)}</span>
            </div>
          ))}
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
        </div>
      </div>
      {/* Payment History Manager */}
      {showHistoryManager && estimate?.linked_invoice_id && (
        <PaymentHistoryManager
          open={showHistoryManager}
          onClose={() => setShowHistoryManager(false)}
          invoice={{ ...estimate, id: estimate.linked_invoice_id, total: estimate.total || grandTotal }}
          onSaved={() => {
            setShowHistoryManager(false);
            queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
          }}
        />
      )}

      {/* Cashout Dialog */}
      {showCashoutDialog && estimate && (
        <PaymentReceiptDialog
          open={showCashoutDialog}
          onClose={() => setShowCashoutDialog(false)}
          invoice={{
            id: estimate.id,
            invoice_number: estimate.estimate_number,
            customer_id: estimate.customer_id || "",
            customer_name: estimate.customer_name,
            vehicle_info: estimate.vehicle_info,
            total: estimate.total || estimate.grand_total || grandTotal,
            labor_cost: laborTotal,
            parts_cost: partsTotal,
            tax_amount: taxAmount,
            amount_paid: 0,
            balance_due: estimate.total || estimate.grand_total || grandTotal,
            payment_history: [],
          }}
          entityName="Estimate"
          onSaved={() => {
            setShowCashoutDialog(false);
            queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
            queryClient.invalidateQueries({ queryKey: ["estimates"] });
          }}
        />
      )}

      {/* ── BOTTOM SAVE BAR ── */}
      <div className="no-print mt-6 mb-2">
        <div>
          <div style={{
            background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
            border: "1px solid rgba(99,179,237,0.15)",
            borderRadius: "12px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}>
            {/* Status pill */}
            <div style={{
              background: estimate.status === "approved" ? "rgba(74,222,128,0.1)" : estimate.status === "sent" ? "rgba(99,179,237,0.1)" : "rgba(148,163,184,0.1)",
              border: `1px solid ${estimate.status === "approved" ? "rgba(74,222,128,0.3)" : estimate.status === "sent" ? "rgba(99,179,237,0.3)" : "rgba(148,163,184,0.2)"}`,
              borderRadius: "20px", padding: "4px 12px",
              color: estimate.status === "approved" ? "#4ade80" : estimate.status === "sent" ? "#38bdf8" : "#94a3b8",
              fontSize: "12px", fontWeight: 700, textTransform: "capitalize", flexShrink: 0,
            }}>{estimate.status || "draft"}</div>

            {/* Total info */}
            <div style={{ flex: 1, display: "flex", gap: "16px", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: "12px" }}>Total <strong style={{ color: "#38bdf8" }}>${grandTotal.toFixed(2)}</strong></span>
              <span style={{ color: "#64748b", fontSize: "12px" }}>Labor <strong style={{ color: "#a78bfa" }}>${laborTotal.toFixed(2)}</strong></span>
              <span style={{ color: "#64748b", fontSize: "12px" }}>Parts <strong style={{ color: "#fb923c" }}>${partsTotal.toFixed(2)}</strong></span>
            </div>

            {/* Edit Payment History — only if payments exist */}
            {(estimate?.payment_history?.length > 0 || estimate?.amount_paid > 0) && (
              <button
                onClick={() => setShowHistoryManager(true)}
                style={{
                  background: "linear-gradient(135deg,#854d0e,#713f12)",
                  border: "1px solid rgba(234,179,8,0.3)",
                  color: "#fbbf24", borderRadius: "10px",
                  padding: "8px 14px", fontSize: "13px", fontWeight: 700,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
                }}
              >
                <History style={{ width: 14, height: 14 }} /> Edit Payments
              </button>
            )}

            {/* Cashout */}
            <button
              onClick={() => setShowCashoutDialog(true)}
              style={{
                background: "linear-gradient(135deg,#16a34a,#15803d)",
                color: "#fff", border: "none", borderRadius: "10px",
                padding: "8px 16px", fontSize: "13px", fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                boxShadow: "0 4px 12px rgba(22,163,74,0.4)", flexShrink: 0,
              }}
            >
              <CreditCard style={{ width: 14, height: 14 }} /> Cashout
            </button>

            {/* Save Changes */}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: savedOk ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3b82f6,#2563eb)",
                color: "#fff", border: "none", borderRadius: "10px",
                padding: "8px 20px", fontSize: "13px", fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                boxShadow: savedOk ? "0 4px 12px rgba(34,197,94,0.4)" : "0 4px 12px rgba(59,130,246,0.4)",
                opacity: saving ? 0.7 : 1, flexShrink: 0,
                transition: "all 0.3s ease",
              }}
            >
              {saving ? (
                <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Saving...</>
              ) : savedOk ? (
                <><CheckCircle2 style={{ width: 14, height: 14 }} /> Saved ✓</>
              ) : (
                <><Save style={{ width: 14, height: 14 }} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}