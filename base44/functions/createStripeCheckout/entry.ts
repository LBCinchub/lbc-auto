import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

const PRICE_IDS = {
  basic: "price_1U5bgEBCRALtpjBvSFWy6LYh",
  pro: "price_1U5bgFBCRALtpjBvvO8pB7oO",
  setup_fee: "price_1U5bgFBCRALtpjBv6x2G1hLE"
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { plan_tier, phase, success_url, cancel_url } = body;

    // Identify the authenticated user (PaymentWall is behind auth).
    // Fall back gracefully if the session isn't present.
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* not authenticated */ }

    const tier = plan_tier === "basic" ? "basic" : "pro";
    const isSetup = phase === "setup" || !user?.setup_fee_paid;

    const stripeKey = secrets.get("STRIPE_SECRET_KEY");
    const appId = secrets.get("BASE44_APP_ID");

    // Frontend supplies its own origin so the redirect lands in the app.
    const origin = success_url || (user ? "https://lbc-auto-flow.base44.app/" : "https://lbc-auto-flow.base44.app/");
    const cancel = cancel_url || "https://lbc-auto-flow.base44.app/PaymentWall";

    const params = new URLSearchParams();
    params.append("mode", "subscription");
    params.append("success_url", origin);
    params.append("cancel_url", cancel);
    if (user?.email) params.append("customer_email", user.email);
    params.append("metadata[base44_app_id]", appId || "");
    params.append("metadata[user_id]", user?.id || "");
    params.append("metadata[plan_tier]", tier);
    params.append("metadata[phase]", isSetup ? "setup" : "renewal");
    params.append("subscription_data[metadata][base44_app_id]", appId || "");
    params.append("subscription_data[metadata][user_id]", user?.id || "");
    params.append("subscription_data[metadata][plan_tier]", tier);

    // One-time setup fee (only on setup phase) + recurring monthly plan.
    let idx = 0;
    if (isSetup) {
      params.append(`line_items[${idx}][price]`, PRICE_IDS.setup_fee);
      params.append(`line_items[${idx}][quantity]`, "1");
      idx++;
    }
    params.append(`line_items[${idx}][price]`, PRICE_IDS[tier]);
    params.append(`line_items[${idx}][quantity]`, "1");

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Stripe-Version": "2025-10-29.clover",
        "Idempotency-Key": crypto.randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    const session = await res.json();
    if (!res.ok) {
      return Response.json({ error: session.error?.message || "Stripe error" }, { status: 400 });
    }

    return Response.json({ url: session.url, session_id: session.id });
  } catch (error) {
    console.error("createStripeCheckout error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}