import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import useFinancialWorkflow from "@/components/financial-workflow/useFinancialWorkflow";
import InvoiceEditorHeader from "./InvoiceEditorHeader";
import InvoiceDetailsFields from "./InvoiceDetailsFields";
import InvoiceLineItemsTable from "./InvoiceLineItemsTable";
import InvoiceTotalsSection from "./InvoiceTotalsSection";
import InvoiceEditorActions from "./InvoiceEditorActions";
import InvoicePrintView from "./InvoicePrintView";
import QuickNotesEditor from "@/components/shared/QuickNotesEditor";
import GhostModeButton from "@/components/ghost-mode/GhostModeButton";
import GhostSection from "@/components/ghost-mode/GhostSection";
import { calculateFinancials } from "@/components/financial-workflow/financialMath";
import { calcGhostTotals } from "@/utils/ghostTax";
import PaymentReceiptDialog from "./PaymentReceiptDialog";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export default function OriginalInvoiceEditor({ source, onClose, onSaved, closeAfterSave = false }) {
  const flow = useFinancialWorkflow({ open: true, source, onSaved });
  const navigate = useNavigate();
  const [printing, setPrinting] = useState(false), [payment, setPayment] = useState(false);
  const cancel = () => { if (!flow.dirty || window.confirm("Discard unsaved invoice changes?")) onClose(); };
  const save = async () => { const saved = await flow.act(flow.data?.invoice ? "update" : "create"); if (saved && closeAfterSave) onClose(); };
  const inv = flow.data?.invoice;
  const handleSplit = async ({ doneNowItems, ghostItems, ghostNotes, ghostTotal }) => {
    if (!inv) return;
    try {
      const doneTotals = calculateFinancials({ ...flow.draft, line_items: doneNowItems }, inv.amount_paid || 0);
      await base44.entities.Invoice.update(inv.id, {
        line_items: doneNowItems,
        parts_total: r2(doneTotals.parts), labor_total: r2(doneTotals.labor),
        tax_amount: r2(doneTotals.tax), total: r2(doneTotals.total),
        balance_due: Math.max(0, r2(doneTotals.total) - (inv.amount_paid || 0)),
        ghost_items: ghostItems, ghost_status: "active", ghost_notes: inv?.ghost_status === "active" ? (inv.ghost_notes || ghostNotes) : ghostNotes, ghost_total: r2(ghostTotal),
      });
      await flow.reload();
    } catch (e) {}
  };
  const handleGhostNotes = async (v) => { if (!inv) return; try { await base44.entities.Invoice.update(inv.id, { ghost_notes: v }); await flow.reload(); } catch (e) {} };
  const handleGhostEdit = async (items, notes) => { if (!inv) return; try { const t = calcGhostTotals(items, flow.draft.tax_rate, flow.draft.tax_applies_to); await base44.entities.Invoice.update(inv.id, { ghost_items: items, ghost_notes: notes, ghost_total: t.total }); await flow.reload(); } catch (e) {} };
  const handleGhostConvert = async (targetType) => {
    if (!inv) return;
    try {
      const res = await base44.functions.invoke("convertGhostToDocument", { source_type: "Invoice", source_id: inv.id, target_type: targetType });
      await flow.reload();
      if (res.data?.new_id) navigate(targetType === "Invoice" ? `/InvoiceDetail/${res.data.new_id}` : `/RepairOrderDetail/${res.data.new_id}`);
    } catch (e) {}
  };
  const handleViewConverted = () => {
    if (!inv?.ghost_converted_to) return;
    navigate(inv.ghost_converted_type === "Invoice" ? `/InvoiceDetail/${inv.ghost_converted_to}` : `/RepairOrderDetail/${inv.ghost_converted_to}`);
  };
  if (flow.loading) return <div className="py-24 text-center text-gray-400">Loading invoice…</div>;
  if (!flow.draft) return <div className="p-6"><p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{flow.error || "Invoice unavailable"}</p><button onClick={onClose} className="mt-4 text-sm text-sky-400">Back</button></div>;
  const invGhostActive = inv?.ghost_status === "active";
  const invGhostConverted = inv?.ghost_status === "converted";
  const invSplitLines = invGhostActive ? [...(flow.draft.line_items || []), ...(inv?.ghost_items || [])] : (flow.draft.line_items || []);
  const invSplitInitial = invGhostActive ? (inv?.ghost_items || []).map((_, i) => (flow.draft.line_items || []).length + i) : [];
  return <>
    <InvoiceEditorHeader data={flow.data} />
    <div className="max-h-[72vh] overflow-y-auto px-5 py-5 md:px-6"><InvoiceDetailsFields draft={flow.draft} onChange={flow.setDraft} /><InvoiceLineItemsTable lines={flow.draft.line_items || []} onChange={line_items => flow.setDraft({ ...flow.draft, line_items })} /><QuickNotesEditor value={flow.draft.customer_note} onChange={v => flow.setDraft({ ...flow.draft, customer_note: v })} /><InvoiceTotalsSection draft={flow.draft} totals={flow.totals} onChange={flow.setDraft} />{inv && (inv.ghost_status === "active" || inv.ghost_status === "converted") && <GhostSection record={inv} taxRate={flow.draft.tax_rate} taxAppliesTo={flow.draft.tax_applies_to} onNotesChange={handleGhostNotes} onEditGhost={handleGhostEdit} onConvert={handleGhostConvert} onViewConverted={handleViewConverted} />}{flow.error && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{flow.error}</p>}</div>
    <InvoiceEditorActions invoice={flow.data?.invoice} saving={flow.saving} sending={flow.saving} dirty={flow.dirty} extraActions={inv && !invGhostConverted ? <GhostModeButton lineItems={invSplitLines} taxRate={flow.draft.tax_rate} taxAppliesTo={flow.draft.tax_applies_to} initialRemaining={invSplitInitial} label={invGhostActive ? "Edit Split" : "Ghost Mode"} onSplit={handleSplit} /> : null} onCancel={cancel} onSave={save} onPrint={() => setPrinting(true)} onSend={flow.send} onPayment={() => setPayment(true)} />
    {printing && flow.data?.invoice && <InvoicePrintView invoice={flow.data.invoice} onClose={() => setPrinting(false)} />}
    {payment && flow.data?.invoice && <PaymentReceiptDialog open invoice={flow.data.invoice} source={source} onClose={() => setPayment(false)} onSaved={async () => { setPayment(false); await flow.reload(); }} />}
  </>;
}