import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import InvoiceLineItemsTable from "@/components/invoices/InvoiceLineItemsTable";
import InvoiceTotalsSection from "@/components/invoices/InvoiceTotalsSection";
import CustomerVehiclePicker from "@/components/shared/CustomerVehiclePicker";
import { calculateFinancials } from "@/components/financial-workflow/financialMath";
import EstimateDetailsFields from "@/components/estimates/EstimateDetailsFields";
import QuickNotesEditor from "@/components/shared/QuickNotesEditor";
import { syncCustomerActivity } from "@/utils/syncCustomerActivity";
import { syncLineItemLibrary } from "@/utils/syncLineItemLibrary";
import { useToast } from "@/components/ui/use-toast";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Convert prefill labor_items + parts_items into the unified line-item model
// used by the shared invoice table (same mapping as OriginalEstimateEditor.toLines).
const toLines = (prefill) => [
  ...(prefill?.labor_items || []).map((l) => ({
    type: "labor",
    name: l.description || "",
    description: l.details || "",
    quantity: Number(l.hours) || 0,
    unit_price: Number(l.rate) || 0,
    taxable: true,
    source: "Estimate",
  })),
  ...(prefill?.parts_items || []).map((p) => ({
    type: "part",
    name: p.name || "",
    description: p.details || "",
    part_number: p.part_number || "",
    quantity: Number(p.quantity) || 0,
    unit_price: Number(p.unit_price) || 0,
    taxable: true,
    source: "Estimate",
  })),
];

export default function EstimateCreateEditor({ prefill, customers = [], onClose, onSaved }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState(() => {
    const prefillLines = toLines(prefill);
    return {
      line_items: prefillLines.length ? prefillLines : [],
      tax_rate: 0,
      tax_applies_to: "both",
      discount: 0,
      discount_type: "$",
      estimate_date: new Date().toISOString().split("T")[0],
      valid_until: "",
      service_reason: prefill?.service_reason || "",
      notes: prefill?.notes || "",
      customer_id: prefill?.customer_id || "",
      customer_name: prefill?.customer_name || "",
      vehicle_id: prefill?.vehicle_id || "",
      vehicle_info: prefill?.vehicle_info || "",
    };
  });
  const [saving, setSaving] = useState(false);

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

  const totals = useMemo(() => calculateFinancials(draft, 0), [draft]);

  const onCustomerChange = (id, name) => setDraft((d) => ({ ...d, customer_id: id, customer_name: name, vehicle_id: "", vehicle_info: "" }));
  const onVehicleChange = (vid, vinfo) => setDraft((d) => ({ ...d, vehicle_id: vid, vehicle_info: vinfo }));

  const save = async () => {
    if (saving) return;
    if (!draft.customer_id) { toast({ title: "Please select a customer", variant: "destructive" }); return; }
    if (!draft.vehicle_id) { toast({ title: "Please select a vehicle", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const laborItems = draft.line_items
        .filter((l) => l.type === "labor")
        .map((l) => ({ description: l.name, details: l.description || "", hours: Number(l.quantity) || 0, rate: Number(l.unit_price) || 0, total: r2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)) }));
      const partsItems = draft.line_items
        .filter((l) => l.type !== "labor")
        .map((p) => ({ name: p.name, details: p.description || "", part_number: p.part_number || "", quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, total: r2((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)) }));
      const estimate_number = `EST-${Date.now().toString().slice(-6)}`;
      await base44.entities.Estimate.create({
        estimate_number,
        customer_id: draft.customer_id,
        customer_name: draft.customer_name,
        vehicle_id: draft.vehicle_id,
        vehicle_info: draft.vehicle_info,
        labor_items: laborItems,
        parts_items: partsItems,
        labor_total: r2(totals.labor),
        parts_total: r2(totals.parts),
        tax_amount: r2(totals.tax),
        tax_rate: Number(draft.tax_rate) || 0,
        tax_applies_to: draft.tax_applies_to,
        discount: Number(draft.discount) || 0,
        discount_type: draft.discount_type,
        grand_total: r2(totals.total),
        estimate_date: draft.estimate_date,
        valid_until: draft.valid_until,
        service_reason: draft.service_reason,
        notes: draft.notes,
        status: "draft",
        auth_status: "none",
        amount_paid: 0,
      });
      try {
        await syncCustomerActivity({
          customerId: draft.customer_id,
          vehicleId: draft.vehicle_id,
          vehicleInfo: draft.vehicle_info,
          customerName: draft.customer_name,
          entityType: "Estimate",
        });
      } catch (_) {}
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      syncLineItemLibrary(draft.line_items);
      toast({ title: "Estimate saved ✓" });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Header — mirrors EstimateEditorHeader styling; "New Estimate" + customer/vehicle selection */}
      <div className="border-b border-gray-800 px-5 py-4 md:px-6">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-sky-400">Estimate</p>
            <h2 className="mt-1 text-xl font-bold text-white">New Estimate</h2>
          </div>
          <CustomerVehiclePicker
            customers={customers}
            customerId={draft.customer_id}
            customerName={draft.customer_name}
            vehicleId={draft.vehicle_id}
            vehicleInfo={draft.vehicle_info}
            onCustomerChange={onCustomerChange}
            onVehicleChange={onVehicleChange}
          />
        </div>
      </div>

      {/* Body — identical shared sub-components as EstimateDetail */}
      <div className="max-h-[60vh] overflow-y-auto px-5 py-5 md:px-6">
        <EstimateDetailsFields draft={draft} onChange={setDraft} />
        <InvoiceLineItemsTable
          lines={draft.line_items}
          onChange={(line_items) => setDraft({ ...draft, line_items })}
        />
        <QuickNotesEditor
          value={draft.notes}
          onChange={(v) => setDraft({ ...draft, notes: v })}
        />
        <InvoiceTotalsSection draft={draft} totals={totals} onChange={setDraft} />
      </div>

      {/* Actions — mirrors EstimateEditorActions styling; only Cancel + Save for a new estimate */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 bg-gray-900 px-5 py-4 md:px-6">
        <div />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onClose?.()}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-sky-500 hover:bg-sky-600">
            {saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? "Saving…" : "Save Estimate"}
          </Button>
        </div>
      </div>
    </>
  );
}