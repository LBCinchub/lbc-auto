import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { openSecret, stripeApi, shopAccount, ownsRecord } from '../../shared/shopStripe.ts';
import { zoneOrUtc, dayFormatter, dayKey, lastDays, startOfDay } from './calendar.ts';

const json = (data, status = 200) => Response.json(data, { status });
const MAX_PAGES = 20; // up to 2,000 payments in the 30-day window
const cents = (v) => Math.round(Number(v) || 0);
const dollars = (c) => c / 100;
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);

async function stripeGet(key, path) {
  const res = await stripeApi(key, 'GET', path);
  if (!res.ok) throw new Error(`Stripe: ${res.data?.error?.message || 'request failed'}`);
  return res.data;
}

async function chargesSince(key, since) {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ limit: '100', 'created[gte]': String(since) });
    if (all.length) q.set('starting_after', all[all.length - 1].id);
    const res = await stripeGet(key, `charges?${q}`);
    all.push(...(res.data || []));
    if (!res.has_more) return { charges: all, truncated: false };
  }
  return { charges: all, truncated: true };
}

// Invoice payments link to the invoice in the app (only this shop's invoices); others to Stripe.
async function recentPayments(db, charges, { tenant, userId, mode }) {
  const ids = [...new Set(charges.map((c) => c.metadata?.invoice_id).filter(Boolean))];
  const invoices = ids.length ? await db.Invoice.filter({ id: { $in: ids } }, '-created_date', ids.length) : [];
  const mine = new Map(invoices.filter((inv) => ownsRecord(inv, tenant, userId)).map((inv) => [inv.id, inv]));
  return charges.map((c) => {
    const inv = mine.get(c.metadata?.invoice_id);
    const card = c.payment_method_details?.card;
    return {
      id: c.id,
      name: inv?.customer_name || c.billing_details?.name || 'Card payment',
      reference: inv ? (inv.invoice_number || 'Invoice') : card ? `${cap(card.brand)} •••• ${card.last4}` : '',
      amount: dollars(cents(c.amount_captured)),
      refunded: dollars(cents(c.amount_refunded)),
      currency: String(c.currency || '').toUpperCase(),
      created: new Date(c.created * 1000).toISOString(),
      invoice_id: inv ? inv.id : '',
      stripe_url: `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}payments/${c.payment_intent || c.id}`,
    };
  });
}

// The shop's own Stripe numbers for the Analytics page: 30 calendar days of card revenue in the
// shop's time zone, money not yet paid out to the bank, and the latest successful payments.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin' && !user.business_name) return json({ error: 'Shop owner access required' }, 403);
    const body = await req.json().catch(() => ({}));
    const db = base44.asServiceRole.entities;
    const tenant = String(user.email || '').toLowerCase();
    const account = await shopAccount(db, tenant);
    if (!account) return json({ connected: false });

    // The shop's saved booking time zone wins; otherwise the owner's device time zone.
    const [alias] = await db.ShopBookingAlias.filter({ shop_owner_email: tenant, is_active: true }, '-created_date', 1);
    const timeZone = zoneOrUtc(alias?.timezone || body.time_zone);
    const fmt = dayFormatter(timeZone);
    const keys = lastDays(30, fmt);
    const since = Math.floor(startOfDay(keys[0], fmt) / 1000);
    const key = await openSecret(account.encrypted_secret_key);
    const currency = String(account.currency || 'cad').toLowerCase();

    const [{ charges, truncated }, balance, payoutList] = await Promise.all([
      chargesSince(key, since), stripeGet(key, 'balance'), stripeGet(key, 'payouts?limit=20'),
    ]);

    // Revenue per calendar day = captured card payments minus their refunds.
    const byDay = new Map(keys.map((k) => [k, { cents: 0, count: 0 }]));
    const paid = charges.filter((c) => c.status === 'succeeded' && c.captured);
    let otherCurrency = 0;
    for (const c of paid) {
      if (c.currency !== currency) { otherCurrency++; continue; }
      const day = byDay.get(dayKey(c.created * 1000, fmt));
      if (!day) continue;
      day.cents += cents(c.amount_captured) - cents(c.amount_refunded);
      day.count += 1;
    }

    // Not yet in the bank = Stripe balance (available + incoming) + payouts still on the way.
    const inCurrency = (rows) => (rows || []).filter((r) => r.currency === currency).reduce((s, r) => s + cents(r.amount), 0);
    const moving = (payoutList.data || []).filter((p) => p.currency === currency && ['pending', 'in_transit'].includes(p.status));
    const pendingCents = inCurrency(balance.available) + inCurrency(balance.pending) + moving.reduce((s, p) => s + cents(p.amount), 0);
    const nextArrival = moving.length ? Math.min(...moving.map((p) => p.arrival_date)) : null;

    return json({
      connected: true,
      mode: account.mode,
      currency: currency.toUpperCase(),
      time_zone: timeZone,
      updated_at: new Date().toISOString(),
      days: keys.map((k) => ({ date: k, revenue: dollars(byDay.get(k).cents), count: byDay.get(k).count })),
      payouts: { total: dollars(pendingCents), next_arrival: nextArrival ? dayKey(nextArrival * 1000, fmt) : null },
      recent: await recentPayments(db, paid.slice(0, 5), { tenant, userId: user.id, mode: account.mode }),
      truncated,
      other_currency: otherCurrency,
    });
  } catch (error) {
    return json({ error: error?.message || 'Could not load Stripe data' }, 500);
  }
}