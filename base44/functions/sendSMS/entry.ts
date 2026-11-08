import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { sendTwilioSms } from '../../shared/twilioSms.ts';

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, message } = await req.json().catch(() => ({}));
    if (!phone || !message) {
      return Response.json({ error: 'Phone and message are required' }, { status: 400 });
    }

    const result = await sendTwilioSms(phone, message);
    if (!result.ok) {
      return Response.json({ error: 'Failed to send SMS', details: result.data }, { status: 502 });
    }
    return Response.json({ success: true, messageSid: result.data.sid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}