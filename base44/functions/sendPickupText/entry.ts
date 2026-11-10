import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { preparePickup, sendPickup } from '../../shared/pickupText.ts';
import { textStatus } from '../../shared/documentTextDelivery.ts';
import { checkSmsSender, sendTwilioTextMessage, fetchTwilioMessage } from '../../shared/twilioSms.ts';

const json = (data, status = 200) => Response.json(data, { status });
const appOrigin = (req) => {
  try { return new URL(req.headers.get('x-base44-app-url') || '').origin; } catch { return 'https://lbc-auto-flow.base44.app'; }
};

// "Text Ready For Pickup": staff texts ONE repair order's own customer that the vehicle is ready.
// On demand only (no automation calls this). Actions: prepare (read-only), send (explicit), status.
// Shop, role, order, customer and phone come from the verified session; the body is untrusted.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const db = base44.asServiceRole.entities;
    const twilio = { smsCheck: checkSmsSender, sendSms: sendTwilioTextMessage, fetchMessage: fetchTwilioMessage };
    const deps = { db, user, twilio, callbackUrl: `${appOrigin(req)}/functions/twilioMessageStatus` };

    if (action === 'prepare') {
      const r = await preparePickup(deps, body);
      if (r.error) return json({ error: r.error, code: r.code || '' }, r.status);
      const sender = await checkSmsSender();
      const { status, ...view } = r;
      return json({ ...view, sender_ready: sender.ok, sender_problem: sender.ok ? '' : sender.reason });
    }
    if (action === 'status') {
      // Same session gate as prepare/send before any delivery row is read.
      const gate = await preparePickup(deps, body);
      if (gate.error) return json({ error: gate.error, code: gate.code || '' }, gate.status);
      const r = await textStatus({ db, tenant: String(user.email).toLowerCase(), twilio }, body.group_key);
      return json(r.error ? { error: r.error } : { group: r.group, note: r.note || '' }, r.status);
    }
    if (action !== 'send') return json({ error: 'Unsupported action' }, 400);
    const r = await sendPickup(deps, body);
    return json(r.error ? { error: r.error, code: r.code || '' } : { group: r.group, repeated: !!r.repeated }, r.status);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}