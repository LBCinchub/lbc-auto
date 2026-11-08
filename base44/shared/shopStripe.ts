// Optional per-shop Stripe: encrypted key storage, Stripe REST calls, and Stripe-verified card
// payments recorded on invoices exactly once. Shared by shopStripe and publicCardPayment.
import { applyPayments, paymentAlreadyApplied } from './invoicePaymentGuard.ts';
import { withLease } from './recordLease.ts';

const enc = new TextEncoder();
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function cipherKey() {
  const secret = Deno.env.get('SHOP_KEYS_ENCRYPTION_SECRET') || '';
  if (secret.length < 16) throw new Error('Card payments are not set up for this app yet.');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function sealSecret(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cipherKey(), enc.encode(plain)));
  return `v1.${toB64(iv)}.${toB64(sealed)}`;
}

export async function openSecret(stored) {
  const key = await cipherKey();
  const [version, iv, sealed] = String(stored || '').split('.');
  try {
    if (version !== 'v1') throw new Error('Unknown key format');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(sealed));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('The saved Stripe key can no longer be read. Disconnect and reconnect Stripe in Settings.');
  }
}

export async function stripeApi(secretKey, method, path, params = null) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': '2025-10-29.clover', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params ? new URLSearchParams(params).toString() : undefined,
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function shopAccount(entities, tenant) {
  return (await entities.ShopStripeAccount.filter({ shop_owner_email: tenant }, '-created_date', 1))[0] || null;
}

// What the browser may see about a connection: never the key itself.
export const accountView = (a) => a
  ? { connected: true, mode: a.mode, account_name: a.stripe_account_name || '', key_last4: a.key_last4 || '', currency: String(a.currency || '').toUpperCase(), charges_enabled: a.charges_enabled !== false }
  : { connected: false };

export const linkView = (l) => l
  ? { status: l.status, url: l.status === 'open' ? l.pay_url : '', amount: l.amount, currency: String(l.currency || '').toUpperCase(), invoice_number: l.invoice_number || '', note: l.note || '' }
  : null;

// Same rule as financialDocumentAction: an explicit shop stamp wins, otherwise the creator.
export function ownsRecord(record, tenant, userId) {
  if (!record) return false;
  const explicit = String(record.shop_owner_email || record.shop_email || record.created_by || '').toLowerCase();
  return explicit ? explicit === tenant : record.created_by_id === userId;
}

export const invoiceBalance = (inv) =>
  r2(Math.max(0, Number(inv.balance_due ?? ((Number(inv.total) || 0) - (Number(inv.amount_paid) || 0))) || 0));

// Adds a Stripe-verified payment to the invoice once (payment_key = Checkout Session id).
// A payment that no longer fits the balance is flagged for review instead of being forced in.
export async function applyCheckoutPayment(entities, link, session) {
  const now = new Date().toISOString();
  const paymentKey = `stripe:${session.id}`;
  const amount = r2((Number(session.amount_total) || 0) / 100);
  let status = 'paid';
  await withLease(entities, 'Invoice', link.invoice_id, async () => {
    const invoice = await entities.Invoice.get(link.invoice_id);
    if (paymentAlreadyApplied(invoice, paymentKey)) return;
    let result;
    try {
      result = applyPayments(invoice, [{ amount, method: 'card', note: 'Paid online with Stripe' }], now.slice(0, 10), paymentKey);
    } catch {
      status = 'needs_review';
      return;
    }
    await entities.Invoice.update(invoice.id, result.update);
    await entities.FinancialWorkflowEvent.create({ shop_owner_email: link.shop_owner_email, action: 'record_payment', invoice_id: invoice.id, source_type: 'invoice', source_id: invoice.id, idempotency_key: paymentKey, created_at: now, actor_email: link.shop_owner_email, metadata: { amount: result.added, provider: 'stripe', checkout_session_id: session.id } });
  });
  const note = status === 'needs_review'
    ? `The customer paid $${amount.toFixed(2)} by card, but the invoice balance had changed, so it was not added automatically. Check the invoice, then record it or refund it in Stripe.`
    : '';
  return entities.StripeCheckoutLink.update(link.id, { status, note, paid_at: now, paid_amount: amount });
}

// Brings an open link up to date with Stripe: records a completed payment, marks an expired
// session, and (when asked) closes a still-open session so it can never be paid later.
export async function syncLink(entities, secretKey, link, { close = false } = {}) {
  const sessionPath = `checkout/sessions/${encodeURIComponent(link.checkout_session_id)}`;
  const got = await stripeApi(secretKey, 'GET', sessionPath);
  if (!got.ok) throw new Error(`Stripe: ${got.data?.error?.message || 'could not check the payment'}`);
  const session = got.data;
  if (session.payment_status === 'paid' && session.metadata?.invoice_id === link.invoice_id) return applyCheckoutPayment(entities, link, session);
  if (session.status === 'expired') return entities.StripeCheckoutLink.update(link.id, { status: 'expired' });
  if (close) {
    const closed = await stripeApi(secretKey, 'POST', `${sessionPath}/expire`);
    if (closed.ok) return entities.StripeCheckoutLink.update(link.id, { status: 'cancelled' });
  }
  return link;
}