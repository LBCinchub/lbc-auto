// Which saved invoice a Record Payment dialog should pay.
// When the dialog is given a saved Invoice record (entityName "Invoice"), its own id is canonical,
// even if the editor was opened from an Estimate or Repair Order source.
export function resolvePaymentInvoiceId({ invoice, entityName = "Invoice" }) {
  if (!invoice) return "";
  return entityName === "Invoice" ? invoice.id || "" : invoice.linked_invoice_id || "";
}