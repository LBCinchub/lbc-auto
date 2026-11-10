import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { prepareText, sendDocumentText, textStatus } from '../../shared/documentTextDelivery.ts';
import { checkSmsSender, sendTwilioTextMessage, fetchTwilioMessage } from '../../shared/twilioSms.ts';

const json = (data, status = 200) => Response.json(data, { status });
const appOrigin = (req) => {
  try { return new URL(req.headers.get('x-base44-app-url') || '').origin; } catch { return 'https://lbc-auto-flow.base44.app'; }
};

// "Send As Text": shop staff texts the readable details of one saved estimate/invoice to that
// document's own customer. No link, no attachment. Actions: prepare (read-only), send (explicit), status.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin' && !user.business_name) return json({ error: 'Shop owner access required' }, 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const db = base44.asServiceRole.entities;
    const tenant = String(user.email || '').toLowerCase();
    const twilio = { smsCheck: checkSmsSender, sendSms: sendTwilioTextMessage, fetchMessage: fetchTwilioMessage };

    if (action === 'status') {
      const r = await textStatus({ db, tenant, twilio }, body.group_key);
      return json(r.error ? { error: r.error } : { group: r.group, note: r.note || '' }, r.status);
    }
    // Currency code only when the shop's own connected Stripe account states it; otherwise just "$" like the printed document.
    const [stripe] = (await db.ShopStripeAccount.filter({ shop_owner_email: tenant }, '-created_date', 1)) || [];
    const currency = String(stripe?.currency || '').toUpperCase();
    const deps = { db, tenant, user, twilio, currency, callbackUrl: `${appOrigin(req)}/functions/twilioMessageStatus` };

    if (action === 'prepare') {
      const r = await prepareText(deps, body);
      if (r.error) return json({ error: r.error }, r.status);
      const sender = await checkSmsSender();
      const { status, ...view } = r;
      return json({ ...view, sender_ready: sender.ok, sender_problem: sender.ok ? '' : sender.reason });
    }
    if (action !== 'send') return json({ error: 'Unsupported action' }, 400);
    const r = await sendDocumentText(deps, body);
    return json(r.error ? { error: r.error, code: r.code || '', group: r.group || null } : { group: r.group, repeated: !!r.repeated }, r.status);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}