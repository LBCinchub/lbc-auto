// Which saved invoice a Record Payment dialog should pay.
// When the dialog is given a saved Invoice record (entityName "Invoice"), its own id is canonical,
// even if the editor was opened from an Estimate or Repair Order source.
export function resolvePaymentInvoiceId({ invoice, entityName = "Invoice" }) {
  if (!invoice) return "";
  return entityName === "Invoice" ? invoice.id || "" : invoice.linked_invoice_id || "";
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// What the dialog may show/accept. saved: undefined = still loading, null = no saved invoice,
// object = authoritative server invoice (its number and balance win over stale source fields).
export function paymentDialogState({ saved, fallback, loadError = false }) {
  if (saved === undefined) return { loading: true, label: "Loading…", balance: 0, paidInFull: false, canPay: false };
  if (saved) {
    const balance = r2(saved.balance_due ?? (Number(saved.total) || 0) - (Number(saved.amount_paid) || 0));
    const paidInFull = balance <= 0;
    return { loading: false, label: saved.invoice_number || "Saved invoice", balance: Math.max(0, balance), paidInFull, canPay: !paidInFull };
  }
  const balance = Math.max(0, r2(fallback?.balance_due ?? (Number(fallback?.total) || 0) - (Number(fallback?.amount_paid) || 0)));
  return { loading: false, label: "New invoice (created on payment)", balance, paidInFull: false, canPay: !loadError && balance > 0 };
}