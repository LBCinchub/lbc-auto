// Pure checks on a Stripe Checkout Session before it may become an invoice payment.
// Kept free of I/O so they can be tested with synthetic fixtures.

export const PAY_CURRENCY = 'cad';
export const toMinor = (v: unknown) => Math.round((Number(v) || 0) * 100);

// '' when the session is exactly the payment this link asked for, otherwise why it is not.
export function sessionMismatch(link: any, session: any) {
  if (!session || session.id !== link.checkout_session_id) return 'session';
  if (session.metadata?.invoice_id !== link.invoice_id) return 'invoice';
  if (String(session.metadata?.shop || '').toLowerCase() !== String(link.shop_owner_email || '').toLowerCase()) return 'shop';
  if (String(session.currency || '').toLowerCase() !== String(link.currency || '').toLowerCase()) return 'currency';
  if (Number(session.amount_total) !== toMinor(link.amount)) return 'amount';
  return '';
}

// paid = Stripe confirmed the money; processing = finished but not confirmed yet;
// expired = can no longer be paid; open = the customer has not finished.
export function sessionOutcome(session: any) {
  if (session?.status === 'complete') return session.payment_status === 'paid' ? 'paid' : 'processing';
  if (session?.status === 'expired') return 'expired';
  return 'open';
}

// Stripe idempotency key for a new checkout: two clicks racing for the same invoice balance and
// attempt number get the SAME Stripe session instead of two payable ones.
export const checkoutIdempotencyKey = (invoiceId: string, amount: number, attempt: number, inApp: boolean) =>
  `lbc-checkout:${invoiceId}:${toMinor(amount)}:${attempt}:${inApp ? 'in_app' : 'link'}`;