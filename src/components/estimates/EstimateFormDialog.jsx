import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import EstimateCreateEditor from "@/components/estimates/EstimateCreateEditor";

/**
 * Unified estimate CREATE surface.
 *
 * Every entry point that creates an estimate (Estimates page "+ New Estimate",
 * the "Customer Added!" success modal "Create Estimate" action, the customer
 * profile quick action, and URL-prefilled deep links) renders this dialog, which
 * uses the exact same layout/design as the EstimateDetail page
 * (EstimateDetailsFields + InvoiceLineItemsTable + InvoiceTotalsSection).
 *
 * Editing an existing estimate is NOT done here — it goes through the
 * EstimateDetail page (the canonical reference), so the edit experience is
 * identical everywhere.
 */
export default function EstimateFormDialog({ open, onClose, estimate, customers, vehicles, parts, repairOrderId, onSaved }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="bg-gray-900 border-gray-800 text-white max-w-4xl p-0 overflow-hidden"
        style={{ maxHeight: "92vh" }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <EstimateCreateEditor
          prefill={estimate}
          customers={customers}
          onClose={onClose}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}