import React, { useState, useRef, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Camera } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useNhtsaVinDecode } from "@/hooks/useNhtsaVinDecode";
import VinScanner from "@/components/vehicles/VinScanner";

const toTitleCase = (str) => str.replace(/\b\w/g, c => c.toUpperCase());

export default function QuickAddVehicleDialog({ open, onClose, onSaved, customer }) {
  const [form, setForm] = useState({
    vin: "", make: "", model: "", year: "", mileage: "",
    license_plate: "", engine_type: "", color: "",
  });
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const { decoding, vinError, decodeVin, setVinError } = useNhtsaVinDecode();
  const vinRef = useRef(null);

  useEffect(() => {
    if (open) {
      setForm({ vin: "", make: "", model: "", year: "", mileage: "", license_plate: "", engine_type: "", color: "" });
      setError("");
      setVinError("");
      setTimeout(() => vinRef.current?.focus(), 50);
    }
  }, [open]);

  const handleDecode = async () => {
    const result = await decodeVin(form.vin);
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

  const handleVinScanned = ({ vin }) => {
    setForm(prev => ({ ...prev, vin: vin || prev.vin }));
    setScanning(false);
  };

  const handleSave = async () => {
    if (!form.make || !form.model || !form.year || !customer) return;
    setSaving(true);
    setError("");
    try {
      const created = await base44.entities.Vehicle.create({
        ...form,
        year: Number(form.year),
        mileage: Number(form.mileage) || 0,
        customer_id: customer.id,
        customer_name: customer.full_name,
      });
      onSaved(created);
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to create vehicle.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              New Vehicle
              {customer && <span className="text-gray-400 text-sm font-normal ml-2">for {customer.full_name}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-gray-400">VIN</Label>
                <Input
                  ref={vinRef}
                  value={form.vin}
                  onChange={e => { setForm({ ...form, vin: e.target.value.toUpperCase() }); setVinError(""); }}
                  className="bg-gray-800 border-gray-700 text-white mt-1"
                  placeholder="17-character VIN"
                  maxLength={17}
                />
              </div>
              <Button onClick={() => setScanning(true)} title="Scan VIN with camera" className="mt-7 bg-purple-600 hover:bg-purple-700" size="sm">
                <Camera className="w-4 h-4" />
              </Button>
              <Button onClick={handleDecode} disabled={decoding || !form.vin} className="mt-7 bg-sky-500 hover:bg-sky-600" size="sm">
                {decoding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Decode"}
              </Button>
            </div>
            {vinError && <p className="text-rose-400 text-xs mt-1">{vinError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Make *</Label>
                <Input value={form.make} autoCapitalize="words" onChange={e => setForm({ ...form, make: toTitleCase(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Model *</Label>
                <Input value={form.model} autoCapitalize="words" onChange={e => setForm({ ...form, model: toTitleCase(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-gray-400">Year *</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Mileage</Label>
                <Input type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="km" />
              </div>
              <div>
                <Label className="text-gray-400">Plate</Label>
                <Input value={form.license_plate} onChange={e => setForm({ ...form, license_plate: e.target.value.toUpperCase() })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-400">Engine</Label>
                <Input value={form.engine_type} autoCapitalize="words" onChange={e => setForm({ ...form, engine_type: toTitleCase(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="2.4L 4-Cyl" />
              </div>
              <div>
                <Label className="text-gray-400">Color</Label>
                <Input value={form.color} autoCapitalize="words" onChange={e => setForm({ ...form, color: toTitleCase(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <div className="flex gap-3 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.make || !form.model || !form.year}
                className="flex-1 bg-sky-500 hover:bg-sky-600"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Vehicle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {scanning && <VinScanner onVinDetected={handleVinScanned} onClose={() => setScanning(false)} />}
    </>
  );
}