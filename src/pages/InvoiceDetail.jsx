import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import OriginalInvoiceEditor from "@/components/invoices/OriginalInvoiceEditor";

export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  return <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900"><OriginalInvoiceEditor source={{ type: "invoice", id: invoiceId }} onClose={() => navigate(-1)} /></div>;
}