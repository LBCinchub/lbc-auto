import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// One-time admin utility: marks pre-existing customers (activated under the old
// flat-fee model, before the setup-fee + monthly tier system existed) as
// plan_tier: "legacy". This intentionally does NOT set setup_fee_paid or
// next_billing_date — legacy customers keep permanent access without being
// pulled into the new recurring billing wall. Only brand-new signups going
// through PaymentWall get setup_fee_paid + next_billing_date populated.
//
// Safe to re-run: only touches accounts that are subscription_status "active",
// have never paid the new setup fee, and don't already have a plan_tier set.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const requester = await base44.auth.me();

    if (!requester || requester.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const allUsers = await base44.asServiceRole.entities.User.list();

    const candidates = allUsers.filter(
      (u) => u.subscription_status === "active" && !u.setup_fee_paid && !u.plan_tier
    );

    const updated = [];
    for (const u of candidates) {
      await base44.asServiceRole.entities.User.update(u.id, { plan_tier: "legacy" });
      updated.push({ id: u.id, email: u.email, business_name: u.business_name });
    }

    return Response.json({
      success: true,
      total_users_scanned: allUsers.length,
      marked_legacy_count: updated.length,
      marked_legacy: updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
