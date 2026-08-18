import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import InvoiceLineItemsTable from "@/components/invoices/InvoiceLineItemsTable";
import InvoiceTotalsSection from "@/components/invoices/InvoiceTotalsSection";
import { calculateFinancials } from "@/components/financial-workflow/financialMath";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import EstimateEditorHeader from "./EstimateEditorHeader";
import EstimateDetailsFields from "./EstimateDetailsFields";
import EstimateEditorActions from "./EstimateEditorActions";
import EstimatePrintView from "./EstimatePrintView";
import QuickNotesEditor from "@/components/shared/QuickNotesEditor";
import GhostModeButton from "@/components/ghost-mode/GhostModeButton";
import GhostSection from "@/components/ghost-mode/GhostSection";
import { calcGhostTotals } from "@/utils/ghostTax";
import { useEmailSend } from "@/hooks/useEmailSend";
import { normalizeDiscountType } from "@/utils/discount";
import { syncCustomerActivity } from "@/utils/syncCustomerActivity";
import { syncLineItemLibrary } from "@/utils/syncLineItemLibrary";
import { useToast } from "@/components/ui/use-toast";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Convert estimate labor_items + parts_items into the unified line-item model
// used by the shared invoice table. part_number is preserved on part lines.
const toLines = (estimate) => [
  ...(estimate?.labor_items || []).map((l) => ({
    type: "labor",
    name: l.description || "",
    description: l.details || "",
    quantity: Number(l.hours) || 0,
    unit_price: Number(l.rate) || 0,
    taxable: true,
    source: "Estimate",
  })),
  ...(estimate?.parts_items || []).map((p) => ({
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

export default function OriginalEstimateEditor({ estimateId, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { sending, sendEmail } = useEmailSend();

  const [draft, setDraft] = useState(null);
  const [loadedKey, setLoadedKey] = useState(null);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [payment, setPayment] = useState(false);

  const { data: estimate } = useQuery({
    queryKey: ["estimate", estimateId],
    queryFn: () => base44.entities.Estimate.get(estimateId),
    enabled: !!estimateId,
  });
  const { data: customer } = useQuery({
    queryKey: ["customer", estimate?.customer_id],
    queryFn: () => base44.entities.Customer.get(estimate.customer_id),
    enabled: !!estimate?.customer_id,
  });
  const { data: vehicle } = useQuery({
    queryKey: ["vehicle", estimate?.vehicle_id],
    queryFn: () => base44.entities.Vehicle.get(estimate.vehicle_id),
    enabled: !!estimate?.vehicle_id,
  });
  const { data: linkedInvoice } = useQuery({
    queryKey: ["linkedInvoice", estimate?.linked_invoice_id],
    queryFn: () => base44.entities.Invoice.get(estimate.linked_invoice_id),
    enabled: !!estimate?.linked_invoice_id,
  });
  const { data: linkedRO } = useQuery({
    queryKey: ["linkedRO", estimateId],
    queryFn: () => base44.entities.RepairOrder.filter({ estimate_id: estimateId }).then((ros) => ros[0] || null),
    enabled: !!estimateId,
  });

  useEffect(() => {
    if (!estimate) return;
    // Re-sync the draft whenever fresh estimate data arrives (new updated_date),
    // so every field — especially service_reason ("Service Description") and
    // notes — is identical regardless of which navigation path opened the
    // estimate (Estimates list, Customer Profile, dashboard widget, deep-link).
    const key = estimate.updated_date || estimate.id;
    if (key === loadedKey) return;
    setDraft({
      line_items: toLines(estimate),
      tax_rate: Number(estimate.tax_rate) || 0,
      tax_applies_to: estimate.tax_applies_to || "both",
      discount: Number(estimate.discount) || 0,
      discount_type: normalizeDiscountType(estimate.discount_type) === "percent" ? "%" : "$",
      estimate_date: estimate.estimate_date || estimate.created_date?.split("T")[0] || "",
      valid_until: estimate.valid_until || "",
      service_reason: estimate.service_reason || "",
      notes: estimate.notes || "",
    });
    setLoadedKey(key);
  }, [estimate, loadedKey]);

  const totals = useMemo(
    () => calculateFinancials(draft || { line_items: [] }, estimate?.amount_paid || 0),
    [draft, estimate?.amount_paid]
  );

  if (!estimate) return <div className="py-24 text-center text-gray-400">Loading estimate…</div>;
  if (!draft) return null;

  const ghostActive = estimate.ghost_status === "active";
  const ghostConverted = estimate.ghost_status === "converted";
  const splitLineItems = ghostActive ? [...draft.line_items, ...(estimate.ghost_items || [])] : draft.line_items;
  const splitInitialRemaining = ghostActive ? (estimate.ghost_items || []).map((_, i) => draft.line_items.length + i) : [];

  const save = async () => {
    setSaving(true);
    try {
      const laborItems = draft.line_items
        .filter((l) => l.type === "labor")
        .map((l) => ({
          description: l.name,
          details: l.description || "",
          hours: Number(l.quantity) || 0,
          rate: Number(l.unit_price) || 0,
          total: r2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)),
        }));
      const partsItems = draft.line_items
        .filter((l) => l.type !== "labor")
        .map((p) => ({
          name: p.name,
          details: p.description || "",
          part_number: p.part_number || "",
          quantity: Number(p.quantity) || 0,
          unit_price: Number(p.unit_price) || 0,
          total: r2((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)),
        }));

      const _gItems = estimate.ghost_items || [];
      const _gActive = estimate.ghost_status === "active" && _gItems.length > 0;
      const _gTotals = _gActive ? calcGhostTotals(_gItems, Number(draft.tax_rate) || 0, draft.tax_applies_to) : null;
      await base44.entities.Estimate.update(estimateId, {
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
        ghost_total: _gTotals ? _gTotals.total : (estimate.ghost_total || 0),
        estimate_date: draft.estimate_date,
        valid_until: draft.valid_until,
        notes: draft.notes,
        service_reason: draft.service_reason,
      });

      // Sync edits to any linked Repair Order (same as the legacy estimate editor)
      if (linkedRO) {
        try {
          await base44.entities.RepairOrder.update(linkedRO.id, {
            customer_name: estimate.customer_name,
            vehicle_info: estimate.vehicle_info,
            labor_items: laborItems,
            labor_cost: r2(totals.labor),
            labor_hours: laborItems.reduce((s, l) => s + l.hours, 0),
            parts_used: partsItems,
            parts_cost: r2(totals.parts),
            total_cost: r2(totals.total),
            notes: draft.notes,
          });
        } catch (e) { /* non-fatal */ }
      }

      try {
        await syncCustomerActivity({
          customerId: estimate.customer_id,
          vehicleId: estimate.vehicle_id,
          vehicleInfo: estimate.vehicle_info,
          customerName: estimate.customer_name,
          isNewVisit: false,
        });
      } catch (e) { /* non-fatal */ }

      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      syncLineItemLibrary(draft.line_items);
      toast({ title: "Estimate saved ✓" });
    } catch (e) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendEstimateEmail = async () => {
    const sent = await sendEmail(estimate.id, "estimate", customer?.email || null, estimate.customer_id, estimate.customer_name, estimate);
    if (sent) {
      await base44.entities.Estimate.update(estimate.id, { status: "sent", auth_status: "pending" });
      queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
    }
  };

  const convertToRO = async () => {
    if (!window.confirm("Convert this estimate to a repair order?")) return;
    const response = await base44.functions.invoke("convertEstimateToRepairOrder", { estimate_id: estimate.id });
    const order = response.data?.repair_order;
    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
    queryClient.invalidateQueries({ queryKey: ["repairOrders"] });
    if (order?.id) navigate(`/RepairOrderDetail/${order.id}`);
  };

  // Record Payment = Estimate → Invoice conversion + payment in one action.
  // After the dialog finishes, the estimate is linked to a new invoice; navigate to it.
  const onPaymentSaved = async () => {
    setPayment(false);
    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    const fresh = await base44.entities.Estimate.get(estimateId).catch(() => null);
    if (fresh?.linked_invoice_id) navigate(`/InvoiceDetail/${fresh.linked_invoice_id}`);
  };

  // ── Ghost Mode ──
  const onGhostChanged = () => {
    setLoadedKey(null);
    queryClient.invalidateQueries({ queryKey: ["estimate", estimateId] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
  };
  const handleSplit = async ({ doneNowItems, ghostItems, ghostNotes, ghostTotal }) => {
    try {
      const doneTotals = calculateFinancials({ ...draft, line_items: doneNowItems }, estimate.amount_paid || 0);
      const laborItems = doneNowItems.filter((l) => l.type === "labor").map((l) => ({ description: l.name, details: l.description || "", hours: Number(l.quantity) || 0, rate: Number(l.unit_price) || 0, total: r2((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)) }));
      const partsItems = doneNowItems.filter((l) => l.type !== "labor").map((p) => ({ name: p.name, details: p.description || "", part_number: p.part_number || "", quantity: Number(p.quantity) || 0, unit_price: Number(p.unit_price) || 0, total: r2((Number(p.quantity) || 0) * (Number(p.unit_price) || 0)) }));
      await base44.entities.Estimate.update(estimateId, {
        labor_items: laborItems, parts_items: partsItems,
        labor_total: r2(doneTotals.labor), parts_total: r2(doneTotals.parts),
        tax_amount: r2(doneTotals.tax), grand_total: r2(doneTotals.total),
        ghost_items: ghostItems, ghost_status: "active", ghost_notes: estimate.ghost_status === "active" ? (estimate.ghost_notes || ghostNotes) : ghostNotes, ghost_total: r2(ghostTotal),
      });
      onGhostChanged();
      toast({ title: "Work split — ghost created ✓" });
    } catch (e) {
      toast({ title: "Split failed", description: e?.message, variant: "destructive" });
    }
  };
  const handleGhostNotes = async (value) => {
    try { await base44.entities.Estimate.update(estimateId, { ghost_notes: value }); onGhostChanged(); } catch (e) {}
  };
  const handleGhostEdit = async (items, notes) => {
    try {
      const t = calcGhostTotals(items, draft.tax_rate, draft.tax_applies_to);
      await base44.entities.Estimate.update(estimateId, { ghost_items: items, ghost_notes: notes, ghost_total: t.total });
      onGhostChanged();
    } catch (e) {}
  };
  const handleGhostConvert = async (targetType) => {
    try {
      const res = await base44.functions.invoke("convertGhostToDocument", { source_type: "Estimate", source_id: estimateId, target_type: targetType });
      onGhostChanged();
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["repairOrders"] });
      if (res.data?.new_id) navigate(targetType === "Invoice" ? `/InvoiceDetail/${res.data.new_id}` : `/RepairOrderDetail/${res.data.new_id}`);
    } catch (e) {
      toast({ title: "Convert failed", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    }
  };
  const handleViewConverted = () => {
    if (!estimate.ghost_converted_to) return;
    navigate(estimate.ghost_converted_type === "Invoice" ? `/InvoiceDetail/${estimate.ghost_converted_to}` : `/RepairOrderDetail/${estimate.ghost_converted_to}`);
  };

  return (
    <>
      <EstimateEditorHeader
        estimate={estimate}
        customer={customer}
        vehicle={vehicle}
        linkedInvoice={linkedInvoice}
        linkedRO={linkedRO}
      />
      <div className="max-h-[72vh] overflow-y-auto px-5 py-5 md:px-6">
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
        {(estimate.ghost_status === "active" || estimate.ghost_status === "converted") && (
          <GhostSection record={estimate} taxRate={draft.tax_rate} taxAppliesTo={draft.tax_applies_to} onNotesChange={handleGhostNotes} onEditGhost={handleGhostEdit} onConvert={handleGhostConvert} onViewConverted={handleViewConverted} />
        )}
      </div>
      <EstimateEditorActions
        saving={saving}
        sending={sending === estimate.id}
        hasLinkedInvoice={!!estimate.linked_invoice_id}
        hasLinkedRO={!!linkedRO}
        extraActions={ghostConverted ? null : <GhostModeButton lineItems={splitLineItems} taxRate={draft.tax_rate} taxAppliesTo={draft.tax_applies_to} initialRemaining={splitInitialRemaining} label={ghostActive ? "Edit Split" : "Ghost Mode"} onSplit={handleSplit} />}
        onCancel={() => onClose?.()}
        onSave={save}
        onPrint={() => setPrinting(true)}
        onSend={sendEstimateEmail}
        onPayment={() => setPayment(true)}
        onViewInvoice={() => navigate(`/InvoiceDetail/${estimate.linked_invoice_id}`)}
        onConvertRO={convertToRO}
        onViewRO={() => navigate(`/RepairOrderDetail/${linkedRO.id}`)}
      />
      {printing && <EstimatePrintView estimate={estimate} onClose={() => setPrinting(false)} />}
      {payment && (
        <PaymentReceiptDialog
          open
          invoice={{
            id: estimate.id,
            linked_invoice_id: estimate.linked_invoice_id || null,
            invoice_number: estimate.estimate_number,
            customer_id: estimate.customer_id,
            customer_name: estimate.customer_name,
            vehicle_info: estimate.vehicle_info,
            total: estimate.grand_total || r2(totals.total),
            amount_paid: estimate.amount_paid || 0,
            balance_due: (estimate.grand_total || r2(totals.total)) - (estimate.amount_paid || 0),
          }}
          source={{ type: "estimate", id: estimate.id }}
          entityName="Estimate"
          onClose={() => setPayment(false)}
          onSaved={onPaymentSaved}
        />
      )}
    </>
  );
}