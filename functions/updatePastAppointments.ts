import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const appointments = await base44.asServiceRole.entities.Appointment.filter({
      status: { $in: ['scheduled', 'confirmed'] }
    });

    let updatedCount = 0;

    for (const apt of appointments) {
      const aptDate = apt.date;
      const aptTime = apt.time_slot?.split('-')[0]?.trim() || '00:00';
      
      if (aptDate < today || (aptDate === today && aptTime < currentTime)) {
        await base44.asServiceRole.entities.Appointment.update(apt.id, {
          status: 'completed'
        });
        updatedCount++;
      }
    }

    return Response.json({ 
      success: true, 
      message: `Updated ${updatedCount} past appointments to completed status` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});