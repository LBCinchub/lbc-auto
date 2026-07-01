import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  try {
    const body = await req.json();
    const { shop_owner_email, customer_id, customer_phone, customer_name, sender, message, sent_at } = body;
    const sr = base44.asServiceRole;
    const created = await sr.entities.CustomerMessage.create({
      shop_owner_email, customer_id, customer_phone, customer_name,
      sender, message, sent_at,
      read_by_shop: sender === "shop",
      read_by_customer: sender === "customer",
    });
    if (sender === "customer") {
      await sr.entities.CustomerNotification.create({
        shop_owner_email, customer_id, customer_phone,
        type: "message",
        title: "New message from the shop",
        body: message.slice(0, 80),
        is_read: false,
        sent_at,
      });
    }
    return new Response(JSON.stringify({ success: true, message: created }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
