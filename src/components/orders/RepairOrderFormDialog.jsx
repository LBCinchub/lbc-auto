import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, DollarSign } from "lucide-react";

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
    labor_hours: "", notes: "", parts_used: [], estimated_completion: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
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
        notes: order.notes || "",
        parts_used: order.parts_used || [],
        estimated_completion: order.estimated_completion || "",
      });
    } else {
      setForm({
        customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
        mechanic_id: "", mechanic_name: "", description: "", status: "waiting",
        labor_hours: "", notes: "", parts_used: [], estimated_completion: ""
      });
    }
  }, [order, open]);

  const customerVehicles = vehicles.filter(v => v.customer_id === form.customer_id);

  const handleCustomerChange = (id, name) => {
    setForm({ ...form, customer_id: id, customer_name: name || "", vehicle_id: "", vehicle_info: "" });
  };

  const handleVehicleChange = (id) => {
    const v = vehicles.find(v => v.id === id);
    setForm({ ...form, vehicle_id: id, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" });
  };

  const handleMechanicChange = (id) => {
    const m = mechanics.find(m => m.id === id);
    setForm({ ...form, mechanic_id: id, mechanic_name: m?.name || "" });
  };

  const [partSearches, setPartSearches] = useState({});
  const [showPrice, setShowPrice] = useState({});
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
        updated[idx].total = p.sale_price * updated[idx].quantity;
      }
    }

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
      const mechanic = mechanics.find(m => m.id === form.mechanic_id);
      const laborCost = laborHours * (mechanic?.hourly_rate || 0);
      const partsCost = form.parts_used.reduce((sum, p) => sum + (p.total || 0), 0);
      const totalCost = laborCost + partsCost;

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
        total_cost: totalCost,
        order_number: order?.order_number || `RO-${Date.now().toString(36).toUpperCase()}`,
      };

      if (order) {
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
      } else {
        data.history = [{
          timestamp,
          user: userEmail,
          action: 'created',
          changes: {}
        }];
        await base44.entities.RepairOrder.create(data);
      }
      
      onSaved();
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
              <CustomerSearchInput customers={customers} value={form.customer_id} onChange={handleCustomerChange} />
            </div>
            <div>
              <Label className="text-gray-400">Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={handleVehicleChange}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {customerVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Labor Hours</Label>
              <Input type="number" value={form.labor_hours} onChange={e => setForm({ ...form, labor_hours: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1" step="0.5" />
            </div>
            <div>
              <Label className="text-gray-400">Est. Completion</Label>
              <Input type="date" value={form.estimated_completion} onChange={e => setForm({ ...form, estimated_completion: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          {/* Parts section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-400">Parts Used</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNewPartForm({ name: "", cost_price: "", sale_price: "", quantity: 0 })} className="text-amber-400 hover:text-amber-300 gap-1 text-xs">
                  <Plus className="w-3 h-3" /> Add to Inventory
                </Button>
                <Button variant="ghost" size="sm" onClick={addPart} className="text-sky-400 hover:text-sky-300 gap-1">
                  <Plus className="w-3 h-3" /> Add Part
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
            {form.parts_used.map((pu, idx) => (
              <div key={idx} className="bg-gray-800/50 rounded-lg p-3 mb-2 space-y-2">
                <div className="flex gap-2 items-center">
                  <div className="flex-1 space-y-1">
                    <Label className="text-gray-500 text-xs">Part Name</Label>
                    <Input value={pu.name} onChange={e => updatePart(idx, "name", e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white" placeholder="Type part name..." />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removePart(idx)} className="text-gray-500 hover:text-rose-400 h-8 w-8 mt-5">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Label className="text-gray-500 text-xs">From Inventory</Label>
                    <Select value={pu.part_id} onValueChange={v => { updatePart(idx, "part_id", v); setPartSearches(s => ({...s, [idx]: ""})); }}>
                      <SelectTrigger className="bg-gray-800 border-gray-600 text-white mt-1">
                        <SelectValue placeholder="Select from inventory (optional)" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <div className="px-2 pb-1">
                          <Input
                            value={partSearches[idx] || ""}
                            onChange={e => setPartSearches(s => ({...s, [idx]: e.target.value}))}
                            className="bg-gray-700 border-gray-600 text-white h-7 text-xs"
                            placeholder="Search parts..."
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => e.stopPropagation()}
                          />
                        </div>
                        {parts.filter(p => !partSearches[idx] || p.name.toLowerCase().includes((partSearches[idx] || "").toLowerCase())).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20">
                    <Label className="text-gray-500 text-xs">Qty</Label>
                    <Input type="number" value={pu.quantity} onChange={e => updatePart(idx, "quantity", Number(e.target.value))}
                      className="bg-gray-800 border-gray-600 text-white mt-1" min="1" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowPrice(s => ({...s, [idx]: !s[idx]}))}
                    className={`h-8 w-8 mt-5 ${showPrice[idx] ? 'text-sky-400' : 'text-gray-500 hover:text-sky-400'}`} title="Add price">
                    <DollarSign className="w-3.5 h-3.5" />
                  </Button>
                  {showPrice[idx] && (
                    <div className="w-24">
                      <Label className="text-gray-500 text-xs">Price</Label>
                      <Input type="number" value={pu.unit_price || ""} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                        className="bg-gray-800 border-gray-600 text-white mt-1" step="0.01" placeholder="0.00" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={2} />
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