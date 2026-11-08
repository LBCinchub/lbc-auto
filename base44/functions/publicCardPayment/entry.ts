import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { LeaseBusyError } from '../../shared/recordLease.ts';
import { openSecret, shopAccount, syncLink } from '../../shared/shopStripe.ts';

// Public: backs the customer's card payment link page. The long random token is the only
// credential, and a payment is always verified with the shop's own Stripe before it is recorded.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { token } = await req.json().catch(() => ({}));
    const code = String(token || '');
    if (!/^[a-f0-9]{32}$/.test(code)) return Response.json({ error: 'This payment link is not valid.' }, { status: 400 });
    const db = base44.asServiceRole.entities;
    let link = (await db.StripeCheckoutLink.filter({ public_token: code }, '-created_date', 1))[0];
    if (!link) return Response.json({ error: 'This payment link is not valid.' }, { status: 404 });
    const account = await shopAccount(db, link.shop_owner_email);
    if (link.status === 'open' && account) link = await syncLink(db, await openSecret(account.encrypted_secret_key), link);
    const paid = link.status === 'paid' || link.status === 'needs_review';
    const state = paid ? 'paid' : link.status === 'open' && account ? 'pay' : 'closed';
    return Response.json({
      state,
      url: state === 'pay' ? link.checkout_url : '',
      amount: paid ? (link.paid_amount ?? link.amount) : link.amount,
      currency: String(link.currency || '').toUpperCase(),
      invoice_number: link.invoice_number || '',
      shop_name: link.shop_name || '',
      paid_at: link.paid_at || '',
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Could not check this payment' }, { status: error instanceof LeaseBusyError ? 409 : 500 });
  }
}