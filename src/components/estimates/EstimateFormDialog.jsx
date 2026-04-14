import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Loader2, X } from "lucide-react";

const emptyLaborRow = () => ({ description: "", hours: "", rate: "", total: 0 });
const emptyPartRow  = () => ({ name: "", part_number: "", quantity: "", unit_price: "", total: 0 });

const TAX_RATE = 15;

const emptyForm = {
  customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
  status: "draft", notes: "", tax_rate: String(TAX_RATE), apply_tax: true, valid_until: "",
  labor_items: [emptyLaborRow()],
  parts_items: [emptyPartRow()],
  repair_order_id: "",
};

export default function EstimateFormDialog({ open, onClose, estimate, customers, vehicles, repairOrderId, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState(null);
  const [newVehicleForm, setNewVehicleForm] = useState(null);

  useEffect(() => {
    if (estimate) {
      setForm({
        ...emptyForm,
        ...estimate,
        apply_tax: estimate.apply_tax !== false,
        tax_rate: String(estimate.tax_rate ?? TAX_RATE),
        labor_items: estimate.labor_items?.length ? estimate.labor_items.map(i => ({ ...i, hours: String(i.hours), rate: String(i.rate) })) : [emptyLaborRow()],
        parts_items: estimate.parts_items?.length ? estimate.parts_items.map(i => ({ ...i, quantity: String(i.quantity), unit_price: String(i.unit_price) })) : [emptyPartRow()],
      });
    } else {
      setForm({ ...emptyForm, repair_order_id: repairOrderId || "" });
    }
  }, [estimate, open, repairOrderId]);

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id);

  // ---- Labor helpers ----
  const updateLabor = (idx, field, value) => {
    const items = form.labor_items.map((row, i) => {
      if (i !== idx) return row;
      const updated = { ...row, [field]: value };
      updated.total = (parseFloat(updated.hours) || 0) * 120;
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
  const laborTotal = form.labor_items.reduce((s, r) => s + ((parseFloat(r.hours) || 0) * 120), 0);
  const partsTotal = form.parts_items.reduce((s, r) => s + (r.total || 0), 0);
  const subtotal   = laborTotal + partsTotal;
  const taxRate    = form.apply_tax ? TAX_RATE : 0;
  const taxAmount  = subtotal * (taxRate / 100);
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
  };

  const saveNewVehicle = async () => {
    if (!newVehicleForm?.make || !newVehicleForm?.model || !newVehicleForm?.year) return;
    const created = await base44.entities.Vehicle.create({
      customer_id: form.customer_id,
      customer_name: form.customer_name,
      make: newVehicleForm.make,
      model: newVehicleForm.model,
      year: Number(newVehicleForm.year),
      license_plate: newVehicleForm.license_plate || "",
    });
    setForm(f => ({ ...f, vehicle_id: created.id, vehicle_info: `${created.year} ${created.make} ${created.model}` }));
    setNewVehicleForm(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const estNum = estimate?.estimate_number || `EST-${Date.now().toString().slice(-6)}`;
    const payload = {
      ...form,
      estimate_number: estNum,
      apply_tax: form.apply_tax,
      tax_rate: taxRate,
      labor_items: form.labor_items.map(r => ({ ...r, hours: parseFloat(r.hours) || 0, rate: 120 })),
      parts_items: form.parts_items.map(r => ({ ...r, quantity: parseFloat(r.quantity) || 0, unit_price: parseFloat(r.unit_price) || 0 })),
      labor_total: laborTotal,
      parts_total: partsTotal,
      tax_amount: taxAmount,
      grand_total: grandTotal,
    };
    if (estimate) {
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
           {newCustomerForm !== null && (
             <div className="bg-gray-800 border border-sky-500/30 rounded-lg p-3 space-y-2 mb-2">
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
           {/* Customer & Vehicle */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
               <Label className="text-gray-400">Customer *</Label>
               <Select value={form.customer_id} onValueChange={handleCustomerChange}>
                 <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                   <SelectValue placeholder="Select customer..." />
                 </SelectTrigger>
                 <SelectContent className="bg-gray-800 border-gray-700 text-white">
                   {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
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
                   <Select value={form.vehicle_id} onValueChange={handleVehicleChange} disabled={!form.customer_id}>
                     <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                       <SelectValue placeholder="Select vehicle..." />
                     </SelectTrigger>
                     <SelectContent className="bg-gray-800 border-gray-700 text-white">
                       {customerVehicles.map(v => (
                         <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.license_plate ? `(${v.license_plate})` : ""}</SelectItem>
                       ))}
                       {form.customer_id && customerVehicles.length === 0 && (
                         <button onClick={() => setNewVehicleForm({ year: "", make: "", model: "", license_plate: "" })}
                           className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm">
                           <Plus className="w-3.5 h-3.5" /> Add vehicle
                         </button>
                       )}
                     </SelectContent>
                   </Select>
                   {form.customer_id && customerVehicles.length > 0 && (
                     <button onClick={() => setNewVehicleForm({ year: "", make: "", model: "", license_plate: "" })}
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
              <Label className="text-gray-400">Tax (15%)</Label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, apply_tax: !f.apply_tax }))}
                className={`mt-1 w-full h-9 rounded-md border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  form.apply_tax
                    ? "bg-sky-500/20 border-sky-500 text-sky-400"
                    : "bg-gray-800 border-gray-700 text-gray-500"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${form.apply_tax ? "bg-sky-400" : "bg-gray-600"}`} />
                {form.apply_tax ? "Applied" : "Not Applied"}
              </button>
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
                      <td className="px-2 py-1.5 text-right text-gray-300">$120</td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${row.total.toFixed(2)}</td>
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
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${row.total.toFixed(2)}</td>
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
              <span>Tax (15%)</span>
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