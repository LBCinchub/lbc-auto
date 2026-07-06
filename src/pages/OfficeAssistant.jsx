import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNhtsaVinDecode } from "@/hooks/useNhtsaVinDecode";
import VinScanner from "@/components/vehicles/VinScanner";
import {
  Users, Car, LogOut, ArrowRight, ArrowLeft, Camera, Loader2,
  CheckCircle2, AlertCircle, Plus,
} from "lucide-react";

const emptyCustomer = { full_name: "", phone: "", email: "", address: "" };
const emptyVehicle = { vin: "", make: "", model: "", year: "", color: "", engine_type: "", license_plate: "" };

export default function OfficeAssistant() {
  const [staff, setStaff] = useState(null);
  const [step, setStep] = useState("customer"); // customer | vehicle | done
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicle);
  const [customer, setCustomer] = useState(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const { decoding, vinError, decodeVin: nhtsaDecode, setVinError } = useNhtsaVinDecode();

  useEffect(() => {
    const saved = sessionStorage.getItem("tech_session");
    if (!saved) { window.location.href = "/TechPortal"; return; }
    try {
      const s = JSON.parse(saved);
      if (s.role !== "office_staff") { window.location.href = "/TechPortal"; return; }
      setStaff(s);
    } catch {
      window.location.href = "/TechPortal";
    }
  }, []);

  const logout = () => {
    sessionStorage.removeItem("tech_session");
    window.location.href = "/TechPortal";
  };

  const resetAll = () => {
    setCustomerForm(emptyCustomer);
    setVehicleForm(emptyVehicle);
    setCustomer(null);
    setError("");
    setVinError("");
    setStep("customer");
  };

  const saveCustomer = async () => {
    if (!customerForm.full_name.trim() || customerForm.phone.replace(/\D/g, "").length < 7) {
      setError("Name and a valid phone number are required.");
      return;
    }
    setSavingCustomer(true);
    setError("");
    try {
      const result = await base44.functions.invoke("officeAddCustomer", {
        action: "findOrCreateCustomer",
        shop_email: staff.owner_email,
        full_name: customerForm.full_name.trim(),
        phone: customerForm.phone,
        email: customerForm.email || undefined,
        address: customerForm.address || undefined,
      });
      const data = result?.data ?? result;
      if (data?.success) {
        setCustomer(data.customer);
        setStep("vehicle");
      } else {
        setError(data?.error || "Couldn't save customer. Try again.");
      }
    } catch (e) {
      setError("Error: " + (e?.message || String(e)));
    }
    setSavingCustomer(false);
  };

  const handleVinScanned = (result) => {
    setVehicleForm(prev => ({
      ...prev,
      vin: result.vin || prev.vin,
      make: result.make || prev.make,
      model: result.model || prev.model,
      year: result.year || prev.year,
      color: result.color || prev.color,
      engine_type: result.engine_type || prev.engine_type,
    }));
    setScanning(false);
  };

  const decodeVin = async () => {
    const result = await nhtsaDecode(vehicleForm.vin);
    if (result) {
      setVehicleForm(prev => ({
        ...prev,
        make: result.make || prev.make,
        model: result.model || prev.model,
        year: result.year || prev.year,
        engine_type: result.engine_type || prev.engine_type,
      }));
    }
  };

  const saveVehicle = async () => {
    if (!vehicleForm.make.trim() || !vehicleForm.model.trim() || !vehicleForm.year) {
      setError("Make, model, and year are required — scan or decode the VIN, or enter them manually.");
      return;
    }
    setSavingVehicle(true);
    setError("");
    try {
      const result = await base44.functions.invoke("officeAddCustomer", {
        action: "addVehicle",
        shop_email: staff.owner_email,
        customer_id: customer.id,
        customer_name: customer.full_name,
        vin: vehicleForm.vin || undefined,
        make: vehicleForm.make.trim(),
        model: vehicleForm.model.trim(),
        year: Number(vehicleForm.year),
        color: vehicleForm.color || undefined,
        engine_type: vehicleForm.engine_type || undefined,
        license_plate: vehicleForm.license_plate || undefined,
      });
      const data = result?.data ?? result;
      if (data?.success) {
        setStep("done");
      } else {
        setError(data?.error || "Couldn't save vehicle. Try again.");
      }
    } catch (e) {
      setError("Error: " + (e?.message || String(e)));
    }
    setSavingVehicle(false);
  };

  if (!staff) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-sky-400 text-lg">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <div className="border-b border-slate-800 px-4 py-4 flex items-center justify-between sticky top-0 bg-[#020617] z-10">
        <div>
          <p className="text-sm text-slate-500">Office Assistant</p>
          <p className="font-semibold">{staff.name}</p>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300">
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 pb-10">
        {/* Step: customer */}
        {step === "customer" && (
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold">Add Customer</h2>
            </div>
            <p className="text-sm text-slate-500 -mt-2">
              Add a walk-in or phone customer. You can finish the full job later on the laptop —
              this saves straight into the shop's records.
            </p>

            <div>
              <Label className="text-slate-400">Full Name *</Label>
              <Input value={customerForm.full_name}
                onChange={e => setCustomerForm({ ...customerForm, full_name: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-1" autoFocus />
            </div>
            <div>
              <Label className="text-slate-400">Phone *</Label>
              <Input value={customerForm.phone} type="tel"
                onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-1" placeholder="6135551234" />
            </div>
            <div>
              <Label className="text-slate-400">Email</Label>
              <Input value={customerForm.email} type="email"
                onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-1" />
            </div>
            <div>
              <Label className="text-slate-400">Address</Label>
              <Input value={customerForm.address}
                onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-1" />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}

            <Button onClick={saveCustomer} disabled={savingCustomer} className="w-full h-12 font-semibold">
              {savingCustomer ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {savingCustomer ? "Saving..." : "Continue to Vehicle"}
              {!savingCustomer && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        )}

        {/* Step: vehicle */}
        {step === "vehicle" && customer && (
          <div className="space-y-4 mt-4">
            <button onClick={() => setStep("customer")} className="flex items-center gap-1 text-sm text-sky-400 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <div className="flex items-center gap-2 mb-2">
              <Car className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold">Add Vehicle</h2>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 -mt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-300">{customer.full_name}{customer.existed === false ? "" : ""}</span>
            </div>

            <div>
              <Label className="text-slate-400">VIN</Label>
              <div className="flex gap-2 mt-1">
                <Input value={vehicleForm.vin}
                  onChange={e => { setVehicleForm({ ...vehicleForm, vin: e.target.value.toUpperCase() }); setVinError(""); }}
                  className="bg-slate-900 border-slate-700 text-white" placeholder="17-character VIN" maxLength={17} />
                <Button type="button" onClick={() => setScanning(true)} title="Scan VIN with camera"
                  className="flex-shrink-0 px-3">
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-slate-500">Scan the barcode sticker (door jamb/dashboard) — auto-fills the rest.</p>
                <button type="button" onClick={decodeVin} disabled={decoding || !vehicleForm.vin}
                  className="text-xs text-sky-400 disabled:opacity-40 flex-shrink-0 ml-2">
                  {decoding ? "Decoding..." : "Decode"}
                </button>
              </div>
              {vinError && <p className="text-rose-400 text-xs mt-1">{vinError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-400">Make *</Label>
                <Input value={vehicleForm.make}
                  onChange={e => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-400">Model *</Label>
                <Input value={vehicleForm.model}
                  onChange={e => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-400">Year *</Label>
                <Input value={vehicleForm.year} type="number"
                  onChange={e => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
              <div>
                <Label className="text-slate-400">Color</Label>
                <Input value={vehicleForm.color}
                  onChange={e => setVehicleForm({ ...vehicleForm, color: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-slate-400">License Plate</Label>
              <Input value={vehicleForm.license_plate}
                onChange={e => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })}
                className="bg-slate-900 border-slate-700 text-white mt-1" />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}

            <Button onClick={saveVehicle} disabled={savingVehicle} className="w-full h-12 font-semibold">
              {savingVehicle ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {savingVehicle ? "Saving..." : "Save Vehicle"}
            </Button>
          </div>
        )}

        {/* Step: done */}
        {step === "done" && (
          <div className="text-center py-16 space-y-4">
            <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto" />
            <p className="text-lg font-semibold">Saved!</p>
            <p className="text-slate-400 text-sm px-4">
              {customer?.full_name}'s vehicle is in the system now — pick it up on the laptop anytime to
              open a repair order, estimate, or invoice.
            </p>
            <Button onClick={resetAll} className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Add Another Customer
            </Button>
          </div>
        )}
      </div>

      {scanning && <VinScanner onVinDetected={handleVinScanned} onClose={() => setScanning(false)} />}
    </div>
  );
}