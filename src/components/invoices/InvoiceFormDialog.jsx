import React, { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import InvoiceSourcePicker from "./InvoiceSourcePicker";
import OriginalInvoiceEditor from "./OriginalInvoiceEditor";

export default function InvoiceFormDialog({ open, onClose, invoice, customers = [], vehicles = [], onSaved, initialOrderId, sourceEstimate }) {
  const initial = useMemo(() => invoice?.id ? { type: "invoice", id: invoice.id } : sourceEstimate?.id ? { type: "estimate", id: sourceEstimate.id } : initialOrderId ? { type: "repair_order", id: initialOrderId } : null, [invoice?.id, sourceEstimate?.id, initialOrderId]);
  const [selected, setSelected] = useState(null);
  if (!open) return null;
  const source = initial || selected;
  if (!source) return <InvoiceSourcePicker customers={customers} vehicles={vehicles} onSelect={setSelected} onClose={onClose} />;
  const close = () => { setSelected(null); onClose(); };
  return <Dialog open onOpenChange={next => !next && close()}><DialogContent className="max-h-[94vh] max-w-5xl gap-0 overflow-hidden border-gray-800 bg-gray-900 p-0 text-white"><OriginalInvoiceEditor source={source} onClose={close} onSaved={onSaved} closeAfterSave /></DialogContent></Dialog>;
}