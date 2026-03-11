import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function PartFormDialog({ open, onClose, part, onSaved }) {
  const [form, setForm] = useState({
    name: "", part_number: "", supplier: "", cost_price: "",
    sale_price: "", quantity: "", min_stock: "", category: ""
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (part) {
      setForm({
        name: part.name || "", part_number: part.part_number || "",
        supplier: part.supplier || "", cost_price: part.cost_price || "",
        sale_price: part.sale_price || "", quantity: part.quantity || "",
        min_stock: part.min_stock || "", category: part.category || "",
      });
    } else {
      setForm({ name: "", part_number: "", supplier: "", cost_price: "",
        sale_price: "", quantity: "", min_stock: "", category: "" });
    }
  }, [part, open]);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      ...form,
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      quantity: Number(form.quantity) || 0,
      min_stock: Number(form.min_stock) || 0,
    };
    if (part) {
      await base44.entities.Part.update(part.id, data);
    } else {
      await base44.entities.Part.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{part ? "Edit Part" : "New Part"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-400">Part Name *</Label>
            <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Part Number</Label>
              <Input value={form.part_number} onChange={e => setForm({...form, part_number: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Category</Label>
              <Input value={form.category} onChange={e => setForm({...form, category: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400">Supplier</Label>
            <Input value={form.supplier} onChange={e => setForm({...form, supplier: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Cost Price *</Label>
              <Input type="number" step="0.01" value={form.cost_price}
                onChange={e => setForm({...form, cost_price: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Sale Price *</Label>
              <Input type="number" step="0.01" value={form.sale_price}
                onChange={e => setForm({...form, sale_price: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Quantity *</Label>
              <Input type="number" value={form.quantity}
                onChange={e => setForm({...form, quantity: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Min Stock Level</Label>
              <Input type="number" value={form.min_stock}
                onChange={e => setForm({...form, min_stock: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave}
              disabled={saving || !form.name || !form.cost_price || !form.sale_price}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Part"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}