import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SYSTEM_PROMPT = `You are LBC Auto AI — an expert automotive technician and business partner to the shop owner.
Speak as "we" and "our shop." Quote labor using OUR labor rate. Talk shop-to-shop, partner-to-partner.

DOMAIN: Auto repair, diagnostics, maintenance, body work, and parts ONLY. If asked anything unrelated, say: "I only help with automotive topics."

DIAGNOSTIC EXPERTISE:
- For each code: likely cause → how to confirm → the fix, in that order.
- Factor in rust/access difficulty when it affects labor hours.
- Suggest cross-compatible parts from shared platforms when useful.
- Quote estimated labor hours and cost using our shop's labor rate.
- If we have a relevant part in stock, mention it.
- Be specific with torque specs, fluid capacities, and critical steps.
- End every chat response with a "⬇️ TL;DR" line (1-2 sentence bottom-line summary).`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { mode = "analyze", codes = [], live_data = null, vehicle = "", messages = [] } = body;

    // ── Shop context ────────────────────────────────────────────────────────
    const shopInfo = [];
    if (user.business_name) shopInfo.push("Shop: " + user.business_name);
    if (user.labor_rate != null) shopInfo.push("Default labor rate: $" + user.labor_rate + "/hr");
    if (user.tax_rate != null) shopInfo.push("Tax rate: " + user.tax_rate + "%");

    // ── Parts inventory (check stock for recommended parts) ────────────────
    const parts = await base44.entities.Part.filter({}).catch(() => []);
    const lowStock = parts.filter(p => p.quantity != null && p.min_stock != null && p.quantity <= p.min_stock);
    const inStockSummary = parts.length
      ? "Parts in inventory: " + parts.slice(0, 30).map(p => `${p.name} (${p.quantity} qty${p.quantity <= (p.min_stock||0) ? ", LOW" : ""})`).join(", ")
      : "No parts in inventory.";

    let context = "";
    if (shopInfo.length) context += "\nShop Settings:\n- " + shopInfo.join("\n- ");
    context += "\n\n" + inStockSummary;
    if (lowStock.length) {
      context += "\nLow stock alert: " + lowStock.slice(0, 10).map(p => `${p.name} (${p.quantity} left)`).join(", ");
    }
    if (vehicle) context += "\nVehicle: " + vehicle;
    if (codes.length) {
      context += "\nDiagnostic Trouble Codes found:\n" + codes.map(c => `- ${c.code} (${c.type || "stored"})`).join("\n");
    }
    if (live_data) {
      context += "\nLive data snapshot: " + JSON.stringify(live_data);
    }

    // ── ANALYZE MODE: structured JSON ───────────────────────────────────────
    if (mode === "analyze") {
      if (!codes.length) {
        return Response.json({ error: "No codes provided for analysis." }, { status: 400 });
      }

      const prompt = SYSTEM_PROMPT +
        context +
        `\n\nAnalyze these OBD2 codes for this vehicle. For EACH code provide:
- plain_english: what it means in simple terms
- likely_causes: ordered most → least probable
- urgency: Low, Medium, High, or Critical
- recommended_fix_order: cheapest/most-likely-first steps
- estimated_labor_hours: realistic hours for the fix (account for rust/access)
- estimated_labor_cost: hours × our labor rate
- parts_needed: list of parts (name + approximate cost if known)
- in_stock: true if we likely have the part in our inventory
Also provide an overall "summary" (1-2 sentences) and a "shop_advice" section with: total_estimated_cost, recommended_action (what to tell the customer), and priority_order (which fix to do first if multiple codes).`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            shop_advice: {
              type: "object",
              properties: {
                total_estimated_cost: { type: "number" },
                recommended_action: { type: "string" },
                priority_order: { type: "string" },
              },
            },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  plain_english: { type: "string" },
                  likely_causes: { type: "array", items: { type: "string" } },
                  urgency: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                  recommended_fix_order: { type: "array", items: { type: "string" } },
                  estimated_labor_hours: { type: "number" },
                  estimated_labor_cost: { type: "number" },
                  parts_needed: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        estimated_cost: { type: "number" },
                        in_stock: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      return Response.json({ analysis: result });
    }

    // ── CHAT MODE: follow-up questions ─────────────────────────────────────
    const recent = messages.filter(m => m.role !== "system").slice(-8);
    const prompt = SYSTEM_PROMPT +
      context +
      "\n\nConversation:\n" +
      recent.map(m => (m.role === "user" ? "User: " : "Assistant: ") + m.content).join("\n") +
      "\n\nRespond to the latest message as LBC Auto AI. Be concise. Reference the scan codes, shop data, and parts inventory when relevant.";

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: "gpt_5_mini",
    });

    const reply =
      (typeof result === "string" ? result : null) ||
      result?.reply ||
      result?.content ||
      result?.message ||
      "No response generated.";

    return Response.json({ reply });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});