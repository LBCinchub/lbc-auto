// Which staff actions a document offers, from its saved state only (no client authority:
// the server still decides). Mirrors the conditions on the main list cards.

export function invoiceActionState(inv) {
  return {
    canPay: inv.status === "unpaid" || inv.status === "partial",
    signed: inv.auth_status === "approved",
    hasHistory: inv.payment_history?.length > 0 || inv.amount_paid > 0,
    linkedRepairOrderId: inv.repair_order_id || null,
  };
}

export function estimateActionState(est) {
  return {
    canApprove: est.status !== "approved" && est.status !== "declined",
    // An existing conversion is opened, never recreated.
    linkedRepairOrderId: est.linked_repair_order_id || null,
    linkedInvoiceId: est.linked_invoice_id || null,
  };
}

export function repairOrderActionState(order) {
  return {
    hasHistory: order.history?.length > 0,
    linkedInvoiceId: order.linked_invoice_id || null,
  };
}