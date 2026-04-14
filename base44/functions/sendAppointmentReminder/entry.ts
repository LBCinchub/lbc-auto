import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get owner preferences
        const users = await base44.asServiceRole.entities.User.list();
        const owner = users[0];
        const smsEnabled = owner?.notif_sms_appointment_reminder !== false;
        const emailEnabled = owner?.notif_email_appointment_reminder === true;
        const bizName = owner?.business_name || 'LBC Auto Services';

        if (!smsEnabled && !emailEnabled) {
            return Response.json({ success: true, message: 'Appointment reminders disabled' });
        }

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
                const appt = appointment.data || appointment;
                const customer = await base44.asServiceRole.entities.Customer.get(appt.customer_id);
                const cust = customer?.data || customer;

                const message = `${bizName} Reminder: You have an appointment tomorrow (${appt.date}) at ${appt.time_slot} for ${appt.service_type} on your ${appt.vehicle_info}. See you soon!`;

                if (smsEnabled && cust?.phone) {
                    await base44.asServiceRole.functions.invoke('sendSMS', { phone: cust.phone, message });
                    sentCount++;
                }
                if (emailEnabled && cust?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: cust.email,
                        subject: `${bizName} - Appointment Reminder`,
                        body: message
                    });
                    sentCount++;
                }
            } catch (error) {
                errors.push({ appointmentId: appointment.id, error: error.message });
            }
        }

        return Response.json({ success: true, sentCount, totalAppointments: appointments.length, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});