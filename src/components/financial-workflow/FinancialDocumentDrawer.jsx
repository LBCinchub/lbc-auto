import React, { useState } from "react";
import FinancialWorkflowShell from "./FinancialWorkflowShell";
import FinancialDocumentHeader from "./FinancialDocumentHeader";
import FinancialSourceContext from "./FinancialSourceContext";
import FinancialLineItemEditor from "./FinancialLineItemEditor";
import FinancialTotalsPanel from "./FinancialTotalsPanel";
import FinancialReview from "./FinancialReview";
import UnifiedFinancialActionBar from "./UnifiedFinancialActionBar";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import useFinancialWorkflow from "./useFinancialWorkflow";
export default function FinancialDocumentDrawer({ open, source, onClose, onSaved }) {
  const flow = useFinancialWorkflow({ open, source, onSaved }), [paymentOpen, setPaymentOpen] = useState(false);
  if (!open) return null;
  const close = () => { if (!flow.dirty || window.confirm("Discard unsaved financial changes?")) onClose(); };
  const back = () => flow.step > 1 ? flow.setStep(flow.step - 1) : close();
  const print = () => window.print();
  return <FinancialWorkflowShell><FinancialDocumentHeader invoice={flow.data?.invoice} step={flow.step} onStep={flow.setStep} onClose={close} /><FinancialSourceContext data={flow.data} /><main className="flex-1 overflow-y-auto p-4 pb-8 md:p-6">{flow.loading && <div className="py-20 text-center text-gray-400">Loading financial workspace…</div>}{flow.error && <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{flow.error} <button onClick={() => flow.act(flow.data?.invoice ? "update" : "create")} className="ml-2 underline">Retry</button></div>}{flow.draft && flow.step === 1 && <FinancialLineItemEditor lines={flow.draft.line_items || []} onChange={line_items => flow.setDraft({ ...flow.draft, line_items })} />}{flow.draft && flow.step === 2 && <FinancialTotalsPanel draft={flow.draft} totals={flow.totals} onChange={flow.setDraft} />}{flow.draft && flow.step === 3 && <FinancialReview data={flow.data} draft={flow.draft} totals={flow.totals} />}</main>{flow.draft && <UnifiedFinancialActionBar step={flow.step} dirty={flow.dirty} totals={flow.totals} saving={flow.saving} saved={flow.data?.invoice} onBack={back} onSave={() => flow.act(flow.data?.invoice ? "update" : "create")} onNext={() => flow.setStep(flow.step + 1)} onFinalize={() => flow.act("finalize")} onPrint={print} onSend={flow.send} onPayment={() => setPaymentOpen(true)} />}{paymentOpen && flow.data?.invoice && <PaymentReceiptDialog open invoice={flow.data.invoice} source={source} onClose={() => setPaymentOpen(false)} onSaved={async () => { setPaymentOpen(false); await flow.reload(); }} />}</FinancialWorkflowShell>;
}