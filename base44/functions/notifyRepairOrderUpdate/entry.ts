import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { event, data, old_data } = payload;

        if (event.type !== 'update' || !data || !old_data) {
            return Response.json({ success: true, message: 'No notification needed' });
        }
        if (data.status === old_data.status) {
            return Response.json({ success: true, message: 'Status unchanged' });
        }

        // Get owner preferences
        const users = await base44.asServiceRole.entities.User.list();
        const owner = users[0];
        const smsEnabled = owner?.notif_sms_repair_status !== false;
        const emailEnabled = owner?.notif_email_repair_status === true;

        if (!smsEnabled && !emailEnabled) {
            return Response.json({ success: true, message: 'Notifications disabled by owner' });
        }

        const customer = await base44.asServiceRole.entities.Customer.get(data.customer_id);
        if (!customer?.phone && !customer?.email) {
            return Response.json({ success: false, message: 'No customer contact info' });
        }

        const vehicleInfo = data.vehicle_info || 'your vehicle';
        const orderNum = data.order_number || 'your order';
        const bizName = owner?.business_name || 'LBC Auto Services';

        let message = '';
        switch (data.status) {
            case 'in_progress':
                message = `${bizName}: Your ${vehicleInfo} (${orderNum}) is now being worked on by ${data.mechanic_name || 'our team'}.`;
                break;
            case 'waiting_for_parts':
                message = `${bizName}: ${orderNum} is waiting for parts. We'll notify you once work resumes.`;
                break;
            case 'completed':
                message = `${bizName}: Great news! ${orderNum} for your ${vehicleInfo} is completed and ready for pickup!`;
                break;
            case 'delivered':
                message = `${bizName}: Thank you! ${orderNum} has been delivered. Drive safe!`;
                break;
            default:
                message = `${bizName}: Status update for ${orderNum} - now: ${data.status}.`;
        }

        if (smsEnabled && customer?.phone) {
            await base44.asServiceRole.functions.invoke('sendSMS', { phone: customer.phone, message });
        }

        if (emailEnabled && customer?.email) {
            await base44.asServiceRole.integrations.Core.SendEmail({
                to: customer.email,
                subject: `${bizName} - Repair Order Update`,
                body: message
            });
        }

        return Response.json({ success: true, message: 'Notification sent' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});