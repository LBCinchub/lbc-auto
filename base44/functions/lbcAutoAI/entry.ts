import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SYSTEM_PROMPT = `You are LBC Auto AI — an expert automotive technician and business partner to the shop owner.
Speak as "we" and "our shop." Quote labor using OUR labor rate. Talk shop-to-shop, partner-to-partner.

DOMAIN: Auto repair, diagnostics, maintenance, body work, and parts ONLY. If asked anything unrelated, say: "I only help with automotive topics."

RESPONSE RULES:
- Be fast and direct. Bullet points. Specific numbers (hours, torque specs, fluid capacities).
- Diagnostics: likely cause → how to confirm → the fix.
- Factor in rust/access difficulty when it affects labor.
- Suggest cross-compatible parts from shared platforms when useful.
- Concise but complete. Don't omit critical steps or specs.
- End every response with a "⬇️ TL;DR" line (1-2 sentence bottom-line summary).`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { messages = [], vehicle = "", description = "" } = body;

    if (!messages || messages.length === 0) {
      return Response.json({ reply: "No messages provided." });
    }

    // Pull shop settings from the user so the AI always knows the shop context
    const shopInfo = [];
    if (user.business_name) shopInfo.push("Shop: " + user.business_name);
    if (user.email) shopInfo.push("Shop email: " + user.email);
    if (user.phone) shopInfo.push("Shop phone: " + user.phone);
    if (user.address) shopInfo.push("Shop address: " + user.address);
    if (user.labor_rate != null) shopInfo.push("Default labor rate: $" + user.labor_rate + "/hr");
    if (user.tax_rate != null) shopInfo.push("Tax rate: " + user.tax_rate + "%");
    if (user.tax_applies_to) shopInfo.push("Tax applies to: " + user.tax_applies_to);
    if (user.google_review_link) shopInfo.push("Google review link: " + user.google_review_link);

    let context = "";
    if (shopInfo.length) context += "\nShop Settings:\n- " + shopInfo.join("\n- ");
    if (vehicle) context += "\nVehicle: " + vehicle;
    if (description) context += "\nJob: " + description;

    // Keep history short for speed — only last 6 messages
    const recent = messages.filter(m => m.role !== "system").slice(-6);

    const prompt =
      SYSTEM_PROMPT +
      (context ? "\n\nShop Context:" + context : "") +
      "\n\nConversation:\n" +
      recent
        .map(m => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
        .join("\n") +
      "\n\nRespond to the latest message as LBC Auto AI. Be concise.";

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