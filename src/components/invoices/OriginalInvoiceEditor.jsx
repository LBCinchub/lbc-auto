import React, { useState } from "react";
import useFinancialWorkflow from "@/components/financial-workflow/useFinancialWorkflow";
import InvoiceEditorHeader from "./InvoiceEditorHeader";
import InvoiceDetailsFields from "./InvoiceDetailsFields";
import InvoiceLineItemsTable from "./InvoiceLineItemsTable";
import InvoiceTotalsSection from "./InvoiceTotalsSection";
import InvoiceEditorActions from "./InvoiceEditorActions";
import InvoicePrintView from "./InvoicePrintView";
import PaymentReceiptDialog from "./PaymentReceiptDialog";

export default function OriginalInvoiceEditor({ source, onClose, onSaved, closeAfterSave = false }) {
  const flow = useFinancialWorkflow({ open: true, source, onSaved });
  const [printing, setPrinting] = useState(false), [payment, setPayment] = useState(false);
  const cancel = () => { if (!flow.dirty || window.confirm("Discard unsaved invoice changes?")) onClose(); };
  const save = async () => { const saved = await flow.act(flow.data?.invoice ? "update" : "create"); if (saved && closeAfterSave) onClose(); };
  if (flow.loading) return <div className="py-24 text-center text-gray-400">Loading invoice…</div>;
  if (!flow.draft) return <div className="p-6"><p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">{flow.error || "Invoice unavailable"}</p><button onClick={onClose} className="mt-4 text-sm text-sky-400">Back</button></div>;
  return <>
    <InvoiceEditorHeader data={flow.data} />
    <div className="max-h-[72vh] overflow-y-auto px-5 py-5 md:px-6"><InvoiceDetailsFields draft={flow.draft} onChange={flow.setDraft} /><InvoiceLineItemsTable lines={flow.draft.line_items || []} onChange={line_items => flow.setDraft({ ...flow.draft, line_items })} /><InvoiceTotalsSection draft={flow.draft} totals={flow.totals} onChange={flow.setDraft} />{flow.error && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{flow.error}</p>}</div>
    <InvoiceEditorActions invoice={flow.data?.invoice} saving={flow.saving} sending={flow.saving} dirty={flow.dirty} onCancel={cancel} onSave={save} onPrint={() => setPrinting(true)} onSend={flow.send} onPayment={() => setPayment(true)} />
    {printing && flow.data?.invoice && <InvoicePrintView invoice={flow.data.invoice} onClose={() => setPrinting(false)} />}
    {payment && flow.data?.invoice && <PaymentReceiptDialog open invoice={flow.data.invoice} source={source} onClose={() => setPayment(false)} onSaved={async () => { setPayment(false); await flow.reload(); }} />}
  </>;
}