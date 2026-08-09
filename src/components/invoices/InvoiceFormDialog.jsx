import React, { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import OriginalInvoiceEditor from "./OriginalInvoiceEditor";
import InvoiceCreateEditor from "./InvoiceCreateEditor";

/**
 * Unified Invoice creation/edit surface.
 *
 * - Editing an existing invoice, or creating from an existing Estimate / Repair
 *   Order (customer & vehicle already known): uses OriginalInvoiceEditor — the
 *   exact same component the InvoiceDetail page uses — so the layout is
 *   identical everywhere. The header pre-fills/displays the customer & vehicle.
 * - Blank-new invoice (Invoices page "+ Create Invoice", "Customer Added!"
 *   quick action, customer-context entry): uses InvoiceCreateEditor, which
 *   mirrors the same layout and puts a searchable customer dropdown in the
 *   top-right header.
 *
 * Title is always "New Invoice" while creating (never "Edit Invoice") and
 * Print / Send / Record Payment stay hidden until the invoice is saved.
 */
export default function InvoiceFormDialog({ open, onClose, invoice, customers = [], vehicles = [], onSaved, initialOrderId, sourceEstimate }) {
  const initial = useMemo(
    () => (invoice?.id ? { type: "invoice", id: invoice.id } : sourceEstimate?.id ? { type: "estimate", id: sourceEstimate.id } : initialOrderId ? { type: "repair_order", id: initialOrderId } : null),
    [invoice?.id, sourceEstimate?.id, initialOrderId]
  );
  if (!open) return null;
  const close = () => onClose();
  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="max-h-[94vh] max-w-5xl gap-0 overflow-hidden border-gray-800 bg-gray-900 p-0 text-white"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {initial ? (
          <OriginalInvoiceEditor source={initial} onClose={close} onSaved={onSaved} closeAfterSave />
        ) : (
          <InvoiceCreateEditor prefill={invoice} customers={customers} onClose={close} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}