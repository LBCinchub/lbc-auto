import React, { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Camera } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNhtsaVinDecode } from "@/hooks/useNhtsaVinDecode";
import CustomerSearchInput from "@/components/shared/CustomerSearchInput";
import VinScanner from "./VinScanner";

const emptyForm = {
  customer_id: "", customer_name: "", vin: "", license_plate: "",
  make: "", model: "", year: "", engine_type: "", color: "", mileage: ""
};

export default function VehicleFormDialog({ open, onClose, vehicle, onSaved, customers = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const { decoding, vinError, decodeVin: nhtsaDecode, setVinError } = useNhtsaVinDecode();

  const handleVinScanned = ({ vin }) => {
    setForm(prev => ({
      ...prev,
      vin: vin || prev.vin,
    }));
    setScanning(false);
  };

  useEffect(() => {
    if (vehicle) {
      setForm({
        customer_id: vehicle.customer_id || "",
        customer_name: vehicle.customer_name || "",
        vin: vehicle.vin || "",
        license_plate: vehicle.license_plate || "",
        make: vehicle.make || "",
        model: vehicle.model || "",
        year: vehicle.year || "",
        engine_type: vehicle.engine_type || "",
        color: vehicle.color || "",
        mileage: vehicle.mileage || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [vehicle, open]);

  const decodeVin = async () => {
    const result = await nhtsaDecode(form.vin);
    if (result) {
      setForm(prev => ({
        ...prev,
        make: result.make || prev.make,
        model: result.model || prev.model,
        year: result.year || prev.year,
        engine_type: result.engine_type || prev.engine_type,
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const data = { ...form, year: Number(form.year), mileage: Number(form.mileage) || 0 };
    if (vehicle?.id) {
      await base44.entities.Vehicle.update(vehicle.id, data);
    } else {
      await base44.entities.Vehicle.create(data);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const handleCustomerChange = (customerId, customerName) => {
    setForm({ ...form, customer_id: customerId, customer_name: customerName || "" });
  };

  return (
  <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "New Vehicle"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-400">Customer *</Label>
            <CustomerSearchInput customers={customers} value={form.customer_id} onChange={handleCustomerChange} />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-gray-400">VIN</Label>
              <Input value={form.vin} onChange={e => { setForm({...form, vin: e.target.value}); setVinError(""); }}
                className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="17-character VIN" />
            </div>
            <Button onClick={() => setScanning(true)} title="Scan VIN with camera"
              className="mt-7 bg-purple-600 hover:bg-purple-700" size="sm">
              <Camera className="w-4 h-4" />
            </Button>
            <Button onClick={decodeVin} disabled={decoding || !form.vin}
              className="mt-7 bg-sky-500 hover:bg-sky-600" size="sm">
              {decoding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decode"}
            </Button>
          </div>
          {vinError && <p className="text-rose-400 text-xs mt-1">{vinError}</p>}

          <div>
            <Label className="text-gray-400">License Plate</Label>
            <Input value={form.license_plate} onChange={e => setForm({...form, license_plate: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Make *</Label>
              <Input value={form.make} onChange={e => setForm({...form, make: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Model *</Label>
              <Input value={form.model} onChange={e => setForm({...form, model: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-gray-400">Year *</Label>
              <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Color</Label>
              <Input value={form.color} onChange={e => setForm({...form, color: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Mileage</Label>
              <Input type="number" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Engine Type</Label>
            <Input value={form.engine_type} onChange={e => setForm({...form, engine_type: e.target.value})}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.customer_id || !form.make || !form.model || !form.year}
              className="flex-1 bg-sky-500 hover:bg-sky-600">
              {saving ? "Saving..." : "Save Vehicle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {scanning && <VinScanner onVinDetected={handleVinScanned} onClose={() => setScanning(false)} />}
  </>
  );
}