import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const OWNER_PROMPT = `You are LBC Auto AI — an expert automotive technician and business partner to the shop owner.
Speak as "we" and "our shop." Quote labor using OUR labor rate. Talk shop-to-shop, partner-to-partner.

You are connected to THIS shop's live data — repair orders, invoices, parts inventory, and appointments.
Each garage using this software sees their own data. Use it to give proactive, actionable advice:
- Flag overdue invoices or customers who owe money.
- Suggest following up on open repair orders.
- Warn about low-stock parts before quoting a job.
- Mention today's appointments if the owner asks about the schedule.

DOMAIN: Auto repair, diagnostics, maintenance, body work, and parts ONLY. If asked anything unrelated, say: "I only help with automotive topics."

RESPONSE RULES:
- Be fast and direct. Bullet points. Specific numbers (hours, torque specs, fluid capacities).
- Diagnostics: likely cause → how to confirm → the fix.
- Factor in rust/access difficulty when it affects labor.
- Suggest cross-compatible parts from shared platforms when useful.
- Concise but complete. Don't omit critical steps or specs.
- End every response with a "⬇️ TL;DR" line (1-2 sentence bottom-line summary).`;

const CUSTOMER_PROMPT = `You are LBC Auto AI — a friendly automotive assistant helping a customer understand their vehicle.
You are NOT connected to any shop's internal data. You do NOT have access to repair orders, invoices, inventory, or financial records.
Never reference shop-internal data, pricing, balances, or business metrics. If asked about account balances, invoice amounts, or shop finances, say: "I can't access account or billing details — please contact your shop directly."

DOMAIN: Cars and auto repair only. If asked anything unrelated, say: "I only help with automotive topics."

RESPONSE RULES:
- Friendly, plain-English explanations. Avoid jargon when possible.
- Help customers understand what a code, symptom, or repair means.
- Suggest when they should see a mechanic (safety-related always).
- Be concise. Use bullet points for readability.
- Never invent prices, quotes, or shop-specific information.`;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { messages = [], mode = "owner", vehicle = "", description = "" } = body;

    if (!messages || messages.length === 0) {
      return Response.json({ reply: "No messages provided." });
    }

    // ════════════════════════════════════════════════════════════
    // CUSTOMER MODE — no auth, no shop data, isolated prompt
    // ════════════════════════════════════════════════════════════
    if (mode === "customer") {
      let customerContext = "";
      if (vehicle) customerContext += "\nVehicle: " + vehicle;
      if (description) customerContext += "\nConcern: " + description;

      const recent = messages.filter(m => m.role !== "system").slice(-6);

      const prompt =
        CUSTOMER_PROMPT +
        (customerContext ? "\n\nContext:" + customerContext : "") +
        "\n\nConversation:\n" +
        recent
          .map(m => (m.role === "user" ? "Customer: " : "Assistant: ") + m.content)
          .join("\n") +
        "\n\nRespond to the latest message as LBC Auto AI. Be helpful and clear. Never reference shop-internal data.";

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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
    }

    // ════════════════════════════════════════════════════════════
    // OWNER MODE — auth required, full shop data injected
    // ════════════════════════════════════════════════════════════
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Pull shop settings from the user so the AI always knows the shop context
    const shopInfo = [];
    if (user.business_name) shopInfo.push("Shop: " + user.business_name);
    if (user.email) shopInfo.push("Shop email: " + user.email);
    if (user.phone) shopInfo.push("Shop phone: " + user.phone);
    if (user.address) shopInfo.push("Shop address: " + user.address);
    if (user.labor_rate != null) shopInfo.push("Default labor rate: $" + user.labor_rate + "/hr");
    if (user.tax_rate != null) shopInfo.push("Tax rate: " + user.tax_rate + "%");
    if (user.tax_applies_to) shopInfo.push("Tax applies to: " + user.tax_applies_to);

    // ── Live shop data (user-scoped via RLS) ──────────────────────────────
    const today = new Date().toISOString().slice(0, 10);
    let [repairOrders, invoices, parts, appointments] = await Promise.all([
      base44.entities.RepairOrder.filter({}).catch(() => []),
      base44.entities.Invoice.filter({}).catch(() => []),
      base44.entities.Part.filter({}).catch(() => []),
      base44.entities.Appointment.filter({ date: today }).catch(() => []),
    ]);

    const openROs = repairOrders.filter(r =>
      r.status !== "completed" && r.status !== "delivered"
    );
    const unpaidInvoices = invoices.filter(i =>
      i.status === "unpaid" || i.status === "partial" || i.status === "overdue"
    );
    const totalOwed = unpaidInvoices.reduce((s, i) => s + (i.balance_due || (i.total || 0) - (i.amount_paid || 0)), 0);
    const lowStock = parts.filter(p => p.quantity != null && p.min_stock != null && p.quantity <= p.min_stock);

    const dataLines = [];
    dataLines.push(`Open repair orders: ${openROs.length}`);
    if (openROs.length) {
      dataLines.push("- " + openROs.slice(0, 5).map(r =>
        `${r.order_number || "RO"}: ${r.vehicle_info || "Unknown vehicle"} — ${r.status}`
      ).join("\n- "));
    }
    dataLines.push(`Unpaid invoices: ${unpaidInvoices.length} ($${totalOwed.toFixed(2)} owed)`);
    if (lowStock.length) {
      dataLines.push(`Low stock parts (${lowStock.length}): ` + lowStock.slice(0, 5).map(p =>
        `${p.name} (${p.quantity} left, min ${p.min_stock})`
      ).join(", "));
    }
    dataLines.push(`Today's appointments: ${appointments.length}`);

    let context = "";
    if (shopInfo.length) context += "\nShop Settings:\n- " + shopInfo.join("\n- ");
    context += "\n\nLive Shop Data (this shop's records):\n- " + dataLines.join("\n- ");
    if (vehicle) context += "\nVehicle: " + vehicle;
    if (description) context += "\nJob: " + description;

    // Keep history short for speed — only last 6 messages
    const recent = messages.filter(m => m.role !== "system").slice(-6);

    const prompt =
      OWNER_PROMPT +
      (context ? "\n\nShop Context:" + context : "") +
      "\n\nConversation:\n" +
      recent
        .map(m => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
        .join("\n") +
      "\n\nRespond to the latest message as LBC Auto AI. Be concise. When relevant, reference the shop's live data (open ROs, unpaid invoices, low stock) to give actionable advice.";

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