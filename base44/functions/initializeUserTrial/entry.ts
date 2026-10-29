import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Set trial start date if not already set
    const trialStarted = !user.trial_started_date;
    if (trialStarted) {
      await base44.auth.updateMe({
        trial_started_date: new Date().toISOString().split('T')[0],
        subscription_status: 'trial',
      });
    }

    // trial_started is true only for the call that actually created the trial (the app records it once)
    return Response.json({ success: true, trial_started: trialStarted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});