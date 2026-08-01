import React, { useMemo, useState } from "react";
import FinancialDocumentDrawer from "@/components/financial-workflow/FinancialDocumentDrawer";
import FinancialStartPicker from "@/components/financial-workflow/FinancialStartPicker";
export default function InvoiceFormDialog({ open, onClose, invoice, orders = [], customers = [], vehicles = [], onSaved, initialOrderId, sourceEstimate }) {
  const initial = useMemo(() => invoice?.id ? { type: "invoice", id: invoice.id } : sourceEstimate?.id ? { type: "estimate", id: sourceEstimate.id } : initialOrderId ? { type: "repair_order", id: initialOrderId } : invoice?.vehicle_id ? { type: "vehicle", id: invoice.vehicle_id } : null, [invoice?.id, invoice?.vehicle_id, sourceEstimate?.id, initialOrderId]);
  const [selected, setSelected] = useState(null);
  if (!open) return null;
  const source = initial || selected;
  return source ? <FinancialDocumentDrawer open source={source} onClose={() => { setSelected(null); onClose(); }} onSaved={onSaved} /> : <FinancialStartPicker customers={customers} vehicles={vehicles} onSelect={setSelected} onClose={onClose} />;
}