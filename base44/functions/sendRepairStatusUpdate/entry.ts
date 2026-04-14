import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!event || !data) {
      return Response.json({ error: 'Missing event or data' }, { status: 400 });
    }

    const repairOrder = data;
    
    // Get customer phone number
    const customer = await base44.asServiceRole.entities.Customer.get(repairOrder.customer_id);
    if (!customer?.phone) {
      return Response.json({ error: 'Customer has no phone number' }, { status: 400 });
    }

    // Determine message based on status
    let message = '';
    if (repairOrder.status === 'completed') {
      message = `Hi ${customer.full_name}, your vehicle repair (Order #${repairOrder.order_number}) is complete and ready for pickup!`;
    } else if (repairOrder.status === 'waiting_for_parts') {
      message = `Hi ${customer.full_name}, we're waiting for parts for your repair (Order #${repairOrder.order_number}). We'll update you when they arrive.`;
    } else {
      return Response.json({ error: 'Status not monitored' }, { status: 400 });
    }

    // Send SMS via Twilio
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    const auth = btoa(`${accountSid}:${authToken}`);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: customer.phone,
        Body: message,
      }).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Twilio error: ${error}` }, { status: 500 });
    }

    const result = await response.json();
    return Response.json({ success: true, messageSid: result.sid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});