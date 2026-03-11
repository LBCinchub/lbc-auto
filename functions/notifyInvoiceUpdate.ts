import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();

        const { event, data, old_data } = payload;

        // Get customer phone
        const customer = await base44.asServiceRole.entities.Customer.get(data.customer_id);
        
        if (!customer?.data?.phone) {
            return Response.json({ success: false, message: 'Customer phone not found' });
        }

        let message = '';
        const vehicleInfo = data.vehicle_info || 'your vehicle';
        const invoiceNum = data.invoice_number || 'your invoice';

        // New invoice created (vehicle ready for pickup)
        if (event.type === 'create') {
            message = `LBC Auto: Great news! Your ${vehicleInfo} is ready for pickup. Invoice ${invoiceNum} total: $${data.total.toFixed(2)}. We look forward to seeing you!`;
        }
        // Invoice status changed to paid
        else if (event.type === 'update' && old_data && data.status === 'paid' && old_data.status !== 'paid') {
            message = `LBC Auto: Payment received for invoice ${invoiceNum} ($${data.total.toFixed(2)}). Thank you for your business! Drive safe.`;
        }
        else {
            return Response.json({ success: true, message: 'No notification needed' });
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