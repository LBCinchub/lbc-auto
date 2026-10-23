// Pure helpers for financialDocumentAction: invoice/source identity checks and payment math.
const r2 = (v: unknown) => Math.round((Number(v) || 0) * 100) / 100;

// An invoice may only be acted on through a source it actually belongs to.
// Never substitute an unrelated (even same-tenant) invoice.
export function assertInvoiceMatchesSource({ sourceType, source, invoice, requestedInvoiceId }: any) {
  if (!invoice) return;
  if (requestedInvoiceId && invoice.id !== requestedInvoiceId) throw new Error('Invoice does not match this source');
  if (sourceType === 'estimate' || sourceType === 'repair_order') {
    const field = sourceType === 'estimate' ? 'estimate_id' : 'repair_order_id';
    // Cross-route: an RO's invoice may be linked only through the RO's estimate, and vice versa.
    const viaPartner = sourceType === 'repair_order'
      ? !!source?.estimate_id && invoice.estimate_id === source.estimate_id && (!invoice.repair_order_id || invoice.repair_order_id === source.id)
      : !!source?.linked_repair_order_id && invoice.repair_order_id === source.linked_repair_order_id && (!invoice.estimate_id || invoice.estimate_id === source.id);
    if (invoice[field] !== source?.id && source?.linked_invoice_id !== invoice.id && !viaPartner) throw new Error('Invoice does not match this source');
  }
}

// Builds the invoice update for appending payments. Throws on invalid/over-balance amounts.
// True when a payment request with this key is already stored on the invoice (durable replay check).
export function paymentAlreadyApplied(invoice: any, paymentKey: string) {
  return !!paymentKey && (invoice?.payment_history || []).some((p: any) => p?.payment_key === paymentKey);
}

export function applyPayments(invoice: any, payments: any[], today: string, paymentKey = '') {
  const additions = (payments || []).map((p) => ({ date: today, amount: r2(p.amount), method: String(p.method || 'other'), note: String(p.note || ''), ...(paymentKey ? { payment_key: paymentKey } : {}) }));
  const added = r2(additions.reduce((s, p) => s + p.amount, 0));
  const total = Number(invoice.total) || 0;
  const balanceBefore = Number(invoice.balance_due ?? total) || 0;
  if (additions.some((p) => p.amount <= 0) || added <= 0 || added > balanceBefore + 0.01) throw new Error('Payment amount exceeds the balance or is invalid');
  const amountPaid = r2((Number(invoice.amount_paid) || 0) + added);
  const balance = r2(Math.max(0, total - amountPaid));
  const history = [...(invoice.payment_history || []), ...additions];
  return {
    added,
    update: { amount_paid: amountPaid, balance_due: balance, status: balance === 0 ? 'paid' : 'partial', paid_date: balance === 0 ? today : invoice.paid_date, payment_history: history, payment_method: [...new Set(history.map((p: any) => p.method).filter(Boolean))].join('+') },
  };
}