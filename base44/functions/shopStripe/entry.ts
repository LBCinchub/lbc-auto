import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { LeaseBusyError } from '../../shared/recordLease.ts';
import { sealSecret, openSecret, stripeApi, shopAccount, refreshAccount, accountView, linkView, ownsRecord, invoiceBalance, syncLink, cardPaymentsAvailable } from '../../shared/shopStripe.ts';
import { PAY_CURRENCY, toMinor, checkoutIdempotencyKey } from '../../shared/stripeCheckoutCheck.ts';

const LINK_ACTIONS = ['link_status', 'create_link', 'cancel_link', 'close_open'];
const SECRET_RE = /^(sk|rk)_(live|test)_\w{10,}$/;
const PUBLISHABLE_RE = /^pk_(live|test)_\w{10,}$/;
const json = (data, status = 200) => Response.json(data, { status });
// Payment links point back to the domain the shop is using (custom domain, platform domain or preview).
const appOrigin = (req) => {
  try { return new URL(req.headers.get('origin') || req.headers.get('x-base44-app-url') || '').origin; } catch { return 'https://lbchub.tech'; }
};
const modeOf = (key) => (key.includes('_live_') ? 'live' : 'test');

// A publishable key is optional; when given it must be a pk_ key of the same mode as the secret key.
function checkPublishable(value, mode) {
  const pk = String(value || '').trim();
  if (!pk) return { pk: '' };
  if (!PUBLISHABLE_RE.test(pk)) return { error: 'That is not a Stripe publishable key. It starts with pk_live_ or pk_test_.' };
  if (modeOf(pk) !== mode) return { error: `Use your ${mode} publishable key so it matches your ${mode} secret key.` };
  return { pk };
}

// Shop owner's optional Stripe: connect/disconnect their own account, and create, check or cancel
// card checkouts (shareable link or in-app card form) for their invoices. The secret key never
// leaves the server; the shop and invoice always come from the signed-in session, never the browser.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin' && !user.business_name) return json({ error: 'Shop owner access required' }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'status');
    const db = base44.asServiceRole.entities;
    const tenant = String(user.email || '').toLowerCase();
    let account = await shopAccount(db, tenant);

    if (action === 'status') return json({ ...accountView(await refreshAccount(db, account)), available: await cardPaymentsAvailable() });

    if (action === 'connect') {
      const key = String(body.secret_key || '').trim();
      if (!SECRET_RE.test(key)) return json({ error: 'That is not a Stripe secret key. It starts with sk_live_ or sk_test_.' }, 400);
      const pub = checkPublishable(body.publishable_key, modeOf(key));
      if (pub.error) return json({ error: pub.error }, 400);
      const check = await stripeApi(key, 'GET', 'account');
      if (!check.ok) return json({ error: `Stripe did not accept this key: ${check.data?.error?.message || 'unknown error'}` }, 400);
      const a = check.data;
      const record = {
        shop_owner_email: tenant,
        shop_user_id: user.id,
        encrypted_secret_key: await sealSecret(key),
        key_last4: key.slice(-4),
        publishable_key: pub.pk,
        mode: modeOf(key),
        stripe_account_id: a.id || '',
        stripe_account_name: a.business_profile?.name || a.settings?.dashboard?.display_name || '',
        currency: String(a.default_currency || PAY_CURRENCY).toLowerCase(),
        charges_enabled: a.charges_enabled === true,
        connected_at: new Date().toISOString(),
      };
      const saved = account ? await db.ShopStripeAccount.update(account.id, record) : await db.ShopStripeAccount.create(record);
      return json(accountView(saved));
    }

    if (action === 'set_publishable_key') {
      if (!account) return json({ error: 'Connect your Stripe account first.' }, 400);
      const pub = checkPublishable(body.publishable_key, account.mode);
      if (pub.error || !pub.pk) return json({ error: pub.error || 'Paste your publishable key.' }, 400);
      return json(accountView(await db.ShopStripeAccount.update(account.id, { publishable_key: pub.pk })));
    }

    if (action === 'disconnect') {
      if (account) await db.ShopStripeAccount.delete(account.id);
      return json(accountView(null));
    }

    if (!LINK_ACTIONS.includes(action)) return json({ error: 'Unsupported action' }, 400);
    const invoiceId = String(body.invoice_id || '');
    const invoice = invoiceId ? await db.Invoice.get(invoiceId).catch((e) => (e.status === 404 ? null : Promise.reject(e))) : null;
    if (!invoice || !ownsRecord(invoice, tenant, user.id)) return json({ error: 'Invoice not found in this shop' }, 404);
    const inApp = body.in_app === true;
    if (action === 'create_link') {
      if (!account) return json({ error: 'Connect your Stripe account in Settings first.' }, 400);
      account = await refreshAccount(db, account);
      if (!account.charges_enabled) return json({ error: account.key_problem ? `Stripe: ${account.key_problem}` : "Stripe says your account can't take payments yet. Finish setting it up in Stripe." }, 400);
      if (inApp && !account.publishable_key) return json({ error: 'Add your Stripe publishable key in Settings to take card payments inside LBC Auto.' }, 400);
    }

    const secretKey = account ? await openSecret(account.encrypted_secret_key) : '';
    const activeLinks = () => db.StripeCheckoutLink.filter({ invoice_id: invoice.id, status: { $in: ['open', 'needs_review'] } }, '-created_date', 10);

    // Settle open checkouts first: record any payment Stripe confirmed, and close checkouts that are
    // being replaced, closed, or no longer match the balance, so a customer can never pay twice.
    // A checkout Stripe is still confirming ("processing") is never closed.
    const due = invoiceBalance(invoice);
    let paidNow = false;
    let processing = false;
    for (const link of await activeLinks()) {
      if (link.status !== 'open') continue;
      const close = action !== 'link_status' || Math.abs((Number(link.amount) || 0) - due) > 0.009;
      const next = secretKey
        ? await syncLink(db, secretKey, link, { close })
        : close ? await db.StripeCheckoutLink.update(link.id, { status: 'cancelled' }) : link;
      if (next.status === 'paid') paidNow = true;
      if (next.processing) processing = true;
    }

    let created = null;
    let clientSecret = '';
    if (action === 'cancel_link') {
      // Staff have handled any payment that needed review.
      for (const link of await activeLinks()) {
        if (link.status === 'needs_review') await db.StripeCheckoutLink.update(link.id, { status: 'cancelled' });
      }
    } else if (action === 'create_link') {
      if (processing) return json({ error: 'Stripe is still confirming a card payment for this invoice. Check again in a moment before charging again.' }, 409);
      const fresh = await db.Invoice.get(invoice.id);
      const amount = invoiceBalance(fresh);
      if (!(amount > 0) && !paidNow) return json({ error: 'This invoice has no balance due.' }, 400);
      if (amount > 0) {
        const token = crypto.randomUUID().replace(/-/g, '');
        const payUrl = `${appOrigin(req)}/PayInvoice?t=${token}`;
        const shopName = user.business_name || '';
        const attempt = (await db.StripeCheckoutLink.filter({ invoice_id: fresh.id }, '-created_date', 500)).length;
        const params = {
          mode: 'payment',
          'payment_method_types[0]': 'card',
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': PAY_CURRENCY,
          'line_items[0][price_data][unit_amount]': String(toMinor(amount)),
          'line_items[0][price_data][product_data][name]': [`Invoice ${fresh.invoice_number || ''}`.trim(), shopName].filter(Boolean).join(' · '),
          'metadata[invoice_id]': fresh.id,
          'metadata[shop]': tenant,
          'payment_intent_data[metadata][invoice_id]': fresh.id,
          'payment_intent_data[metadata][shop]': tenant,
          ...(inApp
            ? { ui_mode: 'embedded', redirect_on_completion: 'never' }
            : { success_url: `${payUrl}&paid=1`, cancel_url: `${payUrl}&cancelled=1` }),
        };
        const made = await stripeApi(secretKey, 'POST', 'checkout/sessions', params, checkoutIdempotencyKey(fresh.id, amount, attempt, inApp));
        if (!made.ok) return json({ error: `Stripe could not start the card payment: ${made.data?.error?.message || 'unknown error'}` }, 400);
        // A racing duplicate click got the same Stripe session back: reuse its record.
        created = (await db.StripeCheckoutLink.filter({ checkout_session_id: made.data.id }, '-created_date', 1))[0] || await db.StripeCheckoutLink.create({
          shop_owner_email: tenant,
          shop_user_id: user.id,
          shop_name: shopName,
          invoice_id: fresh.id,
          invoice_number: fresh.invoice_number || '',
          public_token: token,
          pay_url: inApp ? '' : payUrl,
          ui_mode: inApp ? 'embedded' : 'hosted',
          checkout_session_id: made.data.id,
          checkout_url: inApp ? '' : made.data.url,
          amount,
          currency: PAY_CURRENCY,
          status: 'open',
          expires_at: new Date((Number(made.data.expires_at) || Date.now() / 1000 + 86400) * 1000).toISOString(),
        });
        // Only the signed-in owner receives this one-session secret; it is never stored.
        if (inApp) clientSecret = made.data.client_secret || '';
      }
    }

    const latest = created || (await activeLinks())[0] || null;
    return json({
      ...accountView(account),
      paid_now: paidNow,
      processing,
      link: linkView(latest),
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    });
  } catch (error) {
    return json({ error: error?.message || 'Card payment action failed' }, error instanceof LeaseBusyError ? 409 : 500);
  }
}