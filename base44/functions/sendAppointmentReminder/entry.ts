import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get all confirmed appointments for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowDate = tomorrow.toISOString().split('T')[0];

        const appointments = await base44.asServiceRole.entities.Appointment.filter({
            date: tomorrowDate,
            status: { $in: ['scheduled', 'confirmed'] }
        });

        let sentCount = 0;
        const errors = [];

        for (const appointment of appointments) {
            try {
                // Get customer phone
                const customer = await base44.asServiceRole.entities.Customer.get(appointment.data.customer_id);
                
                if (customer?.data?.phone) {
                    const message = `LBC Auto Reminder: You have an appointment tomorrow (${appointment.data.date}) at ${appointment.data.time_slot} for ${appointment.data.service_type} on your ${appointment.data.vehicle_info}. See you soon!`;
                    
                    await base44.asServiceRole.functions.invoke('sendSMS', {
                        phone: customer.data.phone,
                        message: message
                    });
                    
                    sentCount++;
                }
            } catch (error) {
                errors.push({ appointmentId: appointment.id, error: error.message });
            }
        }

        return Response.json({ 
            success: true, 
            sentCount, 
            totalAppointments: appointments.length,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});