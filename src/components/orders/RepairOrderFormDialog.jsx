import React, { useState, useEffect, useMemo, useRef } from "react";
import { fuzzyMatch } from "@/utils/fuzzySearch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import { syncCustomerActivity, validateRecord } from "@/utils/syncCustomerActivity";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, Loader2, CreditCard, User, Car, Phone, Mail, MapPin } from "lucide-react";
import { useNhtsaVinDecode } from "@/hooks/useNhtsaVinDecode";
import { useToast } from "@/components/ui/use-toast";
import { resolveVehicleId } from "@/utils/recordLinking";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";

import CustomerSearchInput from "@/components/shared/CustomerSearchInput";
import { capWords, toTitleCase, capitalizeFields, capitalizeArrayItems } from "@/utils/capitalize";
import UnifiedFinancialActionBar from "@/components/financial-workflow/UnifiedFinancialActionBar";
import { laborRate, normalizeLaborItems, normalizeParts, inventoryDeltas, isPersisted } from "@/lib/repairOrderSave";
import { roFormPolicy, fillFromSourceEstimate, roTotals, roSavePolicy } from "@/lib/repairOrderTotals";
import { readDiscount, toDocumentDiscount } from "@/lib/financialPolicy";

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
    labor_hours: "", labor_items: [{ description: "", hours: "", rate: "120", total: 0 }], // rate overridden at load
    notes: "", parts_used: [], estimated_completion: "", estimate_id: "", photos: [], history: [],
    discount_type: "none", discount_value: 0, total_cost: 0, custom_total: false,
    apply_tax: true, tax_applies_to: "both", tax_rate: null
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showCashout, setShowCashout] = useState(false);
  const [cashoutOrder, setCashoutOrder] = useState(null);
  const [newCustomerForm, setNewCustomerForm] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newVehicleForm, setNewVehicleForm] = useState(null);
  const { decoding: decodingVin, vinError: vinDecodeError, decodeVin: nhtsaDecode, setVinError: setVinDecodeError } = useNhtsaVinDecode();
  const [userTaxRate, setUserTaxRate] = useState(0);
  const [policyMissing, setPolicyMissing] = useState([]);
  const [userLaborRate, setUserLaborRate] = useState(120);
  const submittingRef = useRef(false);
  // Last persisted state in this dialog session: a retry after a partial save updates the same
  // id, and inventory is only deducted for quantity increases beyond what was already deducted.
  const persistedRef = useRef({ id: null, order: null, parts: [], number: "" });
  useEffect(() => {
    if (!open) return;
    const saved = isPersisted(order) ? order : null;
    persistedRef.current = { id: saved?.id || null, order: saved, parts: saved?.parts_used || [], number: saved?.order_number || `RO-${Date.now().toString(36).toUpperCase()}` };
    setSaveError("");
  }, [order?.id, open]);
  const [localVehicles, setLocalVehicles] = useState([]);
  const [fetchedVehicles, setFetchedVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const [localCustomers, setLocalCustomers] = useState([]);

  useEffect(() => {
    if (!open) { setLocalVehicles([]); setFetchedVehicles([]); }
  }, [open]);

  // Pre-fill: when editing an existing order, ensure the customer appears in the list
  useEffect(() => {
    if (!order?.customer_id) return;
    const alreadyPresent = customers.find(c => c.id === order.customer_id);
    if (alreadyPresent) return;
    base44.entities.Customer.get(order.customer_id)
      .then(c => { if (c) setLocalCustomers([c]); })
      .catch(() => {});
  }, [order?.customer_id]);

  // Reactive vehicle fetch whenever customer changes
  useEffect(() => {
    if (!form.customer_id) { setFetchedVehicles([]); return; }
    setLoadingVehicles(true);
    base44.entities.Vehicle.filter({ customer_id: form.customer_id })
      .then(vehs => setFetchedVehicles(vehs))
      .finally(() => setLoadingVehicles(false));
  }, [form.customer_id]);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUserLaborRate(parseFloat(u?.labor_rate) || 120);
        setUserTaxRate(u?.tax_rate != null ? u.tax_rate : 0);
    });
  }, []);

  // Live cost calculation (only if not custom/saved)
  const mechanic = mechanics.find(m => m.id === form.mechanic_id);
  // Always compute from raw field values — never rely on stale .total in state
  // One shared calculation for display and save (document tax rate wins over shop default).
  const totals = roTotals(form, userTaxRate);
  const laborCost = totals.labor;
  const partsCost = totals.parts;
  const TAX_RATE = totals.taxRate;
  const taxOn = totals.taxTarget !== "none";
  const discountAmount = totals.discount;
  const taxAmount = totals.tax;
  const totalCost = totals.total;

  useEffect(() => {
    if (order && order.id) {
      // Editing an existing repair order — its own saved tax/discount policy is authoritative
      const { missing: editMissing, ...editPolicy } = roFormPolicy(order);
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
        labor_items: order.labor_items?.length ? order.labor_items.map(i => ({ ...i, rate: String(i.rate ?? 120) })) : [{ description: "", hours: String(order.labor_hours || ""), rate: "120", total: (order.labor_hours || 0) * 120 }],
        notes: order.notes || "",
        parts_used: order.parts_used || [],
        estimated_completion: order.estimated_completion || "",
        estimate_id: order.estimate_id || "",
        photos: order.photos || [],
        history: order.history || [],
        ...editPolicy,
        total_cost: order.total_cost || 0,
        custom_total: order.custom_total ?? !!order.total_cost,
      });
      setPolicyMissing(editMissing);
      if (editMissing.length && order.estimate_id) {
        base44.entities.Estimate.get(order.estimate_id).then((est) => {
          const { missing, tax_rate, tax_applies_to, apply_tax } = fillFromSourceEstimate({ ...editPolicy, missing: editMissing }, est);
          setForm((f) => ({ ...f, tax_rate, tax_applies_to, apply_tax }));
          setPolicyMissing(missing);
        }).catch(() => {});
      }
    } else {
      // New repair order (possibly pre-filled with customer info from customer profile or appointment)
      const { missing: _m, ...newPolicy } = roFormPolicy(order || {});
      setForm({
        customer_id: order?.customer_id || "",
        customer_name: order?.customer_name || "",
        vehicle_id: order?._prefillVehicleId || order?.vehicle_id || "",
        vehicle_info: order?._prefillVehicleInfo || order?.vehicle_info || "",
        mechanic_id: "", mechanic_name: "", description: "", status: "waiting",
        labor_hours: "", labor_items: [{ description: "", hours: "", rate: "120", total: 0 }], // rate overridden at load
        notes: "", parts_used: [], estimated_completion: "", estimate_id: order?.estimate_id || "", photos: order?.photos || [], history: [],
        ...newPolicy, total_cost: 0, custom_total: false,
      });
      setPolicyMissing([]);
      // Seed vehicle dropdown immediately — prevents blank select before fetch resolves
      if (order?._prefillVehicleId || order?.vehicle_id) {
        const vid   = order._prefillVehicleId   || order.vehicle_id   || "";
        const vinfo = order._prefillVehicleInfo  || order.vehicle_info || "";
        if (vid && vinfo) {
          const parts = vinfo.trim().split(" ");
          setFetchedVehicles([{
            id: vid,
            year: parts[0] || "",
            make: parts[1] || "",
            model: parts.slice(2).join(" ") || "",
            customer_id: order?.customer_id || "",
          }]);
        }
      }
    }
  }, [order?.id, open]);

  const customerVehicles = React.useMemo(() => {
    const ids = new Set(fetchedVehicles.map(v => v.id));
    return [...fetchedVehicles, ...localVehicles.filter(v => v.customer_id === form.customer_id && !ids.has(v.id))];
  }, [fetchedVehicles, localVehicles, form.customer_id]);

  const handleCustomerChange = (id, name) => {
    setForm({ ...form, customer_id: id, customer_name: name || "", vehicle_id: "", vehicle_info: "" });
  };

  const handleVehicleChange = (id) => {
    const v = customerVehicles.find(v => v.id === id);
    setForm({ ...form, vehicle_id: id, vehicle_info: buildVehicleInfo(v) });
  };

  const handleMechanicChange = (id) => {
    const m = mechanics.find(m => m.id === id);
    setForm({ ...form, mechanic_id: id, mechanic_name: m?.name || "" });
  };

  const saveNewCustomer = async () => {
    if (!newCustomerForm?.full_name || !newCustomerForm?.phone) return;
    const created = await base44.entities.Customer.create({
      full_name: newCustomerForm.full_name,
      phone: newCustomerForm.phone,
      email: newCustomerForm.email || "",
      address: newCustomerForm.address || "",
    });
    handleCustomerChange(created.id, created.full_name);
    setNewCustomerForm(null);
    // Immediately refetch so parent list stays in sync
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
      trim: newVehicleForm.trim || "",
      license_plate: newVehicleForm.license_plate || "",
      color: newVehicleForm.color || "",
      engine_type: newVehicleForm.engine_type || "",
    });
    setLocalVehicles(prev => [...prev, created]);
    setForm({ ...form, vehicle_id: created.id, vehicle_info: buildVehicleInfo(created) });
    setNewVehicleForm(null);
    queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    queryClient.refetchQueries({ queryKey: ["vehicles"] });
  };

  const [partSearches, setPartSearches] = useState({});
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
      }
    }
    // Always recalculate total
    updated[idx].total = (Number(updated[idx].unit_price) || 0) * (Number(updated[idx].quantity) || 0);
    setForm({ ...form, parts_used: updated });
  };

  const removePart = (idx) => {
    setForm({ ...form, parts_used: form.parts_used.filter((_, i) => i !== idx) });
  };

  const handleSave = async ({ closeAfterSave = true } = {}) => {
    if (submittingRef.current) return null;
    submittingRef.current = true;
    setSaving(true);
    setSaveError("");
    let resolvedVehicleId = form.vehicle_id;
    try {
      resolvedVehicleId = await resolveVehicleId({ customerId: form.customer_id, vehicleId: form.vehicle_id, vehicleInfo: form.vehicle_info });
    } catch (e) {
      setSaveError(e?.message || "Could not verify the selected vehicle.");
    }
    if (!form.customer_id || !resolvedVehicleId || !form.description) {
      setSaveError("Customer, matching vehicle, and description are required.");
      submittingRef.current = false;
      setSaving(false);
      return null;
    }

    // ── CENTER CONTROL: Validate before any DB write ──────────────────────
    try {
      const validation = await validateRecord({
        customerId: form.customer_id,
        vehicleId: resolvedVehicleId,
        entityType: "RepairOrder",
      });
      if (!validation.ok) {
        setSaveError(validation.errors.join(" "));
        submittingRef.current = false;
        setSaving(false);
        return null;
      }
    } catch (validationErr) {
      setSaveError(validationErr?.message || "Could not validate the customer and vehicle links.");
      submittingRef.current = false;
      setSaving(false);
      return null;
    }
    try {
      const laborHours = Number(form.labor_hours) || 0;
      // Schema fields are numbers; the form holds strings while typing (string rate/hours were rejected on save).
      const laborItems = normalizeLaborItems(form.labor_items || []);
      const partsUsed = normalizeParts(form.parts_used || []);
      const base = persistedRef.current.order;
      const existingId = persistedRef.current.id;
      const saveTotals = roTotals(form, userTaxRate);
      const laborCost = saveTotals.labor;
      const partsCost = saveTotals.parts;
      const savePolicy = roSavePolicy(form, saveTotals);
      const finalTotal = savePolicy.total_cost;

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
        labor_items: laborItems,
        parts_used: partsUsed,
        vehicle_id: resolvedVehicleId,
        estimate_id: form.estimate_id || order?.estimate_id || "",
        photos: form.photos || order?.photos || [],
        labor_hours: laborHours,
        labor_cost: Math.round(laborCost * 100) / 100,
        parts_cost: Math.round(partsCost * 100) / 100,
        ...savePolicy,
        order_number: base?.order_number || persistedRef.current.number,
      };
      // Capitalize text fields
      Object.assign(data, capitalizeFields(data, ["customer_name", "vehicle_info", "description", "notes"]));
      data.labor_items = capitalizeArrayItems(data.labor_items, ["description"]);
      data.parts_used = capitalizeArrayItems(data.parts_used, ["name"]);

      let savedOrder = null;
      let savedOrderId = existingId;
      if (existingId) {
        const changes = {};
        if (base.status !== data.status) changes.status = { from: base.status, to: data.status };
        if (base.mechanic_name !== data.mechanic_name) changes.mechanic = { from: base.mechanic_name, to: data.mechanic_name };
        if (base.labor_hours !== data.labor_hours) changes.labor_hours = { from: base.labor_hours, to: data.labor_hours };
        if (base.parts_cost !== data.parts_cost) changes.parts_cost = { from: base.parts_cost, to: data.parts_cost };

        const historyEntry = {
          timestamp,
          user: userEmail,
          action: 'updated',
          changes
        };

        data.history = [...(base.history || []), historyEntry];
        savedOrder = await base44.entities.RepairOrder.update(existingId, data);
        savedOrderId = savedOrder?.id || existingId;
        persistedRef.current = { ...persistedRef.current, order: { ...base, ...data, ...(savedOrder || {}), id: savedOrderId } };

        // Linked invoice writes are centralized in financialDocumentAction.

        // Sync to linked Estimate(s) — update all financials
        try {
          const linkedInvoices2 = await base44.entities.Invoice.filter({ repair_order_id: savedOrderId });
          const estimateIds = [...new Set(linkedInvoices2.map(i => i.estimate_id).filter(Boolean))];
          // Also find estimates directly linked via repair_order_id
          const linkedEstimates = await base44.entities.Estimate.filter({ repair_order_id: savedOrderId });
          const allEstimateIds = [...new Set([...estimateIds, ...linkedEstimates.map(e => e.id)])];
          for (const estId of allEstimateIds) {
            const est = await base44.entities.Estimate.get(estId);
            if (est) {
              const estLaborTotal = data.labor_cost;
              const estPartsTotal = data.parts_cost;
              const estTaxAmount = saveTotals.tax;
              await base44.entities.Estimate.update(estId, {
                customer_id: data.customer_id,
                customer_name: data.customer_name,
                vehicle_id: resolvedVehicleId,
                vehicle_info: data.vehicle_info,
                labor_total: estLaborTotal,
                parts_total: estPartsTotal,
                tax_rate: saveTotals.taxRate,
                tax_applies_to: saveTotals.taxTarget,
                ...toDocumentDiscount(readDiscount(savePolicy)),
                tax_amount: estTaxAmount,
                grand_total: saveTotals.calculatedTotal,
                notes: est.notes,
                labor_items: data.labor_items || est.labor_items,
                parts_items: data.parts_used?.map(p => ({ name: p.name, part_number: p.part_number || "", quantity: p.quantity, unit_price: p.unit_price, total: p.total })) || est.parts_items,
              });
            }
          }
        } catch (e) { throw new Error(`Repair Order saved, but linked estimate update failed: ${e?.message || e}`); }
      } else {
        data.history = [{
          timestamp,
          user: userEmail,
          action: 'created',
          changes: {}
        }];
        savedOrder = await base44.entities.RepairOrder.create(data);
        savedOrderId = savedOrder.id;
        // Any retry from here on updates this same record instead of creating another.
        persistedRef.current = { ...persistedRef.current, id: savedOrderId, order: { ...data, ...savedOrder } };
      }

      // ── Deduct parts from inventory (only increases not yet deducted) ──
      for (const { part_id, delta } of inventoryDeltas(persistedRef.current.parts, data.parts_used)) {
        try {
          const invPart = await base44.entities.Part.get(part_id);
          if (invPart) await base44.entities.Part.update(part_id, { quantity: Math.max(0, (invPart.quantity || 0) - delta) });
          persistedRef.current.parts = [...persistedRef.current.parts, { part_id, quantity: delta }];
        } catch (e) {
          throw new Error(`Repair Order ${data.order_number} was saved, but the inventory update failed (${e?.message || e}). Save again to retry; it will not duplicate the order.`);
        }
      }

      const syncResult = await syncCustomerActivity({
        customerId: data.customer_id,
        vehicleId: resolvedVehicleId,
        vehicleInfo: data.vehicle_info,
        customerName: data.customer_name,
        entityType: "RepairOrder",
        entityId: savedOrderId,
        propagate: true,
        customerPhone: form.customer_phone,
      });
      if (!syncResult.ok) throw new Error(syncResult.errors.join(" "));
      const persistedOrder = savedOrder || { ...data, id: savedOrderId };
      if (closeAfterSave) {
        onSaved(data.status, persistedOrder);
        onClose();
      }
      return persistedOrder;
    } catch (error) {
      console.error('Error saving repair order:', error);
      setSaveError(error?.message || "Failed to save repair order.");
      return null;
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl flex flex-col p-0" style={{ maxHeight: "90vh", height: "90vh" }} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        {/* Fixed header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <DialogHeader className="flex-1">
              <DialogTitle>{isPersisted(order) ? "Edit Repair Order" : "New Repair Order"}</DialogTitle>
            </DialogHeader>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
           <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-sky-400" /> Customer *</Label>
                <div className="mt-1">
                  <CustomerSearchInput customers={[...customers, ...localCustomers.filter(lc => !customers.find(c => c.id === lc.id))]} value={form.customer_id} onChange={handleCustomerChange} />
                  <button onClick={() => setNewCustomerForm({ full_name: "", phone: "", email: "", address: "" })}
                    className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2">
                    <Plus className="w-3 h-3" /> New customer
                  </button>
                </div>
              </div>
              <div>
                <Label className="text-gray-400 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-sky-400" /> Vehicle *</Label>
                <div className="mt-1">
                  <Select value={form.vehicle_id} onValueChange={handleVehicleChange} disabled={loadingVehicles}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                      <SelectValue placeholder={loadingVehicles ? "Loading vehicles..." : "Select vehicle"} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700">
                      {loadingVehicles && <div className="px-3 py-2 text-xs text-gray-500">Loading vehicles...</div>}
                      {!loadingVehicles && customerVehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>{buildVehicleInfo(v)}</SelectItem>
                      ))}
                      {!loadingVehicles && form.customer_id && customerVehicles.length === 0 && (
                        <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", trim: "", license_plate: "", color: "", engine_type: "" })}
                          className="w-full px-3 py-2 text-left text-sky-400 hover:bg-sky-500/20 flex items-center gap-2 text-sm">
                          <Plus className="w-3.5 h-3.5" /> Add vehicle
                        </button>
                      )}
                    </SelectContent>
                  </Select>
                  {form.customer_id && customerVehicles.length > 0 && (
                    <button onClick={() => setNewVehicleForm({ vin: "", year: "", make: "", model: "", trim: "", license_plate: "", color: "", engine_type: "" })}
                      className="mt-2 w-full px-3 py-1 rounded text-xs bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center gap-2">
                      <Plus className="w-3 h-3" /> Add vehicle
                    </button>
                  )}
                </div>
              </div>
              </div>

              {newCustomerForm !== null && (
                <div className="rounded-lg border border-sky-500/30 bg-gray-800 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <User className="w-4 h-4 text-sky-400" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Customer Information</h4>
                      <div className="flex-1 h-px bg-gray-700 ml-1" />
                    </div>
                    <button onClick={() => setNewCustomerForm(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400">Full Name *</Label>
                      <div className="relative mt-1">
                        <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input value={newCustomerForm.full_name} onChange={e => setNewCustomerForm(p => ({...p, full_name: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())}))} className="bg-gray-700 border-gray-600 text-white pl-8" placeholder="John Smith" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400">Phone *</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input type="tel" data-no-capitalize value={newCustomerForm.phone} onChange={e => setNewCustomerForm({...newCustomerForm, phone: e.target.value})} className="bg-gray-700 border-gray-600 text-white pl-8" placeholder="(613) 555-0100" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-gray-400">Email (optional)</Label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input type="email" data-no-capitalize value={newCustomerForm.email} onChange={e => setNewCustomerForm({...newCustomerForm, email: e.target.value})} className="bg-gray-700 border-gray-600 text-white pl-8" placeholder="john@example.com" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-gray-400">Address (optional)</Label>
                      <div className="relative mt-1">
                        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input value={newCustomerForm.address || ""} onChange={e => setNewCustomerForm({...newCustomerForm, address: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())})} className="bg-gray-700 border-gray-600 text-white pl-8" placeholder="123 Main St" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={saveNewCustomer} disabled={!newCustomerForm.full_name || !newCustomerForm.phone} className="bg-sky-500 hover:bg-sky-600 text-white flex-1">Save Customer</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewCustomerForm(null)} className="text-gray-400">Cancel</Button>
                  </div>
                </div>
              )}

              {newVehicleForm !== null && (
                <div className="rounded-lg border border-sky-500/30 bg-gray-800 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1">
                      <Car className="w-4 h-4 text-sky-400" />
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Vehicle Information</h4>
                      <div className="flex-1 h-px bg-gray-700 ml-1" />
                    </div>
                    <button onClick={() => setNewVehicleForm(null)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-gray-400">Year *</Label>
                      <Input type="number" value={newVehicleForm.year} onChange={e => setNewVehicleForm({...newVehicleForm, year: e.target.value})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="2019" />
                    </div>
                    <div>
                      <Label className="text-gray-400">Make *</Label>
                      <div className="relative mt-1">
                        <Car className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                        <Input value={newVehicleForm.make} onChange={e => setNewVehicleForm({...newVehicleForm, make: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())})} className="bg-gray-700 border-gray-600 text-white pl-8" placeholder="Honda" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-400">Model *</Label>
                      <Input value={newVehicleForm.model} onChange={e => setNewVehicleForm({...newVehicleForm, model: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="Civic" />
                    </div>
                    <div>
                      <Label className="text-gray-400">Trim (optional)</Label>
                      <Input value={newVehicleForm.trim || ""} onChange={e => setNewVehicleForm({...newVehicleForm, trim: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="EX" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-gray-400">Engine (optional)</Label>
                      <Input value={newVehicleForm.engine_type} onChange={e => setNewVehicleForm({...newVehicleForm, engine_type: e.target.value})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="1.5L 4-Cyl" />
                    </div>
                    <div>
                      <Label className="text-gray-400">VIN (optional)</Label>
                      <Input data-no-capitalize value={newVehicleForm.vin} onChange={e => { setNewVehicleForm({...newVehicleForm, vin: e.target.value.toUpperCase()}); setVinDecodeError(""); }} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="17 characters" />
                      {newVehicleForm.vin && (
                        <Button size="sm" onClick={decodeVinForNewVehicle} disabled={decodingVin} className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs mt-2">
                          {decodingVin ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Decoding...</> : "Decode VIN"}
                        </Button>
                      )}
                      {vinDecodeError && <p className="text-rose-400 text-xs mt-1">{vinDecodeError}</p>}
                      <p className="mt-1 text-[10px] text-gray-500">VIN is optional</p>
                    </div>
                    <div>
                      <Label className="text-gray-400">License Plate (optional)</Label>
                      <Input data-no-capitalize value={newVehicleForm.license_plate} onChange={e => setNewVehicleForm({...newVehicleForm, license_plate: e.target.value.toUpperCase()})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="ABCD123" />
                      <p className="mt-1 text-[10px] text-gray-500">Plate is optional</p>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-gray-400">Color (optional)</Label>
                      <Input value={newVehicleForm.color} onChange={e => setNewVehicleForm({...newVehicleForm, color: e.target.value.replace(/(^|\s)(\S)/g,(_,s,c)=>s+c.toUpperCase())})} className="bg-gray-700 border-gray-600 text-white mt-1" placeholder="Black" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={saveNewVehicle} disabled={!newVehicleForm.year || !newVehicleForm.make || !newVehicleForm.model} className="bg-sky-500 hover:bg-sky-600 text-white flex-1">Save Vehicle</Button>
                    <Button size="sm" variant="ghost" onClick={() => setNewVehicleForm(null)} className="text-gray-400">Cancel</Button>
                  </div>
                </div>
              )}
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
                  {(() => {
                    // POLISH 7: Enforce valid status transitions
                    const VALID_NEXT = {
                      waiting: ["waiting", "in_progress"],
                      in_progress: ["in_progress", "waiting_for_parts", "completed"],
                      waiting_for_parts: ["waiting_for_parts", "in_progress", "completed"],
                      completed: ["completed", "delivered"],
                      delivered: ["delivered", "invoiced"],
                      invoiced: ["invoiced"],
                    };
                    const allowed = VALID_NEXT[form.status] || statuses.map(s => s.value);
                    return statuses.filter(s => allowed.includes(s.value)).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>);
                  })()}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Job Description *</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={3} />
          </div>

          {/* Labor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Labor</Label>
              <Button size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, labor_items: [...(f.labor_items || []), { description: "", hours: "", rate: String(userLaborRate), total: 0 }] }))}
                className="text-sky-400 hover:text-sky-300 h-7 px-2">
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
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(form.labor_items || [{ description: "", hours: form.labor_hours || "", total: (Number(form.labor_hours) || 0) * 120 }]).map((row, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <Input autoCapitalize="sentences" onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], description: e.target.value };
                          setForm(f => ({ ...f, labor_items: items }));
                        }} className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="e.g. Engine Diagnosis" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={row.hours} onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], hours: e.target.value, total: (parseFloat(e.target.value) || 0) * laborRate(items[idx]) };
                          const totalHours = items.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
                          setForm(f => ({ ...f, labor_items: items, labor_hours: totalHours }));
                        }} className="bg-gray-800 border-0 text-white h-8 text-sm text-right" placeholder="0" step="0.5" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={row.rate ?? "120"} onChange={e => {
                          const items = [...(form.labor_items || [])];
                          items[idx] = { ...items[idx], rate: e.target.value, total: (parseFloat(items[idx].hours) || 0) * (parseFloat(e.target.value) || 0) };
                          setForm(f => ({ ...f, labor_items: items }));
                        }} className={`bg-gray-800 border-0 text-white h-8 text-sm text-right ${parseFloat(row.rate) !== userLaborRate ? "border border-amber-500/50" : ""}`} placeholder="120" step="1" />
                        {parseFloat(row.rate) > 0 && ![60, 100, 120].includes(parseFloat(row.rate)) && (
                          <p className="text-amber-400 text-[10px] mt-0.5">⚠️ Non-standard rate (${parseFloat(row.rate)}/hr)</p>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${((parseFloat(row.hours) || 0) * laborRate(row)).toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => {
                          const items = (form.labor_items || []).filter((_, i) => i !== idx);
                          const totalHours = items.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
                          setForm(f => ({ ...f, labor_items: items, labor_hours: totalHours }));
                        }} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Est. Completion</Label>
            <Input type="date" value={form.estimated_completion} onChange={e => setForm({ ...form, estimated_completion: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" />
          </div>

          {/* Parts section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300 font-semibold">Parts Used</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNewPartForm({ name: "", cost_price: "", sale_price: "", quantity: 0 })} className="text-amber-400 hover:text-amber-300 gap-1 text-xs h-7 px-2">
                  <Plus className="w-3 h-3" /> Add to Inventory
                </Button>
                <Button size="sm" variant="ghost" onClick={addPart} className="text-sky-400 hover:text-sky-300 h-7 px-2">
                  <Plus className="w-4 h-4 mr-1" /> Add Row
                </Button>
              </div>
            </div>
            {newPartForm !== null && (
              <div className="bg-gray-800 border border-amber-500/30 rounded-lg p-3 mb-3 space-y-2">
                <p className="text-xs text-amber-400 font-medium">New Part — Add to Inventory</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={newPartForm.name} autoCapitalize="words" onChange={e => setNewPartForm(f => ({...f, name: toTitleCase(e.target.value)}))}
                    className="bg-gray-700 border-gray-600 text-white col-span-2" placeholder="Part name *" />
                  <Input type="number" onFocus={e => e.target.select()} value={newPartForm.cost_price} onChange={e => setNewPartForm(f => ({...f, cost_price: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Cost price" />
                  <Input type="number" onFocus={e => e.target.select()} value={newPartForm.sale_price} onChange={e => setNewPartForm(f => ({...f, sale_price: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Sale price" />
                  <Input type="number" onFocus={e => e.target.select()} value={newPartForm.quantity} onChange={e => setNewPartForm(f => ({...f, quantity: e.target.value}))}
                    className="bg-gray-700 border-gray-600 text-white" placeholder="Stock qty" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveNewPartToInventory} disabled={!newPartForm.name} className="bg-amber-500 hover:bg-amber-600 text-black">Save & Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setNewPartForm(null)} className="text-gray-400">Cancel</Button>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-gray-800 overflow-hidden" style={{ maxHeight: "220px", overflowY: "auto" }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-800/60 text-gray-500 text-xs sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Part Name</th>
                    <th className="px-3 py-2 text-left w-36">From Inventory</th>
                    <th className="px-3 py-2 text-right w-20">Qty</th>
                    <th className="px-3 py-2 text-right w-24">Unit Price</th>
                    <th className="px-3 py-2 text-right w-24">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {form.parts_used.map((pu, idx) => (
                    <tr key={idx} className="bg-gray-900">
                      <td className="px-2 py-1.5">
                        <Input value={pu.name} autoCapitalize="words" onChange={e => updatePart(idx, "name", toTitleCase(e.target.value))}
                          className="bg-gray-800 border-0 text-white h-8 text-sm" placeholder="Part name..." />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={pu.part_id} onValueChange={v => { updatePart(idx, "part_id", v); setPartSearches(s => ({...s, [idx]: ""})); }}>
                          <SelectTrigger className="bg-gray-800 border-0 text-white h-8 text-xs">
                            <SelectValue placeholder="Inventory..." />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <div className="px-2 pb-1">
                              <Input
                                value={partSearches[idx] || ""}
                                onChange={e => setPartSearches(s => ({...s, [idx]: e.target.value}))}
                                className="bg-gray-700 border-gray-600 text-white h-7 text-xs"
                                placeholder="Search..."
                                onClick={e => e.stopPropagation()}
                                onKeyDown={e => e.stopPropagation()}
                              />
                            </div>
                            {parts.filter(p => !partSearches[idx] || fuzzyMatch(partSearches[idx], [p.name, p.part_number, p.supplier, p.category])).map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={pu.quantity} onChange={e => updatePart(idx, "quantity", Number(e.target.value))}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" min="1" placeholder="1" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input type="number" onFocus={e => e.target.select()} value={pu.unit_price || ""} onChange={e => updatePart(idx, "unit_price", e.target.value)}
                          className="bg-gray-800 border-0 text-white h-8 text-sm text-right" step="0.01" placeholder="0.00" />
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-300 font-medium">${(pu.total || 0).toFixed(2)}</td>
                      <td className="pr-2 py-1.5">
                        <button onClick={() => removePart(idx)} className="text-gray-600 hover:text-rose-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-gray-400 text-sm">Discount Type</Label>
              <Select value={form.discount_type} onValueChange={v => setForm({...form, discount_type: v, discount_value: 0})}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">$</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.discount_type !== "none" && (
              <div className="col-span-2">
                <Label className="text-gray-400 text-sm">Discount {form.discount_type === "percentage" ? "(%)" : "($)"}</Label>
                <Input type="number" onFocus={e => e.target.select()} step="0.01" value={form.discount_value}
                  onChange={e => setForm({...form, discount_value: Number(e.target.value)})}
                  className="bg-gray-800 border-gray-700 text-white mt-1" />
              </div>
            )}
          </div>

          {/* Cost Summary */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-gray-400 font-medium text-xs uppercase tracking-wider">{form.custom_total ? "Fixed Cost" : "Estimated Cost"}</p>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setForm(f => { const on = (f.tax_applies_to || "both") !== "none" && f.apply_tax !== false; return { ...f, apply_tax: !on, tax_applies_to: on ? "none" : "both" }; })}
                  className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors flex items-center gap-1.5 ${
                    taxOn
                      ? "bg-sky-500/20 border-sky-500 text-sky-400"
                      : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${taxOn ? "bg-sky-400" : "bg-gray-600"}`} />
                  Tax {TAX_RATE}%
                </button>
                {taxOn && (
                  <Select value={form.tax_applies_to || "both"} onValueChange={v => setForm(f => ({ ...f, tax_applies_to: v }))}>
                    <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-20 h-7">
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
            {!form.custom_total ? (
              <>
                <div className="flex justify-between text-gray-400">
                  <span>Labor ({form.labor_hours || 0}h)</span>
                  <span className="text-white">${laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Parts</span>
                  <span className="text-white">${partsCost.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount {form.discount_type === "percentage" ? `(${form.discount_value}%)` : ""}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-400">
                  <span>Tax ({TAX_RATE}%)</span>
                  <span className={taxOn ? "" : "line-through opacity-50"}>{taxOn ? `$${taxAmount.toFixed(2)}` : "Not applied"}</span>
                </div>
                {policyMissing.length > 0 && (
                  <p className="text-xs text-amber-400">This older order has no saved tax setting; showing your shop default. Saving will store it.</p>
                )}
              </>
            ) : null}
            <div className="flex justify-between font-bold text-base border-t border-gray-700 pt-2 mt-2">
              <span className="text-white">Total</span>
              <span className="text-emerald-400">${totalCost.toFixed(2)}</span>
            </div>

          </div>

        </div>{/* end space-y-4 */}
        </div>{/* end scrollable body */}

        {saveError && (
          <div role="alert" className="mx-6 mb-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{saveError}</div>
        )}

        <UnifiedFinancialActionBar
          step={3}
          dirty
          totals={{ total: totalCost, balance: totalCost - (order?.amount_paid || 0) }}
          saving={saving}
          saved={order}
          onBack={onClose}
          onSave={handleSave}
          onPayment={order?.id ? async () => { const saved = await handleSave({ closeAfterSave: false }); if (saved) { setCashoutOrder(saved); setShowCashout(true); } } : undefined}
        />

        {/* Unified Cashout Dialog */}
        {showCashout && cashoutOrder?.id && (
          <PaymentReceiptDialog
            open={showCashout}
            onClose={() => setShowCashout(false)}
            invoice={{
              ...cashoutOrder,
              invoice_number: cashoutOrder.order_number,
              total: cashoutOrder.total_cost || 0,
              labor_cost: cashoutOrder.labor_cost || 0,
              parts_cost: cashoutOrder.parts_cost || 0,
              balance_due: (cashoutOrder.total_cost || 0) - (cashoutOrder.amount_paid || 0),
            }}
            entityName="RepairOrder"
            onSaved={() => {
              setShowCashout(false);
              onSaved?.("delivered", cashoutOrder);
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}