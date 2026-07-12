import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, Car, CheckCircle2 } from "lucide-react";

export default function SavePhotoToProfile({ open, onClose, photoUrl, photoBase64, aiAnalysis, source = "ai_chat" }) {
  const [user, setUser] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Customer.list("-created_date", 500).then(setCustomers).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!selectedCustomer) { setVehicles([]); setSelectedVehicle(""); return; }
    base44.entities.Vehicle.filter({ customer_id: selectedCustomer.id }).then(setVehicles).catch(() => setVehicles([]));
    setSelectedVehicle("");
  }, [selectedCustomer]);

  const filtered = selectedCustomer ? [] : customers
    .filter(c => c.full_name?.toLowerCase().includes(customerSearch.toLowerCase()))
    .slice(0, 8);

  const handleSave = async () => {
    if (!selectedCustomer || !selectedVehicle || !user) return;
    setSaving(true);
    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicle);
      const vehicleInfo = vehicle ? `${vehicle.year || ""} ${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "";
      await base44.entities.VehiclePhoto.create({
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.full_name,
        vehicle_id: selectedVehicle,
        vehicle_info: vehicleInfo,
        photo_url: photoUrl || null,
        photo_base64: photoBase64 || null,
        label: label || "Untitled photo",
        ai_analysis: aiAnalysis || "",
        taken_date: date,
        shop_email: user.email,
        source,
      });
      setSaved(true);
      setTimeout(() => { handleClose(); }, 1200);
    } catch (e) {
      console.error("Save photo error:", e);
    }
    setSaving(false);
  };

  const handleClose = () => {
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSelectedVehicle("");
    setLabel("");
    setSaved(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Car className="w-4 h-4 text-sky-400" /> Save Photo to Customer Profile
          </DialogTitle>
        </DialogHeader>

        {saved ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            <p className="text-gray-300 text-sm">Photo saved to customer profile!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Photo preview */}
            {(photoUrl || photoBase64) && (
              <img src={photoUrl || photoBase64} alt="preview" className="w-full max-h-32 object-cover rounded-lg border border-gray-700" />
            )}

            {/* Customer search */}
            <div className="space-y-1.5 relative">
              <Label className="text-gray-400 text-xs">Customer</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={customerSearch}
                  onChange={e => { setCustomerSearch(e.target.value); setShowDropdown(true); setSelectedCustomer(null); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search customer by name..."
                  className="bg-gray-800 border-gray-700 text-white pl-9 text-sm"
                />
              </div>
              {showDropdown && !selectedCustomer && filtered.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(c.full_name); setShowDropdown(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-gray-200 border-b border-gray-700/50 last:border-0"
                    >
                      <span className="font-medium">{c.full_name}</span>
                      {c.phone && <span className="text-gray-500 ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedCustomer && (
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {selectedCustomer.full_name}
                </div>
              )}
            </div>

            {/* Vehicle select */}
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Vehicle</Label>
              <select
                value={selectedVehicle}
                onChange={e => setSelectedVehicle(e.target.value)}
                disabled={!selectedCustomer}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm disabled:opacity-40"
              >
                <option value="">{selectedCustomer ? "Select vehicle..." : "Select customer first"}</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                    {v.license_plate ? ` — ${v.license_plate}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">What is this photo?</Label>
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Front brake wear, Engine leak, DTC P0300 screenshot"
                className="bg-gray-800 border-gray-700 text-white text-sm"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label className="text-gray-400 text-xs">Date</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm"
              />
            </div>
          </div>
        )}

        {!saved && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} className="border-gray-700 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !selectedCustomer || !selectedVehicle}
              className="bg-sky-600 hover:bg-sky-500 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              SAVE TO PROFILE
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}