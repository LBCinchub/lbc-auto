import React from "react";
import { useParams } from "react-router-dom";
import OriginalInvoiceEditor from "@/components/invoices/OriginalInvoiceEditor";
import { useSmartBack } from "@/components/shared/useSmartBack";

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const goBack = useSmartBack("/Invoices");
  return <div className="lbc-editor-frame lbc-page-editor flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-800 bg-gray-900"><OriginalInvoiceEditor source={{ type: "invoice", id: invoiceId }} onClose={goBack} /></div>;
}