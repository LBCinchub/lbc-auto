import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";
import { toTitleCase } from "@/utils/capitalize";
import { useToast } from "@/components/ui/use-toast";

// Real-time Title Case for word inputs (first letter of every word), mirroring the
// global autoCapitalize pattern. VIN/plate/email/phone stay as typed.
const capWords = (v) => v.replace(/(^|\s)(\S)/g, (_, s, c) => s + c.toUpperCase());

/**
 * Shared customer + vehicle picker for the blank-new Invoice/Estimate editors.
 * - Searchable customer field (by name or phone), tenant-scoped via the passed
 *   `customers` list (already filtered to the current shop by the parent page).
 * - "+ Add New Customer" creates a REAL Customer record (persists to the DB) and
 *   auto-selects it.
 * - Vehicle dropdown loads only the selected customer's vehicles; "+ Add New
 *   Vehicle" creates a REAL Vehicle record linked to that customer and
 *   auto-selects it.
 *
 * Both creates invalidate/refetch the customers & vehicles query caches so the
 * new records appear in the Customers / Vehicles pages immediately.
 */
export default function CustomerVehiclePicker({
  customers = [],
  customerId,
  customerName,
  vehicleId,
  vehicleInfo,
  onCustomerChange,
  onVehicleChange,
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [custSearch, setCustSearch] = useState(customerName || "");
  const [custDropdown, setCustDropdown] = useState([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState([]);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [savingCust, setSavingCust] = useState(false);
  const [savingVeh, setSavingVeh] = useState(false);
  const [newCust, setNewCust] = useState({ full_name: "", phone: "", email: "", address: "" });
  const [newVeh, setNewVeh] = useState({ make: "", model: "", year: "", trim: "", engine_type: "", vin: "", license_plate: "", color: "" });

  const customerSelected = !!customerId;

  // Load vehicles for the selected customer (also covers prefill on mount).
  useEffect(() => {
    if (customerId) {
      base44.entities.Vehicle.filter({ customer_id: customerId })
        .then(setCustomerVehicles)
        .catch(() => {});
    } else {
      setCustomerVehicles([]);
    }
  }, [customerId]);

  // Keep the search field in sync when the customer is set/cleared externally.
  useEffect(() => {
    setCustSearch(customerName || "");
  }, [customerId, customerName]);

  const searchCustomers = (q) => {
    if (!q.trim()) {
      setCustDropdown([]);
      setShowCustDropdown(true);
      return;
    }
    const lower = q.toLowerCase();
    const results = (customers || [])
      .filter(Boolean)
      .filter((c) => (c.full_name || "").toLowerCase().includes(lower) || (c.phone || "").includes(q))
      .slice(0, 8);
    setCustDropdown(results);
    setShowCustDropdown(true);
  };

  const selectCustomer = (c) => {
    onCustomerChange(c.id, c.full_name);
    setCustSearch(c.full_name);
    setShowCustDropdown(false);
    setCustDropdown([]);
  };

  const clearCustomer = () => {
    onCustomerChange("", "", "", "");
    setCustSearch("");
    setCustomerVehicles([]);
  };

  const onCustSearchChange = (val) => {
    setCustSearch(val);
    if (customerId) clearCustomer();
    searchCustomers(val);
  };

  const handleVehicleChange = (vid) => {
    const v = customerVehicles.find((x) => x.id === vid);
    onVehicleChange(vid, buildVehicleInfo(v));
  };

  const saveNewCustomer = async () => {
    if (!newCust.full_name || !newCust.phone) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    setSavingCust(true);
    try {
      const created = await base44.entities.Customer.create({
        full_name: toTitleCase(newCust.full_name.trim()),
        phone: newCust.phone.trim(),
        email: newCust.email.trim(),
        address: toTitleCase(newCust.address.trim()),
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.refetchQueries({ queryKey: ["customers"] });
      selectCustomer(created);
      setShowNewCustomer(false);
      setNewCust({ full_name: "", phone: "", email: "", address: "" });
      toast({ title: "Customer created ✓" });
    } catch (e) {
      toast({ title: "Could not create customer", description: e?.message, variant: "destructive" });
    } finally {
      setSavingCust(false);
    }
  };

  const saveNewVehicle = async () => {
    if (!newVeh.make || !newVeh.model || !newVeh.year) {
      toast({ title: "Make, model, and year are required", variant: "destructive" });
      return;
    }
    setSavingVeh(true);
    try {
      const created = await base44.entities.Vehicle.create({
        customer_id: customerId,
        customer_name: customerName,
        make: toTitleCase(newVeh.make.trim()),
        model: toTitleCase(newVeh.model.trim()),
        year: Number(newVeh.year) || 0,
        trim: newVeh.trim ? toTitleCase(newVeh.trim.trim()) : "",
        engine_type: newVeh.engine_type || "",
        vin: newVeh.vin.toUpperCase(),
        license_plate: newVeh.license_plate.toUpperCase(),
        color: newVeh.color ? toTitleCase(newVeh.color.trim()) : "",
      });
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      queryClient.refetchQueries({ queryKey: ["vehicles"] });
      setCustomerVehicles((prev) => [...prev, created]);
      onVehicleChange(created.id, buildVehicleInfo(created));
      setShowNewVehicle(false);
      setNewVeh({ make: "", model: "", year: "", trim: "", engine_type: "", vin: "", license_plate: "", color: "" });
      toast({ title: "Vehicle created ✓" });
    } catch (e) {
      toast({ title: "Could not create vehicle", description: e?.message, variant: "destructive" });
    } finally {
      setSavingVeh(false);
    }
  };

  return (
    <>
      <div className="text-right text-sm min-w-[240px]">
        {customerSelected ? (
          <>
            <div className="flex items-center justify-end gap-2">
              <p className="font-medium text-white">{customerName}</p>
              <button type="button" onClick={clearCustomer} className="text-xs text-gray-500 underline hover:text-gray-300">Change</button>
            </div>
            <Select value={vehicleId || ""} onValueChange={handleVehicleChange}>
              <SelectTrigger className="mt-1 h-8 w-full bg-gray-950 border-gray-700 text-white">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                {customerVehicles.length === 0 && <div className="px-3 py-2 text-xs text-gray-500">No vehicles on file</div>}
                {customerVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {buildVehicleInfo(v)}{v.license_plate ? ` · ${v.license_plate}` : ""}
                  </SelectItem>
                ))}
                <button
                  type="button"
                  onClick={() => setShowNewVehicle(true)}
                  className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm border-t border-gray-700"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Vehicle
                </button>
              </SelectContent>
            </Select>
          </>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                value={custSearch}
                onChange={(e) => onCustSearchChange(e.target.value)}
                onFocus={() => searchCustomers(custSearch)}
                onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
                placeholder="Search customer by name or phone..."
                className="bg-gray-950 border-gray-700 text-white pl-8"
              />
              {showCustDropdown && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl text-left">
                  <button
                    type="button"
                    onMouseDown={() => { setShowCustDropdown(false); setShowNewCustomer(true); }}
                    className="w-full px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-sm flex items-center gap-2 border-b border-gray-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Customer
                  </button>
                  {custDropdown.length > 0 ? (
                    custDropdown.map((c) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)} className="w-full px-3 py-2 hover:bg-sky-500/20 text-sm text-white flex justify-between">
                        <span>{c.full_name}</span>
                        <span className="text-gray-400 text-xs">{c.phone}</span>
                      </button>
                    ))
                  ) : (
                    custSearch.trim() && <div className="px-3 py-2 text-xs text-gray-500">No matching customers</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              className="mt-1 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2"
            >
              <Plus className="w-3 h-3" /> New Customer
            </button>
          </>
        )}
      </div>

      {/* New Customer dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-gray-400">Full Name *</Label>
              <Input
                value={newCust.full_name}
                onChange={(e) => setNewCust({ ...newCust, full_name: capWords(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label className="text-gray-400">Phone *</Label>
              <Input
                type="tel"
                data-no-capitalize
                value={newCust.phone}
                onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="(613) 555-0100"
              />
            </div>
            <div>
              <Label className="text-gray-400">Email (optional)</Label>
              <Input
                type="email"
                data-no-capitalize
                value={newCust.email}
                onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label className="text-gray-400">Address (optional)</Label>
              <Input
                value={newCust.address}
                onChange={(e) => setNewCust({ ...newCust, address: capWords(e.target.value) })}
                className="bg-gray-800 border-gray-700 text-white mt-1"
                placeholder="123 Main St"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewCustomer(false)} className="border-gray-700 text-gray-300 flex-1">Cancel</Button>
            <Button onClick={saveNewCustomer} disabled={savingCust} className="bg-sky-500 hover:bg-sky-600 flex-1 gap-2">
              {savingCust ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Save Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Vehicle dialog */}
      <Dialog open={showNewVehicle} onOpenChange={setShowNewVehicle}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Vehicle — {customerName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Make *</Label>
              <Input value={newVeh.make} onChange={(e) => setNewVeh({ ...newVeh, make: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Honda" />
            </div>
            <div>
              <Label className="text-gray-400">Model *</Label>
              <Input value={newVeh.model} onChange={(e) => setNewVeh({ ...newVeh, model: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Civic" />
            </div>
            <div>
              <Label className="text-gray-400">Year *</Label>
              <Input type="number" value={newVeh.year} onChange={(e) => setNewVeh({ ...newVeh, year: e.target.value })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="2019" />
            </div>
            <div>
              <Label className="text-gray-400">Trim (optional)</Label>
              <Input value={newVeh.trim} onChange={(e) => setNewVeh({ ...newVeh, trim: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="EX" />
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400">Engine (optional)</Label>
              <Input value={newVeh.engine_type} onChange={(e) => setNewVeh({ ...newVeh, engine_type: e.target.value })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="1.5L 4-Cyl" />
            </div>
            <div className="col-span-2">
              <Label className="text-gray-400">VIN (optional)</Label>
              <Input data-no-capitalize value={newVeh.vin} onChange={(e) => setNewVeh({ ...newVeh, vin: e.target.value.toUpperCase() })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="17 characters" />
            </div>
            <div>
              <Label className="text-gray-400">License Plate (optional)</Label>
              <Input data-no-capitalize value={newVeh.license_plate} onChange={(e) => setNewVeh({ ...newVeh, license_plate: e.target.value.toUpperCase() })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="ABCD123" />
            </div>
            <div>
              <Label className="text-gray-400">Color (optional)</Label>
              <Input value={newVeh.color} onChange={(e) => setNewVeh({ ...newVeh, color: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Black" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowNewVehicle(false)} className="border-gray-700 text-gray-300 flex-1">Cancel</Button>
            <Button onClick={saveNewVehicle} disabled={savingVeh} className="bg-sky-500 hover:bg-sky-600 flex-1 gap-2">
              {savingVeh ? <Loader2 className="w-4 h-4 animate-spin" /> : null}Save Vehicle
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}