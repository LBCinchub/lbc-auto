import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        // This function is triggered by entity automation
        const { event, data, old_data } = payload;

        if (event.type !== 'update' || !data || !old_data) {
            return Response.json({ success: true, message: 'No notification needed' });
        }

        // Check if status changed
        if (data.status === old_data.status) {
            return Response.json({ success: true, message: 'Status unchanged' });
        }

        // Get customer phone
        const customer = await base44.asServiceRole.entities.Customer.get(data.customer_id);
        
        if (!customer?.data?.phone) {
            return Response.json({ success: false, message: 'Customer phone not found' });
        }

        // Build message based on new status
        let message = '';
        const vehicleInfo = data.vehicle_info || 'your vehicle';
        const orderNum = data.order_number || 'your order';

        switch (data.status) {
            case 'in_progress':
                message = `LBC Auto Update: Your ${vehicleInfo} (${orderNum}) is now being worked on by ${data.mechanic_name || 'our team'}.`;
                break;
            case 'waiting_for_parts':
                message = `LBC Auto Update: ${orderNum} is waiting for parts. We'll notify you once work resumes.`;
                break;
            case 'completed':
                message = `LBC Auto Update: Great news! ${orderNum} for your ${vehicleInfo} is completed and ready for pickup.`;
                break;
            case 'delivered':
                message = `LBC Auto: Thank you for choosing us! ${orderNum} has been delivered. Drive safe!`;
                break;
            default:
                message = `LBC Auto Update: Status changed for ${orderNum} - ${data.status}`;
        }

        await base44.asServiceRole.functions.invoke('sendSMS', {
            phone: customer.data.phone,
            message: message
        });

        return Response.json({ success: true, message: 'SMS sent' });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});