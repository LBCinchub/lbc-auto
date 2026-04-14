import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { event, data, old_data } = payload;

        // Get owner preferences
        const users = await base44.asServiceRole.entities.User.list();
        const owner = users[0];
        const smsEnabled = owner?.notif_sms_invoice_ready !== false;
        const emailEnabled = owner?.notif_email_invoice_ready === true;
        const bizName = owner?.business_name || 'LBC Auto Services';

        if (!smsEnabled && !emailEnabled) {
            return Response.json({ success: true, message: 'Invoice notifications disabled' });
        }

        const customer = await base44.asServiceRole.entities.Customer.get(data.customer_id);
        const cust = customer?.data || customer;

        if (!cust?.phone && !cust?.email) {
            return Response.json({ success: false, message: 'No customer contact info' });
        }

        const vehicleInfo = data.vehicle_info || 'your vehicle';
        const invoiceNum = data.invoice_number || 'your invoice';
        let message = '';

        if (event.type === 'create') {
            message = `${bizName}: Your ${vehicleInfo} is ready for pickup! Invoice ${invoiceNum} total: $${(data.total || 0).toFixed(2)}.`;
        } else if (event.type === 'update' && old_data && data.status === 'paid' && old_data.status !== 'paid') {
            message = `${bizName}: Payment received for invoice ${invoiceNum} ($${(data.total || 0).toFixed(2)}). Thank you for your business!`;
        } else {
            return Response.json({ success: true, message: 'No notification needed' });
        }

        if (smsEnabled && cust?.phone) {
            await base44.asServiceRole.functions.invoke('sendSMS', { phone: cust.phone, message });
        }
        if (emailEnabled && cust?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
                to: cust.email,
                subject: `${bizName} - Invoice Update`,
                body: message
            });
        }

        return Response.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});