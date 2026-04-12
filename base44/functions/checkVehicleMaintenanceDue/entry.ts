import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Allow scheduled task execution (no user required)
    if (!user) {
      console.log("Running as scheduled task");
    }

    // Fetch all vehicles
    const vehicles = await base44.asServiceRole.entities.Vehicle.list('', 1000);
    const customers = await base44.asServiceRole.entities.Customer.list('', 1000);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let remindersSent = 0;

    for (const vehicle of vehicles) {
      // Skip if no phone number or service intervals not configured
      if (!vehicle.phone) {
        const customer = customers.find(c => c.id === vehicle.customer_id);
        if (!customer || !customer.phone) continue;
        vehicle.phone = customer.phone;
      }

      if (!vehicle.service_interval_miles && !vehicle.service_interval_days) continue;

      let shouldRemind = false;
      let reason = "";

      // Check mileage-based maintenance
      if (vehicle.service_interval_miles && vehicle.last_service_mileage !== undefined) {
        const milesSinceService = (vehicle.mileage || 0) - vehicle.last_service_mileage;
        if (milesSinceService >= vehicle.service_interval_miles) {
          shouldRemind = true;
          reason = `${Math.round(milesSinceService)} miles since last service (due every ${vehicle.service_interval_miles} miles)`;
        }
      }

      // Check date-based maintenance
      if (!shouldRemind && vehicle.service_interval_days && vehicle.last_service_date) {
        const lastService = new Date(vehicle.last_service_date);
        const daysSinceService = Math.floor((today - lastService) / (1000 * 60 * 60 * 24));
        if (daysSinceService >= vehicle.service_interval_days) {
          shouldRemind = true;
          reason = `${daysSinceService} days since last service (due every ${vehicle.service_interval_days} days)`;
        }
      }

      // Send reminder if due and not already sent today
      if (shouldRemind && vehicle.reminder_sent_date !== todayStr) {
        const message = `Hi ${vehicle.customer_name || 'there'}! Your ${vehicle.year} ${vehicle.make} ${vehicle.model} is due for maintenance. ${reason}. Please schedule a service soon. - LBC Auto`;

        // Send SMS via Twilio
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

        if (!accountSid || !authToken || !fromPhone) {
          console.error("Twilio credentials not configured");
          continue;
        }

        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: fromPhone,
            To: vehicle.phone,
            Body: message,
          }),
        });

        if (response.ok) {
          // Mark reminder as sent
          await base44.asServiceRole.entities.Vehicle.update(vehicle.id, {
            reminder_sent_date: todayStr,
          });
          remindersSent++;
          console.log(`Reminder sent to ${vehicle.phone} for ${vehicle.year} ${vehicle.make} ${vehicle.model}`);
        } else {
          console.error(`Failed to send SMS to ${vehicle.phone}:`, await response.text());
        }
      }
    }

    return Response.json({ success: true, remindersSent, totalVehicles: vehicles.length });
  } catch (error) {
    console.error('Error in checkVehicleMaintenanceDue:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});