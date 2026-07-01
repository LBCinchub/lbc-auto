import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const { customer_id, shop_email } = await req.json();
    if (!customer_id || !shop_email) {
      return new Response(JSON.stringify({ error: "Missing params" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const sr = base44.asServiceRole;

    const [vehicles, orders, invoices, messages, notifications, offers, recommendations, reviews] = await Promise.all([
      sr.entities.Vehicle.filter({ customer_id }, "-created_date", 20),
      sr.entities.RepairOrder.filter({ customer_id }, "-created_date", 50),
      sr.entities.Invoice.filter({ customer_id }, "-created_date", 50),
      sr.entities.CustomerMessage.filter({ customer_id }, "sent_at", 200),
      sr.entities.CustomerNotification.filter({ customer_id }, "-sent_at", 30),
      sr.entities.ShopOffer.filter({ shop_owner_email: shop_email, is_active: true }, "-created_date", 20),
      sr.entities.CarRecommendation.filter({ customer_id, is_resolved: false }, "-created_date", 20),
      sr.entities.CustomerReview.filter({ customer_id }, "-created_date", 5),
    ]);

    return new Response(JSON.stringify({
      vehicles, orders, invoices, messages, notifications, offers, recommendations, reviews
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
