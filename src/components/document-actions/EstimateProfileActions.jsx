import React, { useState } from "react";
import { CheckCircle2, DollarSign, ExternalLink, FileText, Send, Smartphone, ThumbsUp, Trash2, Wrench } from "lucide-react";
import { useEmailSend } from "@/hooks/useEmailSend";
import InvoiceFormDialog from "@/components/invoices/InvoiceFormDialog";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import TextPdfDialog from "@/components/document-delivery/TextPdfDialog";
import ProBadge from "@/components/document-delivery/ProBadge";
import DocumentActionBar from "./DocumentActionBar";
import useBusyAction from "./useBusyAction";
import {
  approveEstimate, convertEstimateToRepairOrder, deleteDocument, emailEstimate, estimateActionState, estimateCashoutSource,
} from "@/lib/documentActions";

// Same actions as an estimate card on the Estimates page, grouped for the customer profile.
export default function EstimateProfileActions({ doc: est, customer, onOpen, onChanged }) {
  const [dialog, setDialog] = useState(null); // "invoice" | "cashout" | "text"
  const { busyId, runBusy } = useBusyAction();
  const { sendEmail } = useEmailSend();
  const s = estimateActionState(est);
  const close = () => setDialog(null);
  const saved = () => { setDialog(null); onChanged(); };

  const convert = () => runBusy("ro", async () => {
    const order = await convertEstimateToRepairOrder(est);
    if (order?.id) { onChanged(); onOpen("repair_order", order.id); }
  });

  const actions = [
    { id: "open", label: "Open Estimate", icon: ExternalLink, group: "view", primary: true, onClick: () => onOpen("estimate", est.id) },
    s.canApprove
      ? { id: "approve", label: "Approve", icon: ThumbsUp, group: "money", primary: !s.linkedRepairOrderId, tone: "text-emerald-400", onClick: () => runBusy("approve", async () => { if (await approveEstimate(est)) onChanged(); }) }
      : est.status === "approved" && { id: "approved", label: est.customer_decision === "approved" ? "Customer Approved" : "Approved", icon: CheckCircle2, group: "money", disabled: true, onClick: () => {} },
    s.linkedRepairOrderId
      ? { id: "ro", label: "View Repair Order", icon: Wrench, group: "money", primary: true, tone: "text-sky-400", onClick: () => onOpen("repair_order", s.linkedRepairOrderId) }
      : { id: "ro", label: "Convert To Repair Order", icon: Wrench, group: "money", primary: !s.canApprove, tone: "text-sky-400", onClick: convert },
    s.linkedInvoiceId
      ? { id: "inv", label: "View Invoice", icon: FileText, group: "money", onClick: () => onOpen("invoice", s.linkedInvoiceId) }
      : { id: "inv", label: "Convert To Invoice", icon: FileText, group: "money", onClick: () => setDialog("invoice") },
    { id: "cashout", label: "Cash Out", icon: DollarSign, group: "money", onClick: () => setDialog("cashout") },
    { id: "text", label: "Text Estimate", badge: <ProBadge />, icon: Smartphone, group: "send", primary: true, tone: "text-sky-300", onClick: () => setDialog("text") },
    { id: "email", label: "Email Estimate", icon: Send, group: "send", onClick: () => runBusy("email", async () => { if (await emailEstimate(sendEmail, est, customer?.email || null)) onChanged(); }) },
    { id: "delete", label: "Delete Estimate", icon: Trash2, group: "danger", onClick: () => runBusy("delete", async () => { if (await deleteDocument("Estimate", est.id)) onChanged(); }) },
  ];

  return (
    <>
      <DocumentActionBar actions={actions} busyId={busyId} />
      {dialog === "invoice" && (
        <InvoiceFormDialog open onClose={close} invoice={null} orders={[]} customers={customer ? [customer] : []} sourceEstimate={est} onSaved={saved} />
      )}
      {dialog === "cashout" && (
        <PaymentReceiptDialog open onClose={close} invoice={estimateCashoutSource(est)} entityName="Estimate" onSaved={saved} />
      )}
      {dialog === "text" && <TextPdfDialog documentType="estimate" documentId={est.id} onClose={() => { close(); onChanged(); }} />}
    </>
  );
}