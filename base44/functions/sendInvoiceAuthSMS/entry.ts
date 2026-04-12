import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoice_id, phone, app_url } = await req.json();
    if (!invoice_id || !phone) return Response.json({ error: 'invoice_id and phone are required' }, { status: 400 });

    // Generate a random token
    const token = crypto.randomUUID().replace(/-/g, '');

    // Save token + set auth_status to pending
    await base44.asServiceRole.entities.Invoice.update(invoice_id, {
        auth_token: token,
        auth_status: "pending"
    });

    const signUrl = `${app_url}/InvoiceSign?token=${token}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const formData = new URLSearchParams();
    formData.append('To', phone);
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('Body', `LBC AUTO - Please review and approve your invoice by signing here:\n${signUrl}`);

    const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
    });

    const data = await response.json();
    if (!response.ok) return Response.json({ error: 'Failed to send SMS', details: data }, { status: response.status });

    return Response.json({ success: true, messageSid: data.sid });
});