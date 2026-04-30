import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, X, Search } from "lucide-react";

const emptyLaborRow = () => ({ description: "", hours: "", rate: "120", total: 0 });
const emptyPartRow  = () => ({ name: "", part_number: "", quantity: "", unit_price: "", total: 0 });

const emptyForm = {
  customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
  status: "draft", notes: "", tax_rate: "0", apply_tax: true, tax_applies_to: "both", valid_until: "",
  labor_items: [emptyLaborRow()],
  parts_items: [emptyPartRow()],
  repair_order_id: "",
};

export default function EstimateFormDialog({ open, onClose, estimate, customers, vehicles, parts = [], repairOrderId, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(null);
  const queryClient = useQueryClient();
  const [newVehicleForm, setNewVehicleForm] = useState(null);
  const [decodingVin, setDecodingVin] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [showPartSearch, setShowPartSearch] = useState(null); // idx of parts row being searched

  useEffect(() => {
    // Load user's saved tax rate
    base44.auth.me().then(u => {
      const userTaxRate = u?.tax_rate != null ? u.tax_rate : 0;
      setForm(f => ({ ...f, tax_rate: f.tax_rate === "0" || !f.tax_rate ? String(userTaxRate) : f.tax_rate }));
    });

    if (estimate && estimate.id) {
      // Editing an existing estimate
      setForm({
        ...emptyForm,
        ...estimate,
        apply_tax: estimate.apply_tax !== false,
        tax_rate: String(estimate.tax_rate ?? 0),
        tax_applies_to: "both",
        labor_items: estimate.labor_items?.length ? estimate.labor_items.map(i => ({ ...i, hours: String(i.hours), rate: String(i.rate ?? 120) })) : [emptyLaborRow()],
        parts_items: estimate.parts_items?.length ? estimate.parts_items.map(i => ({ ...i, quantity: String(i.quantity), unit_price: String(i.unit_price) })) : [emptyPartRow()],
      });
    } else {
      // New estimate (possibly pre-filled with customer info from customer profile)
      setForm({
        ...emptyForm,
        repair_order_id: repairOrderId || "",
        customer_id: estimate?.customer_id || "",
        customer_name: estimate?.customer_name || "",
      });
    }
  }, [estimate, open, repairOrderId]);

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || "").includes(customerSearch)
  );

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id);
  const filteredVehicles = customerVehicles.filter(v =>
    !vehicleSearch || `${v.year} ${v.make} ${v.model} ${v.license_plate || ""}`.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const filteredParts = parts.filter(p =>
    !partSearch || p.name.toLowerCase().includes(partSearch.toLowerCase()) || (p.part_number || "").toLowerCase().includes(partSearch.toLowerCase())
  );

  const selectPartFromInventory = (idx, part) => {
    const items = form.parts_items.map((row, i) => {
      if (i !== idx) return row;
      const qty = parseFloat(row.quantity) || 1;
      return { ...row, name: part.name, part_number: part.part_number || "", unit_price: String(part.sale_price || 0), total: qty * (part.sale_price || 0) };
    });
    setForm(f => ({ ...f, parts_items: items }));
    setShowPartSearch(null);
    setPartSearch("");
  };

  // ---- Labor helpers ----
  const updateLabor = (idx, field, value) => {
    const items = form.labor_items.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      updated.total = (parseFloat(updated.hours) || 0) * (parseFloat(updated.rate) || 0);
      return updated;
    });
    setForm(f => ({ ...f, labor_items: items }));
  };
  const addLabor = () => setForm(f => ({ ...f, labor_items: [...f.labor_items, emptyLaborRow()] }));
  const removeLabor = (idx) => setForm(f => ({ ...f, labor_items: f.labor_items.filter((_, i) => i !== idx) }));

  // ---- Parts helpers ----
  const updatePart = (idx, field, value) => {
    const items = form.parts_items.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
      return updated;
    });
    setForm(f => ({ ...f, parts_items: items }));
  };
  const addPart = () => setForm(f => ({ ...f, parts_items: [...f.parts_items, emptyPartRow()] }));
  const removePart = (idx) => setForm(f => ({ ...f, parts_items: f.parts_items.filter((_, i) => i !== idx) }));

  // ---- Totals ----
  const laborTotal = form.labor_items.reduce((s, r) => s + ((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0)), 0);
  const partsTotal = form.parts_items.reduce((s, r) => s + (r.total || 0), 0);
  const subtotal   = laborTotal + partsTotal;
  const taxRate    = form.apply_tax ? (parseFloat(form.tax_rate) || 0) : 0;

  const taxAppliesTo = form.tax_applies_to || "both";
  let taxableAmount = 0;
  if (taxAppliesTo === "labor") taxableAmount = laborTotal;
  else if (taxAppliesTo === "parts") taxableAmount = partsTotal;
  else taxableAmount = subtotal;

  const taxAmount  = taxableAmount * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const handleCustomerChange = (cid) => {
    const customer = customers.find(c => c.id === cid);
    setForm(f => ({ ...f, customer_id: cid, customer_name: customer?.full_name || "", vehicle_id: "", vehicle_info: "" }));
  };

  const handleVehicleChange = (vid) => {
    const v = vehicles.find(v => v.id === vid);
    setForm(f => ({ ...f, vehicle_id: vid, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" }));
  };

  const saveNewCustomer = async () => {
    if (!newCustomerForm?.full_name || !newCustomerForm?.phone) return;
    const created = await base44.entities.Customer.create({
      full_name: newCustomerForm.full_name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || "",
    });
    handleCustomerChange(created.id);
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
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Decode this VIN number: ${newVehicleForm.vin}. Return the vehicle make, model, year, engine type, and color if determinable.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            make: { type: "string" },
            model: { type: "string" },
            year: { type: "number" },
            engine_type: { type: "string" },
            color: { type: "string" }
          }
        }
      });
      if (result?.make) {
        setNewVehicleForm(prev => ({
          ...prev,
          make: result.make || prev.make,
          model: result.model || prev.model,
          year: result.year || prev.year,
          engine_type: result.engine_type || prev.engine_type,
          color: result.color || prev.color,
        }));
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
    setForm(f => ({ ...f, vehicle_id: created.id, vehicle_info: `${created.year} ${created.make} ${created.model}` }));
    setNewVehicleForm(null);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
  };

  const handleSave = async () => {
    setSaving(true);
    const estNum = estimate?.estimate_number || `EST-${Date.now().toString().slice(-6)}`;
    const payload = {
      ...form,
      estimate_number: estNum,
      apply_tax: form.apply_tax,
      tax_rate: taxRate,
      labor_items: form.labor_items.map(r => ({ ...r, hours: parseFloat(r.hours) || 0, rate: parseFloat(r.rate) || 120 })),
      parts_items: form.parts_items.map(r => ({ ...r, quantity: parseFloat(r.quantity) || 0, unit_price: parseFloat(r.unit_price) || 0 })),
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
    };
    if (estimate && estimate.id) {
      await base44.entities.Estimate.update(estimate.id, payload);
    } else {
      await base44.entities.Estimate.create(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const canSave = form.customer_id && form.vehicle_id;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{estimate ? "Edit Estimate" : "New Service Estimate"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
           {/* Customer & Vehicle */}
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
               <Select value={form.customer_id} onValueChange={(v) => { handleCustomerChange(v); setCustomerSearch(""); }}>
                 <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                   <SelectValue placeholder="Select customer..." />
                 </SelectTrigger>
                 <SelectContent className="bg-gray-800 border-gray-700 text-white">
                   <div className="px-2 pb-1 pt-1">
                     <div className="relative">
                       <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                       <input
                         value={customerSearch}
                         onChange={e => setCustomerSearch(e.target.value)}
                         placeholder="Search by name or phone..."
                         className="w-full pl-7 pr-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none"
                         onKeyDown={e => e.stopPropagation()}
                         onClick={e => e.stopPropagation()}
                       />
                     </div>
                   </div>
                   {filteredCustomers.map(c => (
                     <SelectItem key={c.id} value={c.id}>{c.full_name} {c.phone ? `— ${c.phone}` : ""}</SelectItem>
                   ))}
                   {filteredCustomers.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No customers found</div>}
                   <button onClick={() => setNewCustomerForm({ full_name: "", phone: "", email: "" })}
                     className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm">
                     <Plus className="w-3.5 h-3.5" /> New customer
                   </button>
                 </SelectContent>
               </Select>
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
                   <Select value={form.vehicle_id} onValueChange={(v) => { handleVehicleChange(v); setVehicleSearch(""); }} disabled={!form.customer_id}>
                       <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                         <SelectValue placeholder="Select vehicle..." />
                       </SelectTrigger>
                       <SelectContent className="bg-gray-800 border-gray-700 text-white">
                         {customerVehicles.length > 3 && (
                           <div className="px-2 pb-1 pt-1">
                             <div className="relative">
                               <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                               <input
                                 value={vehicleSearch}
                                 onChange={e => setVehicleSearch(e.target.value)}
                                 placeholder="Search vehicle..."
                                 className="w-full pl-7 pr-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none"
                                 onKeyDown={e => e.stopPropagation()}
                                 onClick={e => e.stopPropagation()}
                               />
                             </div>
                           </div>
                         )}
                         {filteredVehicles.map(v => (
                           <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.license_plate ? `(${v.license_plate})` : ""}</SelectItem>
                         ))}
                         {form.customer_id && filteredVehicles.length === 0 && (
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
                   <Plus className="w-3 h-3" /> Add another
                   </button>
                   )}
                 </div>
               )}
             </div>
           </div>

          {/* Status / Tax / Valid Until */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-400">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {["draft","sent","approved","declined","expired"].map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Tax ({parseFloat(form.tax_rate) || 0}%)</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, apply_tax: !f.apply_tax }))}
                  className={`flex-1 h-9 rounded-md border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    form.apply_tax
                      ? "bg-sky-500/20 border-sky-500 text-sky-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${form.apply_tax ? "bg-sky-400" : "bg-gray-600"}`} />
                  {form.apply_tax ? "Applied" : "Not Applied"}
                </button>
                {form.apply_tax && (
                  <Select value={form.tax_applies_to || "both"} onValueChange={v => setForm(f => ({ ...f, tax_applies_to: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-24 h-9">
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
            <div>
              <Label className="text-gray-400">Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          {/* Labor Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Labor</Label>
              <Button size="sm" variant="ghost" onClick={addLabor} className="text-sky-400 hover:text-sky-300 h-7 px-2">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {form.labor_items.map((row, idx) => (
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
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" step="1" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.hours)||0)*(parseFloat(row.rate)||0)).toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => removeLabor(idx)} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parts Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Parts</Label>
              <Button size="sm" variant="ghost" onClick={addPart} className="text-sky-400 hover:text-sky-300 h-7 px-2">
                <Plus className="w-4 h-4 mr-1" /> Add Row
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
                  {form.parts_items.map((row, idx) => (
                    <React.Fragment key={idx}>
                    <tr className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <Input value={row.name} onChange={e => updatePart(idx, "name", e.target.value)}
                            className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" />
                          {parts.length > 0 && (
                            <button onClick={() => { setShowPartSearch(showPartSearch === idx ? null : idx); setPartSearch(""); }}
                              className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded bg-gray-700 hover:bg-sky-500/30 text-gray-400 hover:text-sky-400 transition-colors"
                              title="Search inventory">
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showPartSearch === idx && (
                          <div className="mt-1">
                            <input
                              value={partSearch}
                              onChange={e => setPartSearch(e.target.value)}
                              placeholder="Search inventory..."
                              autoFocus
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none"
                            />
                            <div className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-800">
                              {filteredParts.slice(0, 10).map(p => (
                                <button key={p.id} onClick={() => selectPartFromInventory(idx, p)}
                                  className="w-full px-2 py-1.5 text-left hover:bg-sky-500/20 text-xs text-white flex justify-between gap-2">
                                  <span className="font-medium truncate">{p.name}</span>
                                  <span className="text-gray-400 flex-shrink-0">${(p.sale_price || 0).toFixed(2)}</span>
                                </button>
                              ))}
                              {filteredParts.length === 0 && <div className="px-2 py-2 text-xs text-gray-500">No parts found</div>}
                            </div>
                          </div>
                        )}
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
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${row.total.toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => removePart(idx)} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      </tr>
                      </React.Fragment>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-gray-400">Notes</Label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Additional notes..."
              className="w-full mt-1 rounded-md bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-sky-500" />
          </div>

          {/* Summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-400"><span>Labor Subtotal</span><span>${laborTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-400"><span>Parts Subtotal</span><span>${partsTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-400">
              <span>Tax ({parseFloat(form.tax_rate) || 0}%)</span>
              <span className={form.apply_tax ? "" : "line-through opacity-50"}>{form.apply_tax ? `$${taxAmount.toFixed(2)}` : "Not applied"}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-base border-t border-gray-700 pt-2 mt-2">
              <span>Grand Total</span>
              <span className="text-sky-400">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !canSave} className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : "Save Estimate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}