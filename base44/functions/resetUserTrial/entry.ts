import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email is required' }, { status: 400 });
    }

    // Find the target user by email
    const users = await base44.asServiceRole.entities.User.filter({ email: target_email });
    if (!users || users.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = users[0];
    const today = new Date().toISOString().split('T')[0];

    // Update their trial_started_date to today via service role
    const currentData = targetUser.data || {};
    await base44.asServiceRole.entities.User.update(targetUser.id, {
      data: {
        ...currentData,
        trial_started_date: today,
        subscription_status: 'trial',
      }
    });

    return Response.json({ success: true, message: `Trial reset to ${today} for ${target_email}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});