import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import Stripe from 'npm:stripe@17.3.0';

function dateStr(d) {
  return new Date(d).toISOString().split("T")[0];
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const stripeKey = secrets.get("STRIPE_SECRET_KEY");
    const webhookSecret = secrets.get("STRIPE_WEBHOOK_SECRET");

    if (!webhookSecret) {
      return Response.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-10-29.clover" });

    const rawBody = await req.text();
    const signature = req.headers.get("Stripe-Signature");

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe signature verification failed:", err.message);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const tier = session.metadata?.plan_tier;
        const phase = session.metadata?.phase;

        if (!userId) break;

        const today = new Date();
        const next = new Date(today);
        next.setDate(next.getDate() + 30);

        const updates = {
          subscription_status: "active",
          payment_date: dateStr(today),
          next_billing_date: dateStr(next),
        };

        if (phase === "setup") {
          updates.setup_fee_paid = true;
          if (tier) updates.plan_tier = tier;
        } else if (tier) {
          updates.plan_tier = tier;
        }

        await base44.asServiceRole.entities.User.update(userId, updates);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        // subscription_data.metadata carries the user_id we set at checkout.
        const userId = invoice.subscription_details?.metadata?.user_id || invoice.metadata?.user_id;

        if (!userId) break;

        const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date();
        // Give a small buffer so access isn't gated before the next invoice fires.
        const next = new Date(periodEnd);
        next.setDate(next.getDate() + 1);

        await base44.asServiceRole.entities.User.update(userId, {
          subscription_status: "active",
          next_billing_date: dateStr(next),
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        await base44.asServiceRole.entities.User.update(userId, {
          subscription_status: "expired",
        });
        break;
      }

      default:
        // Unhandled event type — no action needed.
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("stripeWebhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}