import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await req.json();
        const { invoice_id, phone, app_url } = body;

        console.log('sendInvoiceAuthSMS called:', { invoice_id, phone: phone ? 'provided' : 'missing', app_url });

        if (!invoice_id || !phone) {
            return Response.json({ error: 'invoice_id and phone are required', received: { invoice_id, phone } }, { status: 400 });
        }

        // Normalize phone to E.164 format
        const digits = String(phone).replace(/\D/g, '');
        const normalized = digits.startsWith('1') && digits.length === 11 ? `+${digits}` : `+1${digits}`;
        console.log('Normalized phone:', normalized);

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
        formData.append('To', normalized);
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
        console.log('Twilio response:', response.status, JSON.stringify(data));

        if (!response.ok) {
            return Response.json({ error: 'Failed to send SMS', details: data }, { status: 400 });
        }

        return Response.json({ success: true, messageSid: data.sid });
    } catch (error) {
        console.error('sendInvoiceAuthSMS error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});