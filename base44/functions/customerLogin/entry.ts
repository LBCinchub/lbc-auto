import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const { shop_email, phone } = await req.json();
    const cleaned = (phone || "").replace(/\D/g, "");

    if (!shop_email || cleaned.length < 7) {
      return new Response(JSON.stringify({ success: false, error: "Invalid input" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Service role bypasses RLS — reads ALL customers for this shop owner email
    const customers = await base44.asServiceRole.entities.Customer.filter(
      { created_by: shop_email.toLowerCase().trim() },
      "full_name",
      5000
    );

    const match = customers.find((c) => {
      const cp = (c.phone || "").replace(/\D/g, "");
      return cp === cleaned || cp.endsWith(cleaned) || cleaned.endsWith(cp);
    });

    if (!match) {
      return new Response(JSON.stringify({ success: false, error: "Phone not found" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      customer: {
        id: match.id,
        full_name: match.full_name,
        phone: match.phone,
        email: match.email || null,
      }
    }), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
