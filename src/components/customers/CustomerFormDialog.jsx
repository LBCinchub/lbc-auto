import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";

export default function CustomerFormDialog({ open, onClose, customer, onSaved }) {
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", address: "", notes: ""
  });
  const [addVehicle, setAddVehicle] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ vin: "", make: "", model: "", year: "", license_plate: "" });
  const [decodingVin, setDecodingVin] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setForm({
        full_name: customer.full_name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        notes: customer.notes || "",
      });
    } else {
      setForm({ full_name: "", phone: "", email: "", address: "", notes: "" });
      setAddVehicle(false);
      setVehicleForm({ vin: "", make: "", model: "", year: "", license_plate: "" });
    }
  }, [customer, open]);

  const handleSave = async () => {
    setSaving(true);
    let savedCustomer;
    if (customer) {
      await base44.entities.Customer.update(customer.id, form);
      savedCustomer = { id: customer.id, ...form };
    } else {
      savedCustomer = await base44.entities.Customer.create(form);
    }
    if (!customer && addVehicle && vehicleForm.make && vehicleForm.model && vehicleForm.year) {
      await base44.entities.Vehicle.create({
        ...vehicleForm,
        year: Number(vehicleForm.year),
        customer_id: savedCustomer.id,
        customer_name: form.full_name,
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "New Customer"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-400">Full Name *</Label>
            <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Phone *</Label>
            <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Email</Label>
            <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Address</Label>
            <Input value={form.address} onChange={e => setForm({...form, address: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={3} />
          </div>
          {!customer && (
            <div className="border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300 font-medium">Add a Vehicle</Label>
                <Switch checked={addVehicle} onCheckedChange={setAddVehicle} />
              </div>
              {addVehicle && (
                <div className="space-y-3 pt-1">
                  <div>
                    <Label className="text-gray-400 text-xs">VIN</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={vehicleForm.vin} onChange={e => setVehicleForm({...vehicleForm, vin: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white flex-1" placeholder="Enter VIN" />
                      <Button onClick={async () => {
                        if (!vehicleForm.vin) return;
                        setDecodingVin(true);
                        try {
                          const result = await base44.integrations.Core.InvokeLLM({
                            prompt: `Decode this VIN and extract the make, model, and year: ${vehicleForm.vin}. Return only JSON with keys: make, model, year (as number).`,
                            response_json_schema: {
                              type: "object",
                              properties: { make: {type: "string"}, model: {type: "string"}, year: {type: "number"} }
                            }
                          });
                          setVehicleForm(prev => ({
                            ...prev,
                            make: result.make || prev.make,
                            model: result.model || prev.model,
                            year: result.year?.toString() || prev.year
                          }));
                        } catch (e) {
                          console.error("Error decoding VIN:", e);
                        }
                        setDecodingVin(false);
                      }} disabled={decodingVin || !vehicleForm.vin} className="bg-gray-700 hover:bg-gray-600 text-xs">
                        {decodingVin ? "Decoding..." : "Decode"}
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-xs">Make *</Label>
                      <Input value={vehicleForm.make} onChange={e => setVehicleForm({...vehicleForm, make: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Toyota" />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">Model *</Label>
                      <Input value={vehicleForm.model} onChange={e => setVehicleForm({...vehicleForm, model: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Camry" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400 text-xs">Year *</Label>
                      <Input type="number" value={vehicleForm.year} onChange={e => setVehicleForm({...vehicleForm, year: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="2020" />
                    </div>
                    <div>
                      <Label className="text-gray-400 text-xs">License Plate</Label>
                      <Input value={vehicleForm.license_plate} onChange={e => setVehicleForm({...vehicleForm, license_plate: e.target.value})}
                        className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="ABC 123" />
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.full_name || !form.phone}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Customer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}