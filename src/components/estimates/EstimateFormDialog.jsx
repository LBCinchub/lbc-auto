import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, X, Search, CheckCircle2 } from "lucide-react";
import { useNhtsaVinDecode } from "@/hooks/useNhtsaVinDecode";
import { useToast } from "@/components/ui/use-toast";

const emptyLaborRow = () => ({ description: "", hours: "", rate: "120", total: 0 });
const emptyPartRow  = () => ({ name: "", part_number: "", quantity: "", unit_price: "", total: 0 });

const emptyForm = {
  customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "",
  status: "draft", notes: "", tax_rate: "0", apply_tax: true, tax_applies_to: "both", valid_until: "",
  discount_type: "none", discount_value: 0,
  labor_items: [emptyLaborRow()],
  parts_items: [emptyPartRow()],
  repair_order_id: "",
};

export default function EstimateFormDialog({ open, onClose, estimate, customers, vehicles, parts = [], repairOrderId, onSaved }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [newCustomerForm, setNewCustomerForm] = useState(null);
  const queryClient = useQueryClient();
  const [newVehicleForm, setNewVehicleForm] = useState(null);
  const { decoding: decodingVin, vinError: vinDecodeError, decodeVin: nhtsaDecode, setVinError: setVinDecodeError } = useNhtsaVinDecode();
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdown, setCustomerDropdown] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState(null); // { customer, vehicles }
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [partSearch, setPartSearch] = useState("");
  const [showPartSearch, setShowPartSearch] = useState(null);
  const [localVehicles, setLocalVehicles] = useState([]);
  const [localCustomers, setLocalCustomers] = useState([]);
  const [fetchedVehicles, setFetchedVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const { toast } = useToast();
  const searchDebounce = useRef(null);

  useEffect(() => {
    // Load user's saved tax rate
    base44.auth.me().then(u => {
      const userTaxRate     = u?.tax_rate     != null ? u.tax_rate     : 0;
      const userTaxApplies  = u?.tax_applies_to || "both";
      
      if (estimate && estimate.id) {
        // Editing an existing estimate — use user's tax rate
        setForm({
          ...emptyForm,
          ...estimate,
          apply_tax: estimate.apply_tax !== false,
          tax_rate: estimate.tax_rate != null ? String(estimate.tax_rate) : String(userTaxRate),
          tax_applies_to: estimate.tax_applies_to || userTaxApplies,
          discount_type: estimate.discount_type || "none",
          discount_value: estimate.discount_value || 0,
          labor_items: estimate.labor_items?.length ? estimate.labor_items.map(i => ({ ...i, hours: String(i.hours), rate: String(i.rate ?? 120) })) : [emptyLaborRow()],
          parts_items: estimate.parts_items?.length ? estimate.parts_items.map(i => ({ ...i, quantity: String(i.quantity), unit_price: String(i.unit_price) })) : [emptyPartRow()],
        });
      } else {
        // New estimate — use user's tax rate
        const prefillVehicleId = estimate?._prefillVehicleId || estimate?.vehicle_id || "";
        const prefillVehicleInfo = estimate?._prefillVehicleInfo || estimate?.vehicle_info || "";
        setForm({
          ...emptyForm,
          repair_order_id: repairOrderId || "",
          customer_id: estimate?.customer_id || "",
          customer_name: estimate?.customer_name || "",
          vehicle_id: prefillVehicleId,
          vehicle_info: prefillVehicleInfo,
          tax_rate: String(userTaxRate),
          tax_applies_to: userTaxApplies,
        });
      }
    });
  }, [estimate?.id, open, repairOrderId]);

  // Reactive vehicle fetch whenever customer changes
  useEffect(() => {
    if (!form.customer_id) { setFetchedVehicles([]); return; }
    setLoadingVehicles(true);
    base44.entities.Vehicle.filter({ customer_id: form.customer_id })
      .then(vehs => setFetchedVehicles(vehs))
      .finally(() => setLoadingVehicles(false));
  }, [form.customer_id]);

  // Pre-fill customer search box and customer info card when editing an existing record
  useEffect(() => {
    if (!estimate?.customer_id) return;
    const nameFromRecord = estimate.customer_name || "";
    // Immediately show stored name as fallback
    setCustomerSearch(nameFromRecord);
    // Then fetch the live customer record to populate the info card
    base44.entities.Customer.get(estimate.customer_id)
      .then(c => {
        if (c) {
          setCustomerSearch(c.full_name || nameFromRecord);
          base44.entities.Vehicle.filter({ customer_id: c.id }).then(vehs => {
            setSelectedCustomerInfo({ customer: c, vehicles: vehs });
          });
        }
      })
      .catch(() => {
        // fallback already set above
      });
  }, [estimate?.customer_id]);

  // Bug 1: Live customer search with debounce
  const searchCustomers = useCallback(async (q) => {
    if (!q.trim()) { setCustomerDropdown([]); setShowCustomerDropdown(false); return; }
    const all = await base44.entities.Customer.list();
    const lower = q.toLowerCase();
    const results = all.filter(c =>
      c.full_name.toLowerCase().includes(lower) || (c.phone || "").includes(q)
    );
    setCustomerDropdown(results.slice(0, 8));
    setShowCustomerDropdown(true);
  }, []);

  const handleCustomerSearchChange = (val) => {
    setCustomerSearch(val);
    if (form.customer_id) {
      // Clear selection when user types again
      setForm(f => ({ ...f, customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "" }));
      setSelectedCustomerInfo(null);
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchCustomers(val), 300);
  };

  // Bug 2: Fetch selected customer info + their vehicles
  const selectCustomerFromDropdown = useCallback(async (c) => {
    // Set both customer_id and customer_name directly from the selected object
    setForm(f => ({ ...f, customer_id: c.id, customer_name: c.full_name || "", vehicle_id: "", vehicle_info: "" }));
    setCustomerSearch(c.full_name);
    setShowCustomerDropdown(false);
    setCustomerDropdown([]);
    // Fetch their vehicles
    const vehs = await base44.entities.Vehicle.filter({ customer_id: c.id });
    setSelectedCustomerInfo({ customer: c, vehicles: vehs });
    setValidationErrors(e => ({ ...e, customer: "" }));
  }, []);

  const allCustomers = useMemo(() => {
    const ids = new Set(customers.map(c => c.id));
    return [...customers, ...localCustomers.filter(c => !ids.has(c.id))];
  }, [customers, localCustomers]);

  const filteredCustomers = allCustomers.filter(c =>
    !customerSearch || c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.phone || "").includes(customerSearch)
  );

  // customerVehicles = fetched vehicles + any locally-created ones for this customer
  const customerVehicles = useMemo(() => {
    const fetched = fetchedVehicles;
    const ids = new Set(fetched.map(v => v.id));
    return [...fetched, ...localVehicles.filter(v => v.customer_id === form.customer_id && !ids.has(v.id))];
  }, [fetchedVehicles, localVehicles, form.customer_id]);

  const filteredVehicles = customerVehicles.filter(v =>
    !vehicleSearch || `${v.year} ${v.make} ${v.model} ${v.license_plate || ""}`.toLowerCase().includes(vehicleSearch.toLowerCase())
  );



  const filteredParts = parts.filter(p =>
    !partSearch || p.name.toLowerCase().includes(partSearch.toLowerCase()) || (p.part_number || "").toLowerCase().includes(partSearch.toLowerCase())
  );

  const selectPartFromInventory = (idx, part) => {
    const items = form.parts_items.map((row, i) => {
      if (i !== idx) return row;
      const qty = parseFloat(row.quantity) || 1;
      return { ...row, name: part.name, part_number: part.part_number || "", unit_price: String(part.sale_price || 0), total: qty * (part.sale_price || 0) };
    });
    setForm(f => ({ ...f, parts_items: items }));
    setShowPartSearch(null);
    setPartSearch("");
  };

  // ---- Labor helpers ----
  const updateLabor = (idx, field, value) => {
    setForm(f => {
      const items = f.labor_items.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [field]: value };
        updated.total = (parseFloat(updated.hours) || 0) * (parseFloat(updated.rate) || 0);
        return updated;
      });
      return { ...f, labor_items: items };
    });
  };
  const addLabor = () => setForm(f => ({ ...f, labor_items: [...f.labor_items, emptyLaborRow()] }));
  const removeLabor = (idx) => setForm(f => ({ ...f, labor_items: f.labor_items.filter((_, i) => i !== idx) }));

  // ---- Parts helpers ----
  const updatePart = (idx, field, value) => {
    setForm(f => {
      const items = f.parts_items.map((row, i) => {
        if (i !== idx) return row;
        const updated = { ...row, [field]: value };
        updated.total = (parseFloat(updated.quantity) || 0) * (parseFloat(updated.unit_price) || 0);
        return updated;
      });
      return { ...f, parts_items: items };
    });
  };
  const addPart = () => setForm(f => ({ ...f, parts_items: [...f.parts_items, emptyPartRow()] }));
  const removePart = (idx) => setForm(f => ({ ...f, parts_items: f.parts_items.filter((_, i) => i !== idx) }));

  // ---- Totals ----
  // Compute totals inline from raw field values — never rely on stale r.total in state
  const laborTotal = form.labor_items.reduce((s, r) => s + (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0), 0);
  const partsTotal = form.parts_items.reduce((s, r) => s + (parseFloat(r.quantity) || 0) * (parseFloat(r.unit_price) || 0), 0);
  const subtotal   = laborTotal + partsTotal;
  const discountAmount = form.discount_type === "percentage"
    ? subtotal * ((form.discount_value || 0) / 100)
    : form.discount_type === "fixed" ? (form.discount_value || 0) : 0;
  const subtotalAfterDiscount = subtotal - discountAmount;
  const taxRate    = form.apply_tax ? (parseFloat(form.tax_rate) || 0) : 0;

  const taxAppliesTo = form.tax_applies_to || "both";
  let taxableAmount = 0;
  if (taxAppliesTo === "labor") taxableAmount = laborTotal;
  else if (taxAppliesTo === "parts") taxableAmount = partsTotal;
  else taxableAmount = subtotalAfterDiscount;

  const taxAmount  = taxableAmount * (taxRate / 100);
  const grandTotal = subtotalAfterDiscount + taxAmount;

  const handleCustomerChange = (cid) => {
    const customer = allCustomers.find(c => c.id === cid);
    setForm(f => ({ ...f, customer_id: cid, customer_name: customer?.full_name || "", vehicle_id: "", vehicle_info: "" }));
  };

  const clearCustomerSelection = () => {
    setForm(f => ({ ...f, customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "" }));
    setSelectedCustomerInfo(null);
    setCustomerSearch("");
  };

  const handleVehicleChange = (vid) => {
    const v = customerVehicles.find(v => v.id === vid);
    setForm(f => ({ ...f, vehicle_id: vid, vehicle_info: v ? `${v.year} ${v.make} ${v.model}` : "" }));
  };

  const saveNewCustomer = async () => {
    if (!newCustomerForm?.full_name || !newCustomerForm?.phone) return;
    const created = await base44.entities.Customer.create({
      full_name: newCustomerForm.full_name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || "",
    });
    setLocalCustomers(prev => [...prev, created]);
    handleCustomerChange(created.id);
    setCustomerSearch(created.full_name);
    setSelectedCustomerInfo({ customer: created, vehicles: [] });
    setNewCustomerForm(null);
    setValidationErrors(e => ({ ...e, customer: "" }));
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.refetchQueries({ queryKey: ["customers"] });
  };

  const decodeVinForNewVehicle = async () => {
    const result = await nhtsaDecode(newVehicleForm?.vin);
    if (result) {
      setNewVehicleForm(prev => ({
        ...prev,
        make: result.make || prev.make,
        model: result.model || prev.model,
        year: result.year || prev.year,
        engine_type: result.engine_type || prev.engine_type,
      }));
    }
  };

  const saveNewVehicle = async () => {
    if (!newVehicleForm?.make || !newVehicleForm?.model || !newVehicleForm?.year) return;
    const created = await base44.entities.Vehicle.create({
      customer_id: form.customer_id,
      customer_name: form.customer_name,
      vin: newVehicleForm.vin || "",
      make: newVehicleForm.make,
      model: newVehicleForm.model,
      year: Number(newVehicleForm.year),
      license_plate: newVehicleForm.license_plate || "",
      color: newVehicleForm.color || "",
      engine_type: newVehicleForm.engine_type || "",
    });
    setLocalVehicles(prev => [...prev, created]);
    setForm(f => ({ ...f, vehicle_id: created.id, vehicle_info: `${created.year} ${created.make} ${created.model}` }));
    setNewVehicleForm(null);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.refetchQueries({ queryKey: ["vehicles"] });
  };

  const handleSave = async () => {
    if (saving) return; // prevent double-submit
    const errors = {};
    if (!form.customer_id) errors.customer = "Please select a customer";
    if (!form.vehicle_id) errors.vehicle = "Please select a vehicle";
    const hasLineItem =
      form.labor_items.some(r => r.description?.trim()) ||
      form.parts_items.some(r => r.name?.trim());
    if (!hasLineItem) errors.lineItems = "Please add at least one labor or parts row";
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    setSaveError("");
    setSaving(true);
    try {
      const estNum = estimate?.estimate_number || `EST-${Date.now().toString().slice(-6)}`;
      const payload = {
        ...form,
        estimate_number: estNum,
        apply_tax: form.apply_tax,
        tax_applies_to: form.tax_applies_to || "both",
        tax_rate: taxRate,
        discount_type: form.discount_type || "none",
        discount_value: form.discount_value || 0,
        discount_amount: discountAmount,
        labor_items: form.labor_items.map(r => ({ ...r, hours: parseFloat(r.hours) || 0, rate: parseFloat(r.rate) || 120 })),
        parts_items: form.parts_items.map(r => ({ ...r, quantity: parseFloat(r.quantity) || 0, unit_price: parseFloat(r.unit_price) || 0 })),
        labor_total: laborTotal,
        parts_total: partsTotal,
        tax_amount: taxAmount,
        grand_total: grandTotal,
      };

      if (estimate && estimate.id) {
        await base44.entities.Estimate.update(estimate.id, payload);

        let roUpdated = false;
        let invUpdated = false;

        // Sync to linked Repair Order — match by estimate_id (limit 1)
        try {
          const linkedROs = await base44.entities.RepairOrder.filter({ estimate_id: estimate.id });
          const ro = linkedROs[0] || null;
          if (ro) {
            await base44.entities.RepairOrder.update(ro.id, {
              customer_name: payload.customer_name,
              vehicle_info: payload.vehicle_info,
              labor_items: payload.labor_items,
              parts_used: payload.parts_items.map(p => ({ name: p.name, part_number: p.part_number || "", quantity: p.quantity, unit_price: p.unit_price, total: p.total })),
              total_cost: payload.grand_total,
            });
            roUpdated = true;
          }
        } catch (e) { console.warn("Sync to repair order failed:", e); }

        // Sync to linked Invoice — match by estimate_id (limit 1)
        try {
          const linkedInvs = await base44.entities.Invoice.filter({ estimate_id: estimate.id });
          const inv = linkedInvs[0] || null;
          if (inv) {
            const newBalanceDue = payload.grand_total - (inv.amount_paid || 0);
            await base44.entities.Invoice.update(inv.id, {
              customer_name: payload.customer_name,
              vehicle_info: payload.vehicle_info,
              labor_total: payload.labor_total,
              parts_total: payload.parts_total,
              tax_amount: payload.tax_amount,
              total: payload.grand_total,
              balance_due: newBalanceDue > 0 ? newBalanceDue : 0,
            });
            invUpdated = true;
          }
        } catch (e) { console.warn("Sync to invoice failed:", e); }

        // Single toast — one message reflecting what was updated
        let toastMsg = "Estimate saved successfully";
        if (roUpdated && invUpdated) toastMsg = "Estimate saved — Repair Order & Invoice updated";
        else if (roUpdated) toastMsg = "Estimate saved — Repair Order updated";
        else if (invUpdated) toastMsg = "Estimate saved — Invoice updated";
        toast({ title: toastMsg });
      } else {
        await base44.entities.Estimate.create(payload);
        toast({ title: "Estimate saved successfully" });
      }

      setSaving(false);
      onSaved();
      onClose();
    } catch (err) {
      setSaving(false);
      setSaveError("Failed to save — please try again");
    }
  };

  const canSave = true; // Never disable — validate on click instead

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl flex flex-col p-0" style={{ maxHeight: "90vh", height: "90vh" }}>
        {/* Fixed header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800">
          <DialogHeader>
            <DialogTitle>{estimate ? "Edit Estimate" : "New Service Estimate"}</DialogTitle>
          </DialogHeader>
          {saveError && (
            <div className="mt-3 px-3 py-2 rounded-md bg-rose-500/10 border border-rose-500/40 text-rose-400 text-sm">
              {saveError}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-6">
           {/* Customer & Vehicle */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
               <Label className="text-gray-400">Customer *</Label>
               <div className="relative mt-1">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                 <Input
                   value={customerSearch}
                   onChange={e => handleCustomerSearchChange(e.target.value)}
                   onFocus={() => { if (customerDropdown.length > 0) setShowCustomerDropdown(true); }}
                   onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                   placeholder="Search customer by name or phone..."
                   className={`bg-gray-800 border-gray-700 text-white pl-8 ${validationErrors.customer ? "border-rose-500" : ""}`}
                 />
                 {showCustomerDropdown && customerDropdown.length > 0 && (
                   <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
                     {customerDropdown.map(c => (
                       <button key={c.id} onMouseDown={() => selectCustomerFromDropdown(c)}
                         className="w-full px-3 py-2 text-left hover:bg-sky-500/20 text-sm text-white flex justify-between">
                         <span>{c.full_name}</span>
                         <span className="text-gray-400 text-xs">{c.phone}</span>
                       </button>
                     ))}
                   </div>
                 )}
                 {showCustomerDropdown && customerSearch && customerDropdown.length === 0 && (
                   <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl px-3 py-2 text-xs text-gray-500">
                     No customers found
                   </div>
                 )}
               </div>
               {validationErrors.customer && <p className="text-rose-400 text-xs mt-1">{validationErrors.customer}</p>}

               {/* Bug 2: Customer info card */}
               {selectedCustomerInfo && (
                 <div className="mt-2 rounded-lg border border-sky-500/30 bg-gray-800/60 p-3 text-xs space-y-1">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1.5 text-sky-400 font-medium">
                       <CheckCircle2 className="w-3.5 h-3.5" />
                       {selectedCustomerInfo.customer.full_name}
                     </div>
                     <button onClick={clearCustomerSelection} className="text-gray-500 hover:text-gray-300 text-xs underline">Change</button>
                   </div>
                   {selectedCustomerInfo.customer.phone && <p className="text-gray-400">📞 {selectedCustomerInfo.customer.phone}</p>}
                   {selectedCustomerInfo.customer.email && <p className="text-gray-400">✉️ {selectedCustomerInfo.customer.email}</p>}
                   <div className="pt-1 border-t border-gray-700">
                     {selectedCustomerInfo.vehicles.length > 0 ? (
                       selectedCustomerInfo.vehicles.map(v => (
                         <p key={v.id} className="text-gray-300">{v.year} {v.make} {v.model}{v.license_plate ? ` — Plate: ${v.license_plate}` : ""}</p>
                       ))
                     ) : (
                       <p className="text-gray-500 italic">No vehicles on file — you can add one after saving.</p>
                     )}
                   </div>
                 </div>
               )}

               {newCustomerForm !== null ? (
                 <div className="bg-gray-800 border border-sky-500/30 rounded-lg p-3 space-y-2 mt-2">
                   <div className="flex items-center justify-between">
                     <p className="text-xs text-sky-400 font-medium">New Customer</p>
                     <button onClick={() => setNewCustomerForm(null)} className="text-gray-500 hover:text-gray-300"><X className="w-3.5 h-3.5" /></button>
                   </div>
                   <Input value={newCustomerForm.full_name} onChange={e => setNewCustomerForm({...newCustomerForm, full_name: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Full name *" />
                   <Input value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Phone number *" />
                   <Input value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})}
                     className="bg-gray-700 border-gray-600 text-white" placeholder="Email" />
                   <Button size="sm" onClick={saveNewCustomer} disabled={!newCustomerForm.full_name || !newCustomerForm.phone} className="bg-sky-500 hover:bg-sky-600 text-white w-full">Save Customer</Button>
                 </div>
               ) : (
                 <button onClick={() => setNewCustomerForm({ full_name: "", phone: "", email: "" })}
                   className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2">
                   <Plus className="w-3 h-3" /> New customer
                 </button>
               )}
             </div>
             <div>
               <Label className="text-gray-400">Vehicle *</Label>
               {validationErrors.vehicle && <p className="text-rose-400 text-xs mt-1">{validationErrors.vehicle}</p>}
               {newVehicleForm !== null ? (
                 <div className="bg-gray-800 border border-sky-500/30 rounded-lg p-2 mt-1 space-y-2">
                   <input value={newVehicleForm.vin} onChange={e => { setNewVehicleForm({...newVehicleForm, vin: e.target.value}); setVinDecodeError(""); }}
                     className="w-full px-2 py-1 bg-gray-700 border-gray-600 text-white rounded text-xs" placeholder="VIN (17 characters, optional)" />
                   {newVehicleForm.vin && (
                     <Button size="sm" onClick={decodeVinForNewVehicle} disabled={decodingVin} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs">
                       {decodingVin ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Decoding...</> : "Decode VIN"}
                     </Button>
                   )}
                   {vinDecodeError && <p className="text-rose-400 text-xs">{vinDecodeError}</p>}
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
                   <Select value={form.vehicle_id} onValueChange={(v) => { handleVehicleChange(v); setVehicleSearch(""); }} disabled={!form.customer_id || loadingVehicles}>
                       <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                         <SelectValue placeholder={loadingVehicles ? "Loading vehicles..." : "Select vehicle..."} />
                       </SelectTrigger>
                       <SelectContent className="bg-gray-800 border-gray-700 text-white">
                         {loadingVehicles && <div className="px-3 py-2 text-xs text-gray-500">Loading vehicles...</div>}
                         {!loadingVehicles && customerVehicles.length > 3 && (
                           <div className="px-2 pb-1 pt-1">
                             <div className="relative">
                               <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                               <input
                                 value={vehicleSearch}
                                 onChange={e => setVehicleSearch(e.target.value)}
                                 placeholder="Search vehicle..."
                                 className="w-full pl-7 pr-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none"
                                 onKeyDown={e => e.stopPropagation()}
                                 onClick={e => e.stopPropagation()}
                               />
                             </div>
                           </div>
                         )}
                         {!loadingVehicles && filteredVehicles.map(v => (
                           <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model} {v.license_plate ? `(${v.license_plate})` : ""}</SelectItem>
                         ))}
                         {!loadingVehicles && form.customer_id && filteredVehicles.length === 0 && (
                           <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", license_plate: "", color: "", engine_type: "" })}
                             className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm">
                             <Plus className="w-3.5 h-3.5" /> Add vehicle
                           </button>
                         )}
                       </SelectContent>
                     </Select>
                   {form.customer_id && customerVehicles.length > 0 && (
                   <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", license_plate: "", color: "", engine_type: "" })}
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
              <Label className="text-gray-400">Tax ({parseFloat(form.tax_rate) || 0}%)</Label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, apply_tax: !f.apply_tax }))}
                  className={`flex-1 h-9 rounded-md border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    form.apply_tax
                      ? "bg-sky-500/20 border-sky-500 text-sky-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${form.apply_tax ? "bg-sky-400" : "bg-gray-600"}`} />
                  {form.apply_tax ? "Applied" : "Not Applied"}
                </button>
                {form.apply_tax && (
                  <Select value={form.tax_applies_to || "both"} onValueChange={v => setForm(f => ({ ...f, tax_applies_to: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-24 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      <SelectItem value="both">Both</SelectItem>
                      <SelectItem value="labor">Labor</SelectItem>
                      <SelectItem value="parts">Parts</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
                className="bg-gray-800 border-gray-700 text-white mt-1" />
            </div>
          </div>

          {/* Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-400">Discount</Label>
              <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value, discount_value: 0 }))}
                className="w-full mt-1 h-9 rounded-md bg-gray-800 border border-gray-700 text-white px-2 text-sm">
                <option value="none">No Discount</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            {form.discount_type !== "none" && (
              <div>
                <Label className="text-gray-400">{form.discount_type === "percentage" ? "Discount %" : "Discount $"}</Label>
                <Input type="number" onFocus={e => e.target.select()} step="0.01" min="0"
                  value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            )}
          </div>

          {/* Labor Items */}
          <div>
            {validationErrors.lineItems && <p className="text-rose-400 text-xs mb-2">{validationErrors.lineItems}</p>}
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
                        <Input type="number" onFocus={e => e.target.select()} value={row.hours} onChange={e => updateLabor(idx, "hours", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" step="0.5" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={row.rate} onChange={e => updateLabor(idx, "rate", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="120" step="1" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.hours)||0)*(parseFloat(row.rate)||0)).toFixed(2)}</td>
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
           <div className="rounded-lg border border-gray-800 overflow-hidden" style={{ maxHeight: "220px", overflowY: "auto" }}>
             <table className="w-full text-sm">
               <thead className="bg-gray-800/60 text-gray-500 text-xs sticky top-0">
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
                    <React.Fragment key={idx}>
                    <tr className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <Input value={row.name} onChange={e => updatePart(idx, "name", e.target.value)}
                            className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Oil Filter" />
                          {parts.length > 0 && (
                            <button onClick={() => { setShowPartSearch(showPartSearch === idx ? null : idx); setPartSearch(""); }}
                              className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded bg-gray-700 hover:bg-sky-500/30 text-gray-400 hover:text-sky-400 transition-colors"
                              title="Search inventory">
                              <Search className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showPartSearch === idx && (
                          <div className="mt-1">
                            <input
                              value={partSearch}
                              onChange={e => setPartSearch(e.target.value)}
                              placeholder="Search inventory..."
                              autoFocus
                              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white placeholder-gray-500 focus:outline-none"
                            />
                            <div className="mt-1 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-800">
                              {filteredParts.slice(0, 10).map(p => (
                                <button key={p.id} onClick={() => selectPartFromInventory(idx, p)}
                                  className="w-full px-2 py-1.5 text-left hover:bg-sky-500/20 text-xs text-white flex justify-between gap-2">
                                  <span className="font-medium truncate">{p.name}</span>
                                  <span className="text-gray-400 flex-shrink-0">${(p.sale_price || 0).toFixed(2)}</span>
                                </button>
                              ))}
                              {filteredParts.length === 0 && <div className="px-2 py-2 text-xs text-gray-500">No parts found</div>}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={row.part_number} onChange={e => updatePart(idx, "part_number", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="SKU" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={row.quantity} onChange={e => updatePart(idx, "quantity", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={row.unit_price} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0.00" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${row.total.toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => removePart(idx)} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      </tr>
                      </React.Fragment>
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
            {discountAmount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount {form.discount_type === "percentage" ? `(${form.discount_value}%)` : ""}</span>
                <span>-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400 border-t border-gray-700/50 pt-2"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-400">
              <span>Tax ({parseFloat(form.tax_rate) || 0}%)</span>
              <span className={form.apply_tax ? "" : "line-through opacity-50"}>{form.apply_tax ? `$${taxAmount.toFixed(2)}` : "Not applied"}</span>
            </div>
            <div className="flex justify-between font-bold border-t border-gray-700 pt-2 mt-2" style={{ fontSize: "18px", color: "#00d4ff" }}>
              <span>Grand Total</span>
              <span>${grandTotal.toFixed(2)}</span>
            </div>
          </div>

        </div>{/* end space-y-6 */}
        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="flex-shrink-0 bg-gray-900 px-6 py-4 border-t border-gray-800 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-sky-500 hover:bg-sky-600">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : "Save Estimate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}