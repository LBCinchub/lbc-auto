import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all time entries and delete them
    const allEntries = await base44.asServiceRole.entities.TimeEntry.list('', 1000);
    
    let deletedCount = 0;
    for (const entry of allEntries) {
      await base44.asServiceRole.entities.TimeEntry.delete(entry.id);
      deletedCount++;
    }

    return Response.json({ 
      success: true, 
      message: `Reset ${deletedCount} timer entries` 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});