// Optional per-shop Stripe: encrypted key storage, Stripe REST calls, and Stripe-verified card
// payments recorded on invoices exactly once. Shared by shopStripe and publicCardPayment.
import { applyPayments, paymentAlreadyApplied } from './invoicePaymentGuard.ts';
import { withLease } from './recordLease.ts';
import { sessionMismatch, sessionOutcome } from './stripeCheckoutCheck.ts';

const enc = new TextEncoder();
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const fromB64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const masterSecret = () => Deno.env.get('SHOP_KEYS_ENCRYPTION_SECRET') || '';
// Shops can connect once the app owner's master secret is set. PBKDF2 stretching (100k rounds,
// the most this runtime supports) makes every guess slow, so a 12+ character secret is enough.
export const cardPaymentsReady = () => masterSecret().length >= 12;

let derivedKey: Promise<CryptoKey> | null = null;
function cipherKey() {
  if (!cardPaymentsReady()) throw new Error('Card payments are not set up for this app yet.');
  derivedKey ??= crypto.subtle.importKey('raw', enc.encode(masterSecret()), 'PBKDF2', false, ['deriveKey'])
    .then((base) => crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('lbc-auto/shop-stripe-keys/v2'), iterations: 100000 },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    ))
    .catch((e) => { derivedKey = null; throw e; });
  return derivedKey;
}

// "Available" only once the encryption key really derives here, so shops never hit a dead end.
export async function cardPaymentsAvailable() {
  if (!cardPaymentsReady()) return false;
  await cipherKey();
  return true;
}

export async function sealSecret(plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await cipherKey(), enc.encode(plain)));
  return `v2.${toB64(iv)}.${toB64(sealed)}`;
}

export async function openSecret(stored) {
  const key = await cipherKey();
  const [version, iv, sealed] = String(stored || '').split('.');
  try {
    if (version !== 'v2') throw new Error('Unknown key format');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(sealed));
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error('The saved Stripe key can no longer be read. Disconnect and reconnect Stripe in Settings.');
  }
}

export async function stripeApi(secretKey, method, path, params = null, idempotencyKey = '') {
  const headers: Record<string, string> = { Authorization: `Bearer ${secretKey}`, 'Stripe-Version': '2025-10-29.clover', 'Content-Type': 'application/x-www-form-urlencoded' };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers,
    body: params ? new URLSearchParams(params).toString() : undefined,
    signal: AbortSignal.timeout(15000),
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function shopAccount(entities, tenant) {
  return (await entities.ShopStripeAccount.filter({ shop_owner_email: tenant }, '-created_date', 1))[0] || null;
}

// Re-reads the shop's Stripe account so "can take payments" is current, never a stale guess.
export async function refreshAccount(entities, account) {
  if (!account) return null;
  const got = await stripeApi(await openSecret(account.encrypted_secret_key), 'GET', 'account');
  if (!got.ok) return { ...account, charges_enabled: false, key_problem: got.data?.error?.message || 'Stripe did not accept the saved key.' };
  const enabled = got.data.charges_enabled === true;
  return enabled === account.charges_enabled ? account : entities.ShopStripeAccount.update(account.id, { charges_enabled: enabled });
}

// What the browser may see about a connection: never the secret key. The publishable key is
// public by design (it is what Stripe's own card form loads with).
export const accountView = (a) => a
  ? {
      connected: true, mode: a.mode, account_name: a.stripe_account_name || '', key_last4: a.key_last4 || '',
      currency: String(a.currency || '').toUpperCase(), charges_enabled: a.charges_enabled === true,
      in_app_ready: !!a.publishable_key, publishable_key: a.publishable_key || '', key_problem: a.key_problem || '',
    }
  : { connected: false };

export const linkView = (l) => l
  ? { status: l.status, in_app: l.ui_mode === 'embedded', url: l.status === 'open' && l.ui_mode !== 'embedded' ? l.pay_url : '', amount: l.amount, currency: String(l.currency || '').toUpperCase(), invoice_number: l.invoice_number || '', note: l.note || '' }
  : null;

// Same rule as financialDocumentAction: an explicit shop stamp wins, otherwise the creator.
export function ownsRecord(record, tenant, userId) {
  if (!record) return false;
  const explicit = String(record.shop_owner_email || record.shop_email || record.created_by || '').toLowerCase();
  return explicit ? explicit === tenant : record.created_by_id === userId;
}

export const invoiceBalance = (inv) =>
  r2(Math.max(0, Number(inv.balance_due ?? ((Number(inv.total) || 0) - (Number(inv.amount_paid) || 0))) || 0));

const reviewNote = (amount) => `The customer paid $${amount.toFixed(2)} by card, but it did not match this invoice's balance, so it was not added automatically. Check the invoice, then record it or refund it in Stripe.`;

// Adds a Stripe-verified payment to the invoice once (payment_key = Checkout Session id), under
// the same invoice lock as manual Record Payment. A payment that does not match the link exactly,
// or no longer fits the balance, is flagged for review instead of being forced in.
export async function applyCheckoutPayment(entities, link, session) {
  const now = new Date().toISOString();
  const paymentKey = `stripe:${session.id}`;
  const amount = r2((Number(session.amount_total) || 0) / 100);
  let status = sessionMismatch(link, session) ? 'needs_review' : 'paid';
  if (status === 'paid') {
    await withLease(entities, 'Invoice', link.invoice_id, async () => {
      const invoice = await entities.Invoice.get(link.invoice_id);
      if (paymentAlreadyApplied(invoice, paymentKey)) return;
      let result;
      try {
        result = applyPayments(invoice, [{ amount, method: 'card', note: 'Paid by card with Stripe' }], now.slice(0, 10), paymentKey);
      } catch {
        status = 'needs_review';
        return;
      }
      await entities.Invoice.update(invoice.id, result.update);
      await entities.FinancialWorkflowEvent.create({ shop_owner_email: link.shop_owner_email, action: 'record_payment', invoice_id: invoice.id, source_type: 'invoice', source_id: invoice.id, idempotency_key: paymentKey, created_at: now, actor_email: link.shop_owner_email, metadata: { amount: result.added, provider: 'stripe', checkout_session_id: session.id, payment_intent: session.payment_intent || '' } });
    });
  }
  return entities.StripeCheckoutLink.update(link.id, { status, note: status === 'needs_review' ? reviewNote(amount) : '', paid_at: now, paid_amount: amount });
}

// Brings an open link up to date with Stripe: records a confirmed payment, marks an expired
// session, and (when asked) closes a still-open session so it can never be paid later.
// A finished-but-unconfirmed ("processing") session is left open and never closed.
export async function syncLink(entities, secretKey, link, { close = false } = {}) {
  const sessionPath = `checkout/sessions/${encodeURIComponent(link.checkout_session_id)}`;
  const got = await stripeApi(secretKey, 'GET', sessionPath);
  if (!got.ok) throw new Error(`Stripe: ${got.data?.error?.message || 'could not check the payment'}`);
  const session = got.data;
  const outcome = sessionOutcome(session);
  if (outcome === 'paid') return applyCheckoutPayment(entities, link, session);
  if (outcome === 'expired') return entities.StripeCheckoutLink.update(link.id, { status: 'expired' });
  if (outcome === 'processing') return { ...link, processing: true };
  if (close) {
    const closed = await stripeApi(secretKey, 'POST', `${sessionPath}/expire`);
    if (closed.ok) return entities.StripeCheckoutLink.update(link.id, { status: 'cancelled' });
  }
  return link;
}