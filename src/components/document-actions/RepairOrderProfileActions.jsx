import React, { useState } from "react";
import { CreditCard, ExternalLink, FileText, History, Send, Trash2 } from "lucide-react";
import { useEmailSend } from "@/hooks/useEmailSend";
import PaymentReceiptDialog from "@/components/invoices/PaymentReceiptDialog";
import DocumentActionBar from "./DocumentActionBar";
import RepairOrderHistoryDialog from "./RepairOrderHistoryDialog";
import useBusyAction from "./useBusyAction";
import { deleteDocument, generateInvoiceFromRepairOrder, repairOrderActionState, repairOrderCashoutSource } from "@/lib/documentActions";

// Same actions as a repair order card on the Repair Orders page, grouped for the customer profile.
export default function RepairOrderProfileActions({ doc: order, customer, onOpen, onChanged }) {
  const [dialog, setDialog] = useState(null); // "cashout" | "history"
  const { busyId, runBusy } = useBusyAction();
  const { sending, sendEmail } = useEmailSend();
  const s = repairOrderActionState(order);
  const close = () => setDialog(null);

  const generate = () => runBusy("inv", async () => {
    const invoice = await generateInvoiceFromRepairOrder(order);
    if (invoice?.id) { onChanged(); onOpen("invoice", invoice.id); }
  });

  const actions = [
    { id: "open", label: "Open Repair Order", icon: ExternalLink, group: "view", primary: true, onClick: () => onOpen("repair_order", order.id) },
    { id: "cashout", label: "Cash Out", icon: CreditCard, group: "money", primary: true, tone: "text-emerald-400", onClick: () => setDialog("cashout") },
    s.linkedInvoiceId
      ? { id: "inv", label: "View Invoice", icon: FileText, group: "money", primary: true, onClick: () => onOpen("invoice", s.linkedInvoiceId) }
      : { id: "inv", label: "Generate Invoice", icon: FileText, group: "money", primary: true, onClick: generate },
    { id: "email", label: "Email Repair Order", icon: Send, group: "send", onClick: () => runBusy("email", () => sendEmail(order.id, "repair_order", customer?.email || null, order.customer_id, order.customer_name, order)) },
    s.hasHistory && { id: "history", label: "View History", icon: History, group: "view", onClick: () => setDialog("history") },
    { id: "delete", label: "Delete Repair Order", icon: Trash2, group: "danger", onClick: () => runBusy("delete", async () => { if (await deleteDocument("RepairOrder", order.id)) onChanged(); }) },
  ];

  return (
    <>
      <DocumentActionBar actions={actions} busyId={busyId || (sending === order.id ? "email" : null)} />
      {dialog === "cashout" && (
        <PaymentReceiptDialog open onClose={close} invoice={repairOrderCashoutSource(order)} entityName="RepairOrder" onSaved={() => { close(); onChanged(); }} />
      )}
      {dialog === "history" && <RepairOrderHistoryDialog order={order} onClose={close} />}
    </>
  );
}