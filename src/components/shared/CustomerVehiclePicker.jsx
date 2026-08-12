import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Loader2, User, Car, RefreshCw, Phone, Mail, MapPin } from "lucide-react";
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
  const [vehOpen, setVehOpen] = useState(false);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedVehicle = customerVehicles.find((v) => v.id === vehicleId);
  const customerPhone = selectedCustomer?.phone || "";
  const customerEmail = selectedCustomer?.email || "";
  const vehicleVin = selectedVehicle?.vin || "";
  const vehiclePlate = selectedVehicle?.license_plate || "";
  const vehicleColor = selectedVehicle?.color || "";
  const vehicleTrim = selectedVehicle?.trim_level || selectedVehicle?.trim || "";
  const vehicleEngine = selectedVehicle?.engine_type || "";
  const vehicleFuel = selectedVehicle?.fuel_type || "";
  const vehicleEngineLiters = selectedVehicle?.engine_liters || "";
  // Bold identity line: Year Make Model Trim (engine lives in a muted line below)
  const vehicleHeadline = [selectedVehicle?.year, selectedVehicle?.make, selectedVehicle?.model, vehicleTrim]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean)
    .join(" ");
  // Engine detail line: prefer engine_type, else liters, plus fuel type
  const engineLine = [vehicleEngine || vehicleEngineLiters, vehicleFuel]
    .map((x) => (x == null ? "" : String(x).trim()))
    .filter(Boolean)
    .join(" · ");

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
        {customerSelected ? (
        <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Customer</p>
                <p className="truncate text-base font-bold text-white">{customerName}</p>
                {customerPhone && <p className="truncate text-xs text-gray-400">{customerPhone}</p>}
                {customerEmail && <p className="truncate text-xs text-gray-400">{customerEmail}</p>}
              </div>
              <button
                type="button"
                onClick={clearCustomer}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-gray-600 bg-transparent px-3 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
              >
                <RefreshCw className="w-3 h-3" /> Change
              </button>
            </div>
            <div className="flex items-start gap-3 sm:border-l sm:border-gray-700 sm:pl-4">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                <Car className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Vehicle</p>
                <p className="truncate text-base font-bold text-white">{vehicleHeadline || vehicleInfo || "—"}</p>
                {engineLine && <p className="truncate text-xs text-gray-400">{engineLine}</p>}
                {(vehicleVin || vehiclePlate || vehicleColor) && (
                  <p className="truncate text-xs text-gray-400">
                    {vehicleVin && `VIN: ${vehicleVin}`}
                    {vehicleVin && (vehiclePlate || vehicleColor) && " · "}
                    {vehiclePlate && `Plate: ${vehiclePlate}`}
                    {vehiclePlate && vehicleColor && " · "}
                    {vehicleColor && `Color: ${vehicleColor}`}
                  </p>
                )}
              </div>
              <Select value={vehicleId || ""} onValueChange={handleVehicleChange} open={vehOpen} onOpenChange={setVehOpen}>
                <SelectTrigger className="h-7 w-auto shrink-0 items-center gap-1.5 self-start rounded-full border border-gray-600 bg-transparent px-3 text-xs font-medium text-gray-300 shadow-none hover:bg-gray-700 hover:text-white">
                  <RefreshCw className="w-3 h-3" /> Change
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
                    onClick={() => { setVehOpen(false); setShowNewVehicle(true); }}
                    className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm border-t border-gray-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add New Vehicle
                  </button>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-700 bg-gray-800/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-sky-400" /> Customer
          </p>
          <div className="relative mt-2">
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
            className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> New Customer
          </button>
        </div>
      )}

      {/* New Customer dialog */}
      <Dialog open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Customer Information</h4>
            <div className="flex-1 h-px bg-gray-700" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Full Name *</Label>
              <div className="relative mt-1">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <Input
                  value={newCust.full_name}
                  onChange={(e) => setNewCust({ ...newCust, full_name: capWords(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white pl-8"
                  placeholder="John Smith"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Phone *</Label>
              <div className="relative mt-1">
                <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <Input
                  type="tel"
                  data-no-capitalize
                  value={newCust.phone}
                  onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white pl-8"
                  placeholder="(613) 555-0100"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-gray-400">Email (optional)</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <Input
                  type="email"
                  data-no-capitalize
                  value={newCust.email}
                  onChange={(e) => setNewCust({ ...newCust, email: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white pl-8"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-gray-400">Address (optional)</Label>
              <div className="relative mt-1">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <Input
                  value={newCust.address}
                  onChange={(e) => setNewCust({ ...newCust, address: capWords(e.target.value) })}
                  className="bg-gray-800 border-gray-700 text-white pl-8"
                  placeholder="123 Main St"
                />
              </div>
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
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Information</h4>
            <div className="flex-1 h-px bg-gray-700" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Year *</Label>
              <Input type="number" value={newVeh.year} onChange={(e) => setNewVeh({ ...newVeh, year: e.target.value })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="2019" />
            </div>
            <div>
              <Label className="text-gray-400">Make *</Label>
              <div className="relative mt-1">
                <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <Input value={newVeh.make} onChange={(e) => setNewVeh({ ...newVeh, make: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white pl-8" placeholder="Honda" />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Model *</Label>
              <Input value={newVeh.model} onChange={(e) => setNewVeh({ ...newVeh, model: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="Civic" />
            </div>
            <div>
              <Label className="text-gray-400">Trim (optional)</Label>
              <Input value={newVeh.trim} onChange={(e) => setNewVeh({ ...newVeh, trim: capWords(e.target.value) })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="EX" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-gray-400">Engine (optional)</Label>
              <Input value={newVeh.engine_type} onChange={(e) => setNewVeh({ ...newVeh, engine_type: e.target.value })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="1.5L 4-Cyl" />
            </div>
            <div>
              <Label className="text-gray-400">VIN (optional)</Label>
              <Input data-no-capitalize value={newVeh.vin} onChange={(e) => setNewVeh({ ...newVeh, vin: e.target.value.toUpperCase() })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="17 characters" />
              <p className="mt-1 text-[10px] text-gray-500">VIN is optional</p>
            </div>
            <div>
              <Label className="text-gray-400">License Plate (optional)</Label>
              <Input data-no-capitalize value={newVeh.license_plate} onChange={(e) => setNewVeh({ ...newVeh, license_plate: e.target.value.toUpperCase() })} className="bg-gray-800 border-gray-700 text-white mt-1" placeholder="ABCD123" />
              <p className="mt-1 text-[10px] text-gray-500">Plate is optional</p>
            </div>
            <div className="sm:col-span-2">
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