import { createClientFromRequest } from 'npm:@base44/sdk@0.8.57';
import { verifyTwilioSignature, applyProviderStatus } from '../../shared/documentDelivery.ts';
import { twilioAccountSid, twilioAuthToken } from '../../shared/twilioSms.ts';

// Twilio status callback for PDF texts. Only requests carrying a valid X-Twilio-Signature for the
// exact callback URL we gave Twilio, from our own account, for a message we sent, can change a status.
export default async function(req) {
  try {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const base44 = createClientFromRequest(req);
    const params = Object.fromEntries(new URLSearchParams(await req.text()));
    const sid = String(params.MessageSid || '');
    if (!/^(SM|MM)[0-9a-f]{32}$/i.test(sid) || params.AccountSid !== twilioAccountSid()) return new Response('Forbidden', { status: 403 });
    const db = base44.asServiceRole.entities;
    const [delivery] = await db.DocumentDelivery.filter({ message_sid: sid }, '-created_date', 1);
    if (!delivery?.callback_url) return new Response('Forbidden', { status: 403 });
    const ok = await verifyTwilioSignature(twilioAuthToken(), delivery.callback_url, params, req.headers.get('x-twilio-signature'));
    if (!ok) return new Response('Forbidden', { status: 403 });
    await applyProviderStatus(db, delivery, { status: params.MessageStatus, errorCode: params.ErrorCode, errorMessage: '' });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}