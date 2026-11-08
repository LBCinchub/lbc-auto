import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { LeaseBusyError } from '../../shared/recordLease.ts';
import { sealSecret, openSecret, stripeApi, shopAccount, accountView, linkView, ownsRecord, invoiceBalance, syncLink } from '../../shared/shopStripe.ts';

const LINK_ACTIONS = ['link_status', 'create_link', 'cancel_link'];
const json = (data, status = 200) => Response.json(data, { status });
// Payment links point back to the domain the shop is using (custom domain, platform domain or preview).
const appOrigin = (req) => {
  try { return new URL(req.headers.get('origin') || req.headers.get('x-base44-app-url') || '').origin; } catch { return 'https://lbchub.tech'; }
};

// Shop owner's optional Stripe: connect/disconnect their own key, and create, check or cancel
// card payment links for their invoices. The key never leaves the server.
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
    const account = await shopAccount(db, tenant);

    if (action === 'status') return json(accountView(account));

    if (action === 'connect') {
      const key = String(body.secret_key || '').trim();
      if (!/^(sk|rk)_(live|test)_\w{10,}$/.test(key)) return json({ error: 'That is not a Stripe secret key. It starts with sk_live_ or sk_test_.' }, 400);
      const check = await stripeApi(key, 'GET', 'account');
      if (!check.ok) return json({ error: `Stripe did not accept this key: ${check.data?.error?.message || 'unknown error'}` }, 400);
      const a = check.data;
      const record = {
        shop_owner_email: tenant,
        shop_user_id: user.id,
        encrypted_secret_key: await sealSecret(key),
        key_last4: key.slice(-4),
        mode: key.includes('_live_') ? 'live' : 'test',
        stripe_account_id: a.id || '',
        stripe_account_name: a.business_profile?.name || a.settings?.dashboard?.display_name || '',
        currency: String(a.default_currency || 'cad').toLowerCase(),
        charges_enabled: a.charges_enabled !== false,
        connected_at: new Date().toISOString(),
      };
      const saved = account ? await db.ShopStripeAccount.update(account.id, record) : await db.ShopStripeAccount.create(record);
      return json(accountView(saved));
    }

    if (action === 'disconnect') {
      if (account) await db.ShopStripeAccount.delete(account.id);
      return json(accountView(null));
    }

    if (!LINK_ACTIONS.includes(action)) return json({ error: 'Unsupported action' }, 400);
    const invoiceId = String(body.invoice_id || '');
    const invoice = invoiceId ? await db.Invoice.get(invoiceId).catch((e) => (e.status === 404 ? null : Promise.reject(e))) : null;
    if (!invoice || !ownsRecord(invoice, tenant, user.id)) return json({ error: 'Invoice not found in this shop' }, 404);
    if (action === 'create_link' && !account) return json({ error: 'Connect your Stripe account in Settings first.' }, 400);

    const secretKey = account ? await openSecret(account.encrypted_secret_key) : '';
    const activeLinks = () => db.StripeCheckoutLink.filter({ invoice_id: invoice.id, status: { $in: ['open', 'needs_review'] } }, '-created_date', 10);

    // Settle open links first: record any payment that came in, and close links that are being
    // replaced, cancelled, or no longer match the balance, so a customer can never pay twice.
    const due = invoiceBalance(invoice);
    let paidNow = false;
    for (const link of await activeLinks()) {
      if (link.status !== 'open') continue;
      const close = action !== 'link_status' || Math.abs((Number(link.amount) || 0) - due) > 0.009;
      const next = secretKey
        ? await syncLink(db, secretKey, link, { close })
        : close ? await db.StripeCheckoutLink.update(link.id, { status: 'cancelled' }) : link;
      if (next.status === 'paid') paidNow = true;
    }

    let created = null;
    if (action === 'cancel_link') {
      // Staff have handled any payment that needed review.
      for (const link of await activeLinks()) {
        if (link.status === 'needs_review') await db.StripeCheckoutLink.update(link.id, { status: 'cancelled' });
      }
    } else if (action === 'create_link') {
      const fresh = await db.Invoice.get(invoice.id);
      const amount = invoiceBalance(fresh);
      if (!(amount > 0) && !paidNow) return json({ error: 'This invoice has no balance due.' }, 400);
      if (amount > 0) {
        const token = crypto.randomUUID().replace(/-/g, '');
        const payUrl = `${appOrigin(req)}/PayInvoice?t=${token}`;
        const shopName = user.business_name || '';
        const made = await stripeApi(secretKey, 'POST', 'checkout/sessions', {
          mode: 'payment',
          'payment_method_types[0]': 'card',
          'line_items[0][quantity]': '1',
          'line_items[0][price_data][currency]': account.currency || 'cad',
          'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
          'line_items[0][price_data][product_data][name]': [`Invoice ${fresh.invoice_number || ''}`.trim(), shopName].filter(Boolean).join(' · '),
          success_url: `${payUrl}&paid=1`,
          cancel_url: `${payUrl}&cancelled=1`,
          'metadata[invoice_id]': fresh.id,
          'metadata[shop]': tenant,
          'payment_intent_data[metadata][invoice_id]': fresh.id,
        });
        if (!made.ok) return json({ error: `Stripe could not create the payment link: ${made.data?.error?.message || 'unknown error'}` }, 400);
        created = await db.StripeCheckoutLink.create({
          shop_owner_email: tenant,
          shop_user_id: user.id,
          shop_name: shopName,
          invoice_id: fresh.id,
          invoice_number: fresh.invoice_number || '',
          public_token: token,
          pay_url: payUrl,
          checkout_session_id: made.data.id,
          checkout_url: made.data.url,
          amount,
          currency: account.currency || 'cad',
          status: 'open',
          expires_at: new Date((Number(made.data.expires_at) || Date.now() / 1000 + 86400) * 1000).toISOString(),
        });
      }
    }

    const latest = created || (await activeLinks())[0] || null;
    return json({ connected: !!account, paid_now: paidNow, link: linkView(latest) });
  } catch (error) {
    return json({ error: error?.message || 'Card payment action failed' }, error instanceof LeaseBusyError ? 409 : 500);
  }
}