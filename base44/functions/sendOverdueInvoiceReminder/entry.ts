import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // Get owner preferences
        const users = await base44.asServiceRole.entities.User.list();
        const owner = users[0];
        const smsEnabled = owner?.notif_sms_overdue_invoice !== false;
        const emailEnabled = owner?.notif_email_overdue_invoice === true;
        const bizName = owner?.business_name || 'LBC Auto Services';

        if (!smsEnabled && !emailEnabled) {
            return Response.json({ success: true, message: 'Overdue invoice reminders disabled' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Get all unpaid/partial invoices with a due_date in the past
        const invoices = await base44.asServiceRole.entities.Invoice.filter({
            status: { $in: ['unpaid', 'partial'] }
        });

        const overdueInvoices = invoices.filter(inv => {
            const inv_data = inv.data || inv;
            return inv_data.due_date && inv_data.due_date < today;
        });

        let sentCount = 0;
        const errors = [];

        for (const inv of overdueInvoices) {
            try {
                const invData = inv.data || inv;
                const customer = await base44.asServiceRole.entities.Customer.get(invData.customer_id);
                const cust = customer?.data || customer;

                const balance = invData.balance_due ?? invData.total ?? 0;
                const message = `${bizName}: Reminder — Invoice ${invData.invoice_number || ''} for $${balance.toFixed(2)} was due on ${invData.due_date} and is overdue. Please contact us to settle your balance.`;

                if (smsEnabled && cust?.phone) {
                    await base44.asServiceRole.functions.invoke('sendSMS', { phone: cust.phone, message });
                    sentCount++;
                }
                if (emailEnabled && cust?.email) {
                    await base44.asServiceRole.integrations.Core.SendEmail({
                        to: cust.email,
                        subject: `${bizName} - Overdue Invoice`,
                        body: message
                    });
                    sentCount++;
                }
            } catch (error) {
                errors.push({ invoiceId: inv.id, error: error.message });
            }
        }

        return Response.json({ success: true, sentCount, totalOverdue: overdueInvoices.length, errors: errors.length > 0 ? errors : undefined });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});