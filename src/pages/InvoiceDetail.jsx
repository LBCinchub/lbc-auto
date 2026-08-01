import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import FinancialDocumentDrawer from "@/components/financial-workflow/FinancialDocumentDrawer";
export default function InvoiceDetail() {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  return <FinancialDocumentDrawer open source={{ type: "invoice", id: invoiceId }} onClose={() => navigate(-1)} />;
}