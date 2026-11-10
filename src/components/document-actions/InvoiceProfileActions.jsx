import React, { useState } from "react";
import { DollarSign, Download, ExternalLink, History, MessageSquare, Printer, Send, ShieldCheck, Smartphone, Trash2, Wrench } from "lucide-react";
import { useEmailSend } from "@/hooks/useEmailSend";
import InvoicePrintView from "@/components/invoices/InvoicePrintView";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import PaymentHistoryManager from "@/components/invoices/PaymentHistoryManager";
import TextPdfDialog from "@/components/document-delivery/TextPdfDialog";
import ProBadge from "@/components/document-delivery/ProBadge";
import DocumentActionBar from "./DocumentActionBar";
import useBusyAction from "./useBusyAction";
import { deleteDocument, downloadInvoicePdf, invoiceActionState, requestInvoiceSignature } from "@/lib/documentActions";

// Same actions as an invoice card on the Invoices page, grouped for the customer profile.
export default function InvoiceProfileActions({ doc: inv, customer, onOpen, onChanged }) {
  const [dialog, setDialog] = useState(null); // "pay" | "history" | "print" | "text"
  const { busyId, runBusy } = useBusyAction();
  const { sending, sendEmail } = useEmailSend();
  const s = invoiceActionState(inv);
  const close = () => setDialog(null);
  const saved = () => { setDialog(null); onChanged(); };

  const actions = [
    { id: "open", label: "Open Invoice", icon: ExternalLink, group: "view", primary: true, onClick: () => onOpen("invoice", inv.id) },
    s.canPay && { id: "pay", label: "Record Payment", icon: DollarSign, group: "money", primary: true, tone: "text-emerald-400", onClick: () => setDialog("pay") },
    { id: "text", label: "Text Invoice", badge: <ProBadge />, icon: Smartphone, group: "send", primary: true, tone: "text-sky-300", onClick: () => setDialog("text") },
    { id: "email", label: "Email Invoice", icon: Send, group: "send", disabled: sending === inv.id, onClick: () => runBusy("email", () => sendEmail(inv.id, "invoice", customer?.email || null, inv.customer_id, inv.customer_name, inv)) },
    s.signed
      ? { id: "signed", label: "Approved By Customer", icon: ShieldCheck, group: "send", disabled: true, onClick: () => {} }
      : { id: "sign", label: "Request Signature (Link)", icon: MessageSquare, group: "send", onClick: () => runBusy("sign", async () => { if (await requestInvoiceSignature(inv, customer?.phone)) onChanged(); }) },
    { id: "pdf", label: "Download PDF", icon: Download, group: "send", onClick: () => downloadInvoicePdf(inv) },
    { id: "print", label: "Print", icon: Printer, group: "send", onClick: () => setDialog("print") },
    s.hasHistory && { id: "history", label: "Edit Payment History", icon: History, group: "money", onClick: () => setDialog("history") },
    s.linkedRepairOrderId
      ? { id: "ro", label: "View Repair Order", icon: Wrench, group: "money", onClick: () => onOpen("repair_order", s.linkedRepairOrderId) }
      : { id: "ro", label: "Send To Repair Order", icon: Wrench, group: "money", onClick: () => onOpen("invoice", inv.id) },
    { id: "delete", label: "Delete Invoice", icon: Trash2, group: "danger", onClick: () => runBusy("delete", async () => { if (await deleteDocument("Invoice", inv.id)) onChanged(); }) },
  ];

  return (
    <>
      <DocumentActionBar actions={actions} busyId={busyId || (sending === inv.id ? "email" : null)} />
      {dialog === "pay" && <PaymentReceiptDialog open onClose={close} invoice={inv} onSaved={saved} />}
      {dialog === "history" && <PaymentHistoryManager open onClose={close} invoice={inv} onSaved={saved} />}
      {dialog === "print" && <InvoicePrintView invoice={inv} onClose={close} />}
      {dialog === "text" && <TextPdfDialog documentType="invoice" documentId={inv.id} onClose={() => { close(); onChanged(); }} />}
    </>
  );
}