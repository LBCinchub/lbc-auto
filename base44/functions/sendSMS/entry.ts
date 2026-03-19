import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { phone, message } = await req.json();

        if (!phone || !message) {
            return Response.json({ error: 'Phone and message are required' }, { status: 400 });
        }

        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', phone);
        formData.append('From', TWILIO_PHONE_NUMBER);
        formData.append('Body', message);

        const response = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });

        const data = await response.json();

        if (!response.ok) {
            return Response.json({ error: 'Failed to send SMS', details: data }, { status: response.status });
        }

        return Response.json({ success: true, messageSid: data.sid });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});