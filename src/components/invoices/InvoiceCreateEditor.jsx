import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import InvoiceDetailsFields from "@/components/invoices/InvoiceDetailsFields";
import QuickNotesEditor from "@/components/shared/QuickNotesEditor";
import InvoiceLineItemsTable from "@/components/invoices/InvoiceLineItemsTable";
import InvoiceTotalsSection from "@/components/invoices/InvoiceTotalsSection";
import { calculateFinancials } from "@/components/financial-workflow/financialMath";
import { syncCustomerActivity } from "@/utils/syncCustomerActivity";
import { syncLineItemLibrary } from "@/utils/syncLineItemLibrary";
import { useToast } from "@/components/ui/use-toast";
import { buildVehicleInfo } from "@/utils/buildVehicleInfo";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Unified Invoice CREATE editor for the blank-new flow (no existing source).
 *
 * Self-contained — mirrors EstimateCreateEditor exactly: local draft state,
 * customer search + vehicle select in the top-right header, and a direct
 * Invoice.create on save (no backend workflow load). Reuses the same shared
 * sub-components as InvoiceDetail (InvoiceDetailsFields + InvoiceLineItemsTable
 * + InvoiceTotalsSection) so the layout is identical everywhere.
 *
 * Title is always "New Invoice" (never "Edit Invoice"); Print / Send / Record
 * Payment stay hidden until the invoice is saved.
 */
export default function InvoiceCreateEditor({ prefill, customers = [], onClose, onSaved }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState(() => ({
    line_items: prefill?.line_items || [],
    tax_rate: 0,
    tax_applies_to: "both",
    discount: 0,
    discount_type: "$",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    service_reason: prefill?.service_reason || "",
    customer_note: prefill?.customer_note || "",
    customer_id: prefill?.customer_id || "",
    customer_name: prefill?.customer_name || "",
    vehicle_id: prefill?.vehicle_id || "",
    vehicle_info: prefill?.vehicle_info || "",
  }));
  const [saving, setSaving] = useState(false);
  const [custSearch, setCustSearch] = useState(prefill?.customer_name || "");
  const [custDropdown, setCustDropdown] = useState([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [customerVehicles, setCustomerVehicles] = useState([]);

  // Load the shop's default tax rate
  useEffect(() => {
    let mounted = true;
    base44.auth.me().then((u) => {
      if (!mounted) return;
      const userTaxRate = u?.tax_rate != null ? u.tax_rate : 0;
      const userTaxApplies = u?.tax_applies_to || "both";
      setDraft((d) => ({ ...d, tax_rate: userTaxRate, tax_applies_to: userTaxApplies }));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // If opened with a pre-selected customer (e.g. from "Customer Added!" modal), load their vehicles
  useEffect(() => {
    let mounted = true;
    if (prefill?.customer_id) {
      base44.entities.Vehicle.filter({ customer_id: prefill.customer_id })
        .then((vehs) => { if (mounted) setCustomerVehicles(vehs); })
        .catch(() => {});
    }
    return () => { mounted = false; };
  }, []);

  const totals = useMemo(() => calculateFinancials(draft, 0), [draft]);

  const searchCustomers = (q) => {
    if (!q.trim()) { setCustDropdown([]); setShowCustDropdown(false); return; }
    const lower = q.toLowerCase();
    const results = (customers || [])
      .filter(Boolean)
      .filter((c) => (c.full_name || "").toLowerCase().includes(lower) || (c.phone || "").includes(q))
      .slice(0, 8);
    setCustDropdown(results);
    setShowCustDropdown(true);
  };

  const selectCustomer = (c) => {
    setDraft((d) => ({ ...d, customer_id: c.id, customer_name: c.full_name, vehicle_id: "", vehicle_info: "" }));
    setCustSearch(c.full_name);
    setShowCustDropdown(false);
    setCustDropdown([]);
    base44.entities.Vehicle.filter({ customer_id: c.id }).then(setCustomerVehicles).catch(() => {});
  };

  const clearCustomer = () => {
    setDraft((d) => ({ ...d, customer_id: "", customer_name: "", vehicle_id: "", vehicle_info: "" }));
    setCustSearch("");
    setCustomerVehicles([]);
  };

  const handleVehicleChange = (vid) => {
    const v = customerVehicles.find((x) => x.id === vid);
    setDraft((d) => ({ ...d, vehicle_id: vid, vehicle_info: buildVehicleInfo(v) }));
  };

  const onCustSearchChange = (val) => {
    setCustSearch(val);
    if (draft.customer_id) clearCustomer();
    searchCustomers(val);
  };

  const save = async () => {
    if (saving) return;
    if (!draft.customer_id) { toast({ title: "Please select a customer", variant: "destructive" }); return; }
    if (!draft.vehicle_id) { toast({ title: "Please select a vehicle", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const lineItems = (draft.line_items || []).map((l) => ({
        type: l.type || "part",
        name: l.name || "",
        description: l.description || "",
        quantity: Number(l.quantity) || 0,
        unit_price: Number(l.unit_price) || 0,
        total: r2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)),
        taxable: l.taxable !== false,
        source: l.source || "Manual",
      }));
      const partsUsed = lineItems.filter((l) => l.type !== "labor").map((p) => ({
        name: p.name || p.description || "", quantity: p.quantity, unit_price: p.unit_price, total: p.total,
      }));
      const invoice_number = `INV-${Date.now().toString().slice(-6)}`;
      await base44.entities.Invoice.create({
        invoice_number,
        customer_id: draft.customer_id,
        customer_name: draft.customer_name,
        vehicle_id: draft.vehicle_id,
        vehicle_info: draft.vehicle_info,
        line_items: lineItems,
        parts_used: partsUsed,
        parts_total: r2(totals.parts),
        labor_total: r2(totals.labor),
        tax_rate: Number(draft.tax_rate) || 0,
        tax_applies_to: draft.tax_applies_to,
        tax_amount: r2(totals.tax),
        discount: Number(draft.discount) || 0,
        discount_type: draft.discount_type,
        total: r2(totals.total),
        amount_paid: 0,
        balance_due: r2(totals.total),
        status: "unpaid",
        service_reason: draft.service_reason,
        customer_note: draft.customer_note,
        invoice_date: draft.invoice_date,
        due_date: draft.due_date,
        auth_status: "none",
      });
      try {
        await syncCustomerActivity({
          customerId: draft.customer_id,
          vehicleId: draft.vehicle_id,
          vehicleInfo: draft.vehicle_info,
          customerName: draft.customer_name,
          entityType: "Invoice",
        });
      } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      syncLineItemLibrary(lineItems);
      toast({ title: "Invoice saved ✓" });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const customerSelected = !!draft.customer_id;

  return (
    <>
      {/* Header — "New Invoice" + customer/vehicle selection in top-right */}
      <div className="border-b border-gray-800 px-5 py-4 md:px-6">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Invoice</p>
            <h2 className="mt-1 text-xl font-bold text-white">New Invoice</h2>
          </div>
          <div className="text-right text-sm min-w-[240px]">
            {customerSelected ? (
              <>
                <div className="flex items-center justify-end gap-2">
                  <p className="font-medium text-white">{draft.customer_name}</p>
                  <button type="button" onClick={clearCustomer} className="text-xs text-gray-500 underline hover:text-gray-300">Change</button>
                </div>
                <Select value={draft.vehicle_id || ""} onValueChange={handleVehicleChange}>
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
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  value={custSearch}
                  onChange={(e) => onCustSearchChange(e.target.value)}
                  onFocus={() => { if (custSearch) searchCustomers(custSearch); }}
                  onBlur={() => setTimeout(() => setShowCustDropdown(false), 150)}
                  placeholder="Search customer by name or phone..."
                  className="bg-gray-950 border-gray-700 text-white pl-8"
                />
                {showCustDropdown && custDropdown.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl text-left">
                    {custDropdown.map((c) => (
                      <button key={c.id} type="button" onMouseDown={() => selectCustomer(c)} className="w-full px-3 py-2 hover:bg-sky-500/20 text-sm text-white flex justify-between">
                        <span>{c.full_name}</span>
                        <span className="text-gray-400 text-xs">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body — identical shared sub-components as InvoiceDetail */}
      <div className="max-h-[60vh] overflow-y-auto px-5 py-5 md:px-6">
        <InvoiceDetailsFields draft={draft} onChange={setDraft} />
        <InvoiceLineItemsTable
          lines={draft.line_items}
          onChange={(line_items) => setDraft({ ...draft, line_items })}
        />
        <QuickNotesEditor
          value={draft.customer_note}
          onChange={(v) => setDraft({ ...draft, customer_note: v })}
        />
        <InvoiceTotalsSection draft={draft} totals={totals} onChange={setDraft} />
      </div>

      {/* Actions — only Cancel + Save for a new invoice */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-5 py-4 md:px-6">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onClose?.()}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-sky-500 hover:bg-sky-600">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : "Save Invoice"}
          </Button>
        </div>
      </div>
    </>
  );
}