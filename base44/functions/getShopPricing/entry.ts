/**
 * getShopPricing — PUBLIC endpoint (no auth required)
 * Called by the Haj Rims AI agent (or any embedded booking widget) to fetch
 * the real service pricing for a shop based on their invoice/estimate history.
 *
 * Flow:
 *   1. Receive shop_email (e.g. "hajwheels@gmail.com")
 *   2. Look up all invoices + estimates owned by that shop (asServiceRole)
 *   3. Group line items by service type → compute avg, min, max price
 *   4. Return structured pricing catalogue the AI can quote from
 */
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    let shopEmail = "";
    if (req.method === "GET") {
      const url = new URL(req.url);
      shopEmail = url.searchParams.get("shop_email") || "";
    } else {
      const body = await req.json();
      shopEmail = body.shop_email || "";
    }

    if (!shopEmail) {
      return Response.json({ error: "shop_email is required" }, { status: 400, headers: CORS });
    }

    // Pull all invoices and estimates for this shop
    const [invoices, estimates] = await Promise.all([
      sr.entities.Invoice.filter({ created_by: shopEmail }, "-created_date", 500),
      sr.entities.Estimate.filter({ created_by: shopEmail }, "-created_date", 500),
    ]);

    // Pull shop info (User record) for display
    const shopUsers = await sr.entities.User.filter({ email: shopEmail }, null, 1);
    const shop = shopUsers[0] || {};

    // ── Build pricing catalogue from labor + parts line items ──
    const serviceMap: Record<string, number[]> = {};

    const processLineItems = (items: any[], source: "invoice" | "estimate") => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (!item.description) continue;
        const key = item.description.trim().toLowerCase();
        let price = 0;
        if (item.total != null) {
          price = parseFloat(item.total) || 0;
        } else if (item.rate != null && item.hours != null) {
          price = (parseFloat(item.rate) || 0) * (parseFloat(item.hours) || 0);
        } else if (item.unit_price != null && item.quantity != null) {
          price = (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
        }
        if (price > 0) {
          if (!serviceMap[key]) serviceMap[key] = [];
          serviceMap[key].push(price);
        }
      }
    };

    for (const inv of invoices) {
      processLineItems(inv.labor_items, "invoice");
      processLineItems(inv.parts_items, "invoice");
    }
    for (const est of estimates) {
      processLineItems(est.labor_items, "estimate");
      processLineItems(est.parts_items, "estimate");
    }

    // ── Summary stats per service ──
    const catalogue = Object.entries(serviceMap)
      .map(([name, prices]) => {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return {
          service: name,
          display: name.replace(/\b\w/g, (l) => l.toUpperCase()),
          avg_price: Math.round(avg * 100) / 100,
          min_price: Math.round(min * 100) / 100,
          max_price: Math.round(max * 100) / 100,
          times_performed: prices.length,
        };
      })
      .sort((a, b) => b.times_performed - a.times_performed);

    // ── Also include shop's default labor rate ──
    const defaultLaborRate = shop.labor_rate || null;

    return Response.json({
      success: true,
      shop: {
        name: shop.business_name || "Auto Shop",
        email: shopEmail,
        phone: shop.phone || null,
        address: shop.address || null,
        default_labor_rate: defaultLaborRate,
      },
      catalogue,
      total_invoices_analyzed: invoices.length,
      total_estimates_analyzed: estimates.length,
      _note: "Prices are based on actual past work records — averages may vary by vehicle and condition.",
    }, { status: 200, headers: CORS });

  } catch (err) {
    return Response.json({ error: (err as any).message }, { status: 500, headers: CORS });
  }
});
