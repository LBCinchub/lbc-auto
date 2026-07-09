import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RECIPIENT_WALLET = "2SYh5UjyGEVwCMTQrY5LJrGRfEAmU9MqXECRrAMsNK34";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const requester = await base44.auth.me();

    if (!requester) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    // Admin-only utility action: mark pre-existing customers (activated under the
    // old flat-fee model, before setup-fee + monthly tiers existed) as plan_tier
    // "legacy". Does NOT set setup_fee_paid or next_billing_date, so these
    // accounts are never pulled into the new recurring billing wall.
    if (body.action === "migrate_legacy_customers") {
      if (requester.role !== "admin") {
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
    }

    // ── Default action: verify a Solana payment (setup fee or monthly renewal) ──
    const { transaction_id, phase, plan_tier } = body;

    if (!transaction_id) {
      return Response.json({ error: "Transaction ID required" }, { status: 400 });
    }

    const user = requester;

    // Verify transaction on Solana
    const response = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [transaction_id, { encoding: "json" }],
      }),
    });

    const result = await response.json();
    const transaction = result.result;

    if (!transaction) {
      return Response.json({ error: "Transaction not found" }, { status: 400 });
    }

    if (!transaction.blockTime) {
      return Response.json({ error: "Transaction not confirmed yet" }, { status: 400 });
    }

    const instructions = transaction.transaction?.message?.instructions || [];
    let isValid = false;

    for (const instruction of instructions) {
      if (instruction.program === "spl-token" || instruction.program === "system") {
        const parsedInfo = instruction.parsed?.info;
        if (parsedInfo?.destination === RECIPIENT_WALLET || parsedInfo?.mint === RECIPIENT_WALLET) {
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      return Response.json({ error: "Payment not sent to correct wallet" }, { status: 400 });
    }

    if (transaction_id === user.payment_transaction_id) {
      return Response.json({ error: "This transaction has already been used to verify a payment. Please send a new payment." }, { status: 400 });
    }

    const today = new Date();
    const nextBillingDate = new Date(today);
    nextBillingDate.setDate(nextBillingDate.getDate() + 30);

    const tier = plan_tier === "basic" ? "basic" : "pro";
    const isSetupPhase = phase === "setup" || !user.setup_fee_paid;

    const updates = {
      subscription_status: "active",
      payment_transaction_id: transaction_id,
      payment_date: today.toISOString().split("T")[0],
      next_billing_date: nextBillingDate.toISOString().split("T")[0],
    };

    if (isSetupPhase) {
      updates.setup_fee_paid = true;
      updates.plan_tier = tier;
    }

    await base44.auth.updateMe(updates);

    return Response.json({
      success: true,
      message: isSetupPhase ? "Setup payment verified — account activated" : "Renewal payment verified",
      plan_tier: isSetupPhase ? tier : user.plan_tier,
      next_billing_date: updates.next_billing_date,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
