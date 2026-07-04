// customerLogin v4 — EXACT match only (fixes cross-tenant/partial-number login bug)
// deployed: 2026-07-03
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function normalize(digits) {
  // Strip leading country code "1" only when it results in a proper 10-digit NA number
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

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

    const cleanedNorm = normalize(cleaned);

    // asServiceRole bypasses RLS — reads all customers for this shop
    const customers = await base44.asServiceRole.entities.Customer.filter(
      { created_by: shop_email.toLowerCase().trim() },
      "full_name",
      5000
    );

    // STRICT exact match only (normalized for optional leading "1" country code).
    // No more endsWith/startsWith fuzzy matching — that let ANY partial number log in as a customer.
    const match = customers.find((c) => {
      const cp = (c.phone || "").replace(/\D/g, "");
      if (!cp) return false;
      return normalize(cp) === cleanedNorm;
    });

    if (!match) {
      return new Response(JSON.stringify({ success: false, error: "Phone not found", debug_count: customers.length }), {
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
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
});
