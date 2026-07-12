// customerLogin v6 — EXACT match only, supports multiple profiles sharing one phone number
// Fixed: added OPTIONS/CORS preflight handler + CORS headers on all responses
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

function normalize(digits) {
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  const base44 = createClientFromRequest(req);
  try {
    const { shop_email, phone, customer_id } = await req.json();
    const cleaned = (phone || "").replace(/\D/g, "");

    if (!shop_email || cleaned.length < 7) {
      return new Response(JSON.stringify({ success: false, error: "Invalid input" }), {
        headers: CORS
      });
    }

    const cleanedNorm = normalize(cleaned);

    const customers = await base44.asServiceRole.entities.Customer.filter(
      { shop_owner_email: shop_email.toLowerCase().trim() },
      "full_name phone email",
      5000
    );

    const matches = customers.filter((c) => {
      const cp = (c.phone || "").replace(/\D/g, "");
      if (!cp) return false;
      return normalize(cp) === cleanedNorm;
    });

    if (matches.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Phone not found", debug_count: customers.length }), {
        headers: CORS
      });
    }

    if (customer_id) {
      const chosen = matches.find((c) => c.id === customer_id) || matches[0];
      return new Response(JSON.stringify({
        success: true,
        customer: {
          id: chosen.id,
          full_name: chosen.full_name,
          phone: chosen.phone,
          email: chosen.email || null,
        }
      }), { headers: CORS });
    }

    if (matches.length > 1) {
      return new Response(JSON.stringify({
        success: false,
        multiple: true,
        profiles: matches.map((c) => ({
          id: c.id,
          full_name: c.full_name,
          email: c.email || null,
        }))
      }), { headers: CORS });
    }

    const match = matches[0];
    return new Response(JSON.stringify({
      success: true,
      customer: {
        id: match.id,
        full_name: match.full_name,
        phone: match.phone,
        email: match.email || null,
      }
    }), { headers: CORS });

  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: CORS
    });
  }
});