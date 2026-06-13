import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PrintTemplate from "@/components/shared/PrintTemplate";

export default function EstimateDetail() {
  const { estimateId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Editable line items state
  const [laborItems, setLaborItems] = useState([]);
  const [partsItems, setPartsItems] = useState([]);
  const [taxAppliesTo, setTaxAppliesTo] = useState("both");
  const [initialized, setInitialized] = useState(false);

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
  const grandTotal = subtotal + taxAmount;

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

    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    setSaving(false);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex gap-2">
           <Button onClick={handleSave} disabled={saving} className="bg-sky-500 hover:bg-sky-600 gap-2">
             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
             {saving ? "Saving..." : "Save Changes"}
           </Button>
           {estimate.status === "approved" && (
             <Button onClick={handleConvertToInvoice} className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2">
               <CheckCircle2 className="w-4 h-4" /> Convert to Invoice
             </Button>
           )}
           {estimate.status !== "approved" && (
             <Button onClick={handleConvertToRepairOrder} className="bg-green-500/20 text-green-400 hover:bg-green-500/30 gap-2">
               <CheckCircle2 className="w-4 h-4" /> Convert to Repair Order
             </Button>
           )}
         </div>
      </div>

      <div className="rounded-xl border border-gray-800/50 bg-white p-8">
        <PrintTemplate
          type="Estimate"
          docNumber={estimate.estimate_number}
          createdDate={new Date(estimate.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          user={user}
          customer={{ name: estimate.customer_name || customer?.full_name || "—", phone: customer?.phone, email: customer?.email, address: customer?.address }}
          vehicle={{ info: estimate.vehicle_info, vin: vehicleRecord?.vin, license_plate: vehicleRecord?.license_plate, color: vehicleRecord?.color, mileage: vehicleRecord?.mileage }}
          lineItems={[
            ...laborItems.map(l => ({ name: l.description || "Labor", description: `${parseFloat(l.hours)||0}h @ $${parseFloat(l.rate)||0}/hr`, qty: parseFloat(l.hours) || 0, unit_price: parseFloat(l.rate) || 0 })),
            ...partsItems.map(p => ({ name: p.name || "Part", description: p.part_number ? `Part #: ${p.part_number}` : "", qty: parseFloat(p.quantity) || 0, unit_price: parseFloat(p.unit_price) || 0 }))
          ]}
          paymentHistory={[]}
          financials={{ laborTotal, partsTotal, taxRate, taxAmount, grandTotal }}
          notes={estimate.notes}
        />
      </div>

      {/* Editable Line Items */}
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-6 space-y-6">
        {/* Estimate Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Estimate #{estimate.estimate_number}</h1>
            <p className="text-gray-400 mt-1">{estimate.customer_name}</p>
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

        {/* Labor Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Labor</h2>
            <Button size="sm" variant="ghost" onClick={() => setLaborItems(p => [...p, { description: "", hours: 0, rate: 0, total: 0 }])}
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
                      <Input value={row.description} onChange={e => updateLabor(idx, "description", e.target.value)}
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
                      <Input value={row.name} onChange={e => updatePart(idx, "name", e.target.value)}
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
      </div>{/* end editable section */}
      </div>
      );
      }