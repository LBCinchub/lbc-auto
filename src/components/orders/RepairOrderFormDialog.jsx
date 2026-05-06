import React, { useState, useEffect, useMemo } from "react";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, Loader2 } from "lucide-react";

import CustomerSearchInput from "@/components/shared/CustomerSearchInput";

const statuses = [
  { value: "waiting", label: "Waiting" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_for_parts", label: "Waiting for Parts" },
  { value: "completed", label: "Completed" },
  { value: "delivered", label: "Delivered" },
];

export default function RepairOrderFormDialog({ open, onClose, order, onSaved, onPartAdded, customers, vehicles, mechanics, parts }) {
  const [form, setForm] = useState({
    customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
    mechanic_id: "", mechanic_name: "", description: "", status: "waiting",
    labor_hours: "", labor_items: [{ description: "", hours: "", rate: "120", total: 0 }],
    notes: "", parts_used: [], estimated_completion: "",
    discount_type: "none", discount_value: 0, total_cost: 0, custom_total: false,
    apply_tax: true, tax_applies_to: "both"
  });
  const [saving, setSaving] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(null);
  const queryClient = useQueryClient();
  const [newVehicleForm, setNewVehicleForm] = useState(null);
  const [decodingVin, setDecodingVin] = useState(false);
  const [userTaxRate, setUserTaxRate] = useState(0);
  const [localVehicles, setLocalVehicles] = useState([]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserTaxRate(u?.tax_rate != null ? u.tax_rate : 0);
    });
  }, []);

  // Live cost calculation (only if not custom/saved)
  const mechanic = mechanics.find(m => m.id === form.mechanic_id);
  const laborCost = (form.labor_items || []).reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 120), 0);
  const partsCost = form.parts_used.reduce((sum, p) => sum + (Number(p.unit_price) || 0) * (Number(p.quantity) || 0), 0);
  const TAX_RATE = userTaxRate;
  const subtotal = laborCost + partsCost;
  const discountAmount = form.discount_type === "percentage" 
    ? subtotal * ((form.discount_value || 0) / 100)
    : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
  const afterDiscount = subtotal - discountAmount;

  const taxAppliesTo = form.tax_applies_to || "both";
  let taxableAmount = 0;
  if (taxAppliesTo === "both") taxableAmount = afterDiscount;
  else if (taxAppliesTo === "labor") taxableAmount = laborCost - (form.discount_type !== "none" ? discountAmount : 0);
  else if (taxAppliesTo === "parts") taxableAmount = partsCost;

  const taxAmount = form.apply_tax ? taxableAmount * (TAX_RATE / 100) : 0;
  const calculatedTotal = afterDiscount + taxAmount;
  const totalCost = form.custom_total ? Number(form.total_cost) || 0 : calculatedTotal;

  useEffect(() => {
    if (order && order.id) {
      // Editing an existing repair order
      setForm({
        customer_id: order.customer_id || "",
        customer_name: order.customer_name || "",
        vehicle_id: order.vehicle_id || "",
        vehicle_info: order.vehicle_info || "",
        mechanic_id: order.mechanic_id || "",
        mechanic_name: order.mechanic_name || "",
        description: order.description || "",
        status: order.status || "waiting",
        labor_hours: order.labor_hours || "",
        labor_items: order.labor_items?.length ? order.labor_items.map(i => ({ ...i, rate: String(i.rate ?? 120) })) : [{ description: order.description || "", hours: String(order.labor_hours || ""), rate: "120", total: (order.labor_hours || 0) * 120 }],
        notes: order.notes || "",
        parts_used: order.parts_used || [],
        estimated_completion: order.estimated_completion || "",
        discount_type: order.discount_type || "none",
        discount_value: order.discount_value || 0,
        total_cost: order.total_cost || 0,
        custom_total: order.total_cost ? true : false,
        apply_tax: order.apply_tax !== false,
        tax_applies_to: "both",
      });
    } else {
      // New repair order (possibly pre-filled with customer info from customer profile or appointment)
      setForm({
        customer_id: order?.customer_id || "",
        customer_name: order?.customer_name || "",
        vehicle_id: order?._prefillVehicleId || order?.vehicle_id || "",
        vehicle_info: order?._prefillVehicleInfo || order?.vehicle_info || "",
        mechanic_id: "", mechanic_name: "", description: "", status: "waiting",
        labor_hours: "", labor_items: [{ description: "", hours: "", rate: "120", total: 0 }],
        notes: "", parts_used: [], estimated_completion: "",
        discount_type: "none", discount_value: 0, total_cost: 0, custom_total: false,
        apply_tax: true, tax_applies_to: "both"
      });
    }
  }, [order, open]);

  const allVehicles = React.useMemo(() => {
    const ids = new Set(vehicles.map(v => v.id));
    return [...vehicles, ...localVehicles.filter(v => !ids.has(v.id))];
  }, [vehicles, localVehicles]);

  const customerVehicles = allVehicles.filter(v => v.customer_id === form.customer_id);

  const handleCustomerChange = (id, name) => {
    setForm({ ...form, customer_id: id, customer_name: name || "", vehicle_id: "", vehicle_info: "" });
  };

  const handleVehicleChange = (id) => {
    const v = allVehicles.find(v => v.id === id);
    setForm({ ...form, vehicle_id: id, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" });
  };

  const handleMechanicChange = (id) => {
    const m = mechanics.find(m => m.id === id);
    setForm({ ...form, mechanic_id: id, mechanic_name: m?.name || "" });
  };

  const saveNewCustomer = async () => {
    if (!newCustomerForm?.full_name || !newCustomerForm?.phone) return;
    const created = await base44.entities.Customer.create({
      full_name: newCustomerForm.full_name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || "",
    });
    handleCustomerChange(created.id, created.full_name);
    setNewCustomerForm(null);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
  };

  const decodeVinForNewVehicle = async () => {
    if (!newVehicleForm?.vin || newVehicleForm.vin.length < 11) {
      alert("Please enter a VIN with at least 11 characters.");
      return;
    }
    setDecodingVin(true);
    try {
      const response = await base44.functions.invoke('decodeVin', { vin: newVehicleForm.vin });
      const result = response.data;
      if (result?.make) {
        setNewVehicleForm(prev => ({
          ...prev,
          make: result.make || prev.make,
          model: result.model || prev.model,
          year: result.year || prev.year,
          engine_type: result.engine_type || prev.engine_type,
        }));
      } else {
        alert(result?.error || "Could not decode VIN. Please enter manually.");
      }
    } catch (err) {
      alert("Error decoding VIN: " + (err?.message || "Please try again."));
    } finally {
      setDecodingVin(false);
    }
  };

  const saveNewVehicle = async () => {
    if (!newVehicleForm?.make || !newVehicleForm?.model || !newVehicleForm?.year) return;
    const created = await base44.entities.Vehicle.create({
      customer_id: form.customer_id,
      customer_name: form.customer_name,
      vin: newVehicleForm.vin || "",
      make: newVehicleForm.make,
      model: newVehicleForm.model,
      year: Number(newVehicleForm.year),
      license_plate: newVehicleForm.license_plate || "",
      color: newVehicleForm.color || "",
      engine_type: newVehicleForm.engine_type || "",
    });
    setLocalVehicles(prev => [...prev, created]);
    setForm({ ...form, vehicle_id: created.id, vehicle_info: `${created.year} ${created.make} ${created.model}` });
    setNewVehicleForm(null);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const [partSearches, setPartSearches] = useState({});
  const [newPartForm, setNewPartForm] = useState(null); // null = hidden, {} = open

  const addPart = () => {
    setForm({ ...form, parts_used: [...form.parts_used, { part_id: "", name: "", quantity: 1, unit_price: "", total: 0 }] });
  };

  const saveNewPartToInventory = async () => {
    if (!newPartForm?.name) return;
    const created = await base44.entities.Part.create({
      name: newPartForm.name,
      cost_price: Number(newPartForm.cost_price) || 0,
      sale_price: Number(newPartForm.sale_price) || 0,
      quantity: Number(newPartForm.quantity) || 0,
    });
    if (onPartAdded) onPartAdded();
    setNewPartForm(null);
    // Also add to parts_used
    setForm(f => ({ ...f, parts_used: [...f.parts_used, { part_id: created.id, name: created.name, quantity: 1, unit_price: "", total: 0 }] }));
  };

  const updatePart = (idx, field, value) => {
    const updated = [...form.parts_used];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === "part_id") {
      const p = parts.find(p => p.id === value);
      if (p) {
        updated[idx].name = p.name;
        updated[idx].unit_price = p.sale_price;
      }
    }
    // Always recalculate total
    updated[idx].total = (Number(updated[idx].unit_price) || 0) * (Number(updated[idx].quantity) || 0);
    setForm({ ...form, parts_used: updated });
  };

  const removePart = (idx) => {
    setForm({ ...form, parts_used: form.parts_used.filter((_, i) => i !== idx) });
  };

  const handleSave = async () => {
    if (!form.customer_id || !form.vehicle_id || !form.description) {
      alert('Please fill in Customer, Vehicle, and Description fields');
      return;
    }

    setSaving(true);
    try {
      const laborHours = Number(form.labor_hours) || 0;
      const laborCost = (form.labor_items || []).reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 120), 0);
      const partsCost = form.parts_used.reduce((sum, p) => sum + (p.total || 0), 0);
      const subtotal = laborCost + partsCost;
      const discountAmount = form.discount_type === "percentage" 
        ? subtotal * ((form.discount_value || 0) / 100)
        : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
      const afterDiscount = subtotal - discountAmount;
      const taxAmt = form.apply_tax ? afterDiscount * (userTaxRate / 100) : 0;
      const calculatedTotal = afterDiscount + taxAmt;
      const finalTotal = form.custom_total ? Number(form.total_cost) || 0 : calculatedTotal;

      const timestamp = new Date().toISOString();
      let userEmail = 'system';
      
      try {
        const user = await base44.auth.me();
        userEmail = user?.email || 'system';
      } catch (e) {
        console.warn('Could not fetch user info, using system');
      }

      const data = {
        ...form,
        labor_hours: laborHours,
        labor_cost: laborCost,
        parts_cost: partsCost,
        total_cost: finalTotal,
        custom_total: form.custom_total,
        order_number: order?.order_number || `RO-${Date.now().toString(36).toUpperCase()}`,
      };

      if (order && order.id) {
        const changes = {};
        if (order.status !== data.status) changes.status = { from: order.status, to: data.status };
        if (order.mechanic_name !== data.mechanic_name) changes.mechanic = { from: order.mechanic_name, to: data.mechanic_name };
        if (order.labor_hours !== data.labor_hours) changes.labor_hours = { from: order.labor_hours, to: data.labor_hours };
        if (order.parts_cost !== data.parts_cost) changes.parts_cost = { from: order.parts_cost, to: data.parts_cost };

        const historyEntry = {
          timestamp,
          user: userEmail,
          action: 'updated',
          changes
        };

        data.history = [...(order.history || []), historyEntry];
        await base44.entities.RepairOrder.update(order.id, data);

        // Sync to linked Invoice(s) — update all financials
        try {
          const linkedInvoices = await base44.entities.Invoice.filter({ repair_order_id: order.id });
          for (const inv of linkedInvoices) {
            const newTotal = finalTotal;
            const newBalanceDue = newTotal - (inv.amount_paid || 0);
            await base44.entities.Invoice.update(inv.id, {
              customer_id: data.customer_id,
              customer_name: data.customer_name,
              vehicle_info: data.vehicle_info,
              parts_total: data.parts_cost,
              labor_total: data.labor_cost,
              tax_rate: form.apply_tax ? userTaxRate : 0,
              tax_amount: taxAmt,
              total: newTotal,
              balance_due: newBalanceDue > 0 ? newBalanceDue : 0,
              line_items: [
                ...data.parts_used.filter(p => p.name).map(p => ({ description: p.name, type: "part", quantity: p.quantity, unit_price: p.unit_price, total: p.total })),
                ...data.labor_items.filter(l => l.description).map(l => ({ description: l.description, type: "labor", quantity: l.hours, unit_price: l.rate, total: l.total })),
              ],
              customer_note: inv.customer_note,
            });
          }
        } catch (e) { console.warn("Sync to invoice failed:", e); }

        // Sync to linked Estimate(s) — update all financials
        try {
          const linkedInvoices2 = await base44.entities.Invoice.filter({ repair_order_id: order.id });
          const estimateIds = [...new Set(linkedInvoices2.map(i => i.estimate_id).filter(Boolean))];
          // Also find estimates directly linked via repair_order_id
          const linkedEstimates = await base44.entities.Estimate.filter({ repair_order_id: order.id });
          const allEstimateIds = [...new Set([...estimateIds, ...linkedEstimates.map(e => e.id)])];
          for (const estId of allEstimateIds) {
            const est = await base44.entities.Estimate.get(estId);
            if (est) {
              const estLaborTotal = data.labor_cost;
              const estPartsTotal = data.parts_cost;
              const estTaxAmount = form.apply_tax ? (estLaborTotal + estPartsTotal) * (userTaxRate / 100) : 0;
              await base44.entities.Estimate.update(estId, {
                customer_id: data.customer_id,
                customer_name: data.customer_name,
                vehicle_info: data.vehicle_info,
                labor_total: estLaborTotal,
                parts_total: estPartsTotal,
                tax_rate: form.apply_tax ? userTaxRate : 0,
                tax_amount: estTaxAmount,
                grand_total: estLaborTotal + estPartsTotal + estTaxAmount,
                notes: est.notes,
                labor_items: data.labor_items || est.labor_items,
                parts_items: data.parts_used?.map(p => ({ name: p.name, part_number: p.part_number || "", quantity: p.quantity, unit_price: p.unit_price, total: p.total })) || est.parts_items,
              });
            }
          }
        } catch (e) { console.warn("Sync to estimate failed:", e); }
      } else {
        data.history = [{
          timestamp,
          user: userEmail,
          action: 'created',
          changes: {}
        }];
        await base44.entities.RepairOrder.create(data);
      }
      
      onSaved(data.status);
      onClose();
    } catch (error) {
      console.error('Error saving repair order:', error);
      alert('Failed to save repair order: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? "Edit Repair Order" : "New Repair Order"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
               <Label className="text-gray-400">Customer *</Label>
               {newCustomerForm !== null && (
                 <div className="bg-gray-800 border border-sky-500/30 rounded-lg p-3 space-y-2 mt-1 mb-1">
                   <div className="flex items-center justify-between">
                     <p className="text-xs text-sky-400 font-medium">New Customer</p>
                     <button onClick={() => setNewCustomerForm(null)} className="text-gray-500 hover:text-gray-300">
                       <X className="w-3.5 h-3.5" />
                     </button>
                   </div>
                   <Input value={newCustomerForm.full_name} onChange={e => setNewCustomerForm({...newCustomerForm, full_name: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Full name *" />
                   <Input value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Phone number *" />
                   <Input value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Email" />
                   <div className="flex gap-2">
                     <Button size="sm" onClick={saveNewCustomer} disabled={!newCustomerForm.full_name || !newCustomerForm.phone} className="bg-sky-500 hover:bg-sky-600 text-white flex-1">Save</Button>
                   </div>
                 </div>
               )}
               <div className="mt-1">
                 <CustomerSearchInput customers={customers} value={form.customer_id} onChange={handleCustomerChange} />
                 <button onClick={() => setNewCustomerForm({ full_name: "", phone: "", email: "" })}
                   className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2">
                   <Plus className="w-3 h-3" /> New customer
                 </button>
               </div>
             </div>
             <div>
               <Label className="text-gray-400">Vehicle *</Label>
               {newVehicleForm !== null ? (
                 <div className="bg-gray-800 border border-sky-500/30 rounded-lg p-2 mt-1 space-y-2">
                   <input value={newVehicleForm.vin} onChange={e => setNewVehicleForm({...newVehicleForm, vin: e.target.value})}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="VIN (optional)" />
                   {newVehicleForm.vin && (
                     <Button size="sm" onClick={decodeVinForNewVehicle} disabled={decodingVin || newVehicleForm.vin.length < 11} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs">
                       {decodingVin ? <><Loader2 className="w-3 h-3 animate-spin" /> Decoding...</> : "Decode VIN"}
                     </Button>
                   )}
                   <input value={newVehicleForm.year} onChange={e => setNewVehicleForm({...newVehicleForm, year: e.target.value})}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="Year *" />
                   <input value={newVehicleForm.make} onChange={e => setNewVehicleForm({...newVehicleForm, make: e.target.value})}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="Make *" />
                   <input value={newVehicleForm.model} onChange={e => setNewVehicleForm({...newVehicleForm, model: e.target.value})}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="Model *" />
                   <input value={newVehicleForm.license_plate} onChange={e => setNewVehicleForm({...newVehicleForm, license_plate: e.target.value})}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="License plate" />
                   <div className="flex gap-2">
                     <Button size="sm" onClick={saveNewVehicle} disabled={!newVehicleForm.year || !newVehicleForm.make || !newVehicleForm.model} className="bg-sky-500 hover:bg-sky-600 text-white flex-1">Save</Button>
                     <Button size="sm" variant="ghost" onClick={() => setNewVehicleForm(null)} className="text-gray-400 flex-1">Cancel</Button>
                   </div>
                 </div>
               ) : (
                 <div>
                   <Select value={form.vehicle_id} onValueChange={handleVehicleChange}>
                     <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                       <SelectValue placeholder="Select vehicle" />
                     </SelectTrigger>
                     <SelectContent className="bg-gray-800 border-gray-700">
                       {customerVehicles.map(v => (
                         <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                       ))}
                       {form.customer_id && customerVehicles.length === 0 && (
                         <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", license_plate: "", color: "", engine_type: "" })}
                           className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm">
                           <Plus className="w-3.5 h-3.5" /> Add vehicle
                         </button>
                       )}
                     </SelectContent>
                   </Select>
                   {form.customer_id && customerVehicles.length > 0 && (
                   <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", license_plate: "", color: "", engine_type: "" })}
                   className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2">
                   <Plus className="w-3 h-3" /> Add vehicle
                   </button>
                   )}
                 </div>
               )}
             </div>
           </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Mechanic</Label>
              <Select value={form.mechanic_id} onValueChange={handleMechanicChange}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Assign mechanic" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {mechanics.map(m => <SelectItem key={m.id} value={m.id}>{m.name} (${m.hourly_rate}/hr)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {statuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Job Description *</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={3} />
          </div>

          {/* Labor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Labor</Label>
              <Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, labor_items: [...(f.labor_items || []), { description: "", hours: "", rate: "120", total: 0 }] }))}
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
                  {(form.labor_items || [{ description: "", hours: form.labor_hours || "", total: (Number(form.labor_hours) || 0) * 120 }]).map((row, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <Input value={row.description} onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], description: e.target.value };
                          setForm(f => ({ ...f, labor_items: items }));
                        }} className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Engine Diagnosis" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" value={row.hours} onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], hours: e.target.value, total: (parseFloat(e.target.value) || 0) * (parseFloat(items[idx].rate) || 120) };
                          const totalHours = items.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
                          setForm(f => ({ ...f, labor_items: items, labor_hours: totalHours }));
                        }} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" step="0.5" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" value={row.rate ?? "120"} onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], rate: e.target.value, total: (parseFloat(items[idx].hours) || 0) * (parseFloat(e.target.value) || 0) };
                          setForm(f => ({ ...f, labor_items: items }));
                        }} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" step="1" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.hours) || 0) * (parseFloat(row.rate) || 120)).toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => {
                          const items = (form.labor_items || []).filter((_, i) => i !== idx);
                          const totalHours = items.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
                          setForm(f => ({ ...f, labor_items: items, labor_hours: totalHours }));
                        }} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Est. Completion</Label>
            <Input type="date" value={form.estimated_completion} onChange={e => setForm({ ...form, estimated_completion: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>

          {/* Parts section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Parts Used</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNewPartForm({ name: "", cost_price: "", sale_price: "", quantity: 0 })} className="text-amber-400 hover:text-amber-300 gap-1 text-xs h-7 px-2">
                  <Plus className="w-3 h-3" /> Add to Inventory
                </Button>
                <Button size="sm" variant="ghost" onClick={addPart} className="text-sky-400 hover:text-sky-300 h-7 px-2">
                  <Plus className="w-4 h-4 mr-1" /> Add Row
                </Button>
              </div>
            </div>
            {newPartForm !== null && (
              <div className="bg-gray-800 border border-amber-500/30 rounded-lg p-3 mb-3 space-y-2">
                <p className="text-xs text-amber-400 font-medium">New Part — Add to Inventory</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newPartForm.name} onChange={e => setNewPartForm(f => ({...f, name: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white col-span-2" placeholder="Part name *" />
                  <Input type="number" value={newPartForm.cost_price} onChange={e => setNewPartForm(f => ({...f, cost_price: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Cost price" />
                  <Input type="number" value={newPartForm.sale_price} onChange={e => setNewPartForm(f => ({...f, sale_price: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Sale price" />
                  <Input type="number" value={newPartForm.quantity} onChange={e => setNewPartForm(f => ({...f, quantity: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Stock qty" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNewPartToInventory} disabled={!newPartForm.name} className="bg-amber-500 hover:bg-amber-600 text-black">Save & Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setNewPartForm(null)} className="text-gray-400">Cancel</Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-500 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Part Name</th>
                    <th className="px-3 py-2 text-left w-36">From Inventory</th>
                    <th className="px-3 py-2 text-right w-20">Qty</th>
                    <th className="px-3 py-2 text-right w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {form.parts_used.map((pu, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <Input value={pu.name} onChange={e => updatePart(idx, "name", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="Part name..." />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={pu.part_id} onValueChange={v => { updatePart(idx, "part_id", v); setPartSearches(s => ({...s, [idx]: ""})); }}>
                          <SelectTrigger className="bg-gray-800 border-0 text-white h-8 text-xs">
                            <SelectValue placeholder="Inventory..." />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <div className="px-2 pb-1">
                              <Input
                                value={partSearches[idx] || ""}
                                onChange={e => setPartSearches(s => ({...s, [idx]: e.target.value}))}
                                className="bg-gray-700 border-gray-600 text-white h-7 text-xs"
                                placeholder="Search..."
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                              />
                            </div>
                            {parts.filter(p => !partSearches[idx] || fuzzyMatch(partSearches[idx], [p.name, p.part_number, p.supplier, p.category])).map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" value={pu.quantity} onChange={e => updatePart(idx, "quantity", Number(e.target.value))}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" min="1" placeholder="1" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" value={pu.unit_price || ""} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" step="0.01" placeholder="0.00" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${(pu.total || 0).toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => removePart(idx)} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={2} />
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

          {/* Cost Summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 font-medium text-xs uppercase tracking-wider">{form.custom_total ? "Fixed Cost" : "Estimated Cost"}</p>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, apply_tax: !f.apply_tax }))}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                    form.apply_tax
                      ? "bg-sky-500/20 border-sky-500 text-sky-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${form.apply_tax ? "bg-sky-400" : "bg-gray-600"}`} />
                  Tax {TAX_RATE}%
                </button>
                {form.apply_tax && (
                  <Select value={form.tax_applies_to || "both"} onValueChange={v => setForm(f => ({ ...f, tax_applies_to: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-20 h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="parts">Parts</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            {!form.custom_total ? (
              <>
                <div className="flex justify-between text-gray-400">
                  <span>Labor ({form.labor_hours || 0}h)</span>
                  <span className="text-white">${laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Parts</span>
                  <span className="text-white">${partsCost.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount {form.discount_type === "percentage" ? `(${form.discount_value}%)` : ""}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Tax ({TAX_RATE}%)</span>
                  <span className={form.apply_tax ? "" : "line-through opacity-50"}>{form.apply_tax ? `$${taxAmount.toFixed(2)}` : "Not applied"}</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-500 italic">Cost locked (will not recalculate)</p>
            )}
            <div className="flex justify-between font-bold text-base border-t border-gray-700 pt-2 mt-2">
              <span className="text-white">Total</span>
              <span className="text-emerald-400">${totalCost.toFixed(2)}</span>
            </div>
            {order && (
              <div className="pt-2 mt-2 border-t border-gray-700">
                <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={form.custom_total} onChange={e => setForm({...form, custom_total: e.target.checked})}
                    className="w-4 h-4 rounded" />
                  <span className="text-xs">Lock this total (don't recalculate)</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.customer_id || !form.vehicle_id || !form.description}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}