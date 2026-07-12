import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  try {
    const base44 = createClientFromRequest(req);
    const sr = base44.asServiceRole;

    const body = await req.json();
    const {
      shop_email,
      session_id,
      customer_message,
      customer_name = "",
      customer_phone = "",
      vehicle_info = "",
      conversation_history = [],
    } = body;

    if (!shop_email || !session_id || !customer_message) {
      return Response.json(
        { error: "Missing required fields: shop_email, session_id, customer_message" },
        { status: 400, headers: CORS }
      );
    }

    // ── 1. Look up shop info ──────────────────────────────────────────
    const shopUsers = await sr.entities.User.filter({ email: shop_email }, null, 1);
    const shop = shopUsers[0] || {};
    const shopName = shop.business_name || "our shop";
    const shopPhone = shop.phone || "";

    // ── 2. Build shop-specific customer prompt ────────────────────────
    const shopInfoLines = [];
    if (shop.business_name) shopInfoLines.push("Shop: " + shop.business_name);
    if (shop.phone) shopInfoLines.push("Phone: " + shop.phone);
    if (shop.address) shopInfoLines.push("Address: " + shop.address);
    if (shop.labor_rate != null) shopInfoLines.push("Labor rate: $" + shop.labor_rate + "/hr");

    const customerPrompt = `You are the AI booking assistant for ${shopName}. Help customers with automotive service questions and booking appointments.
${shopInfoLines.length ? "\n" + shopInfoLines.join("\n") : ""}

RULES:
- Be friendly and concise (under 3 sentences per reply).
- If asked about pricing, use the shop's labor rate if known; otherwise say "I'll have the shop confirm exact pricing."
- After the first exchange, if the customer hasn't shared their name and phone, ask: "Want me to book you an appointment? Just share your name and phone number."
- If the customer shares their name, phone, and service needed, confirm you'll book them in and say something like "Great, I've got you booked! The shop will call to confirm."
- NEVER mention repair orders, invoices, finances, or any internal shop data.
- End with the shop phone number if available: ${shopPhone}`;

    // ── 3. Call LLM ────────────────────────────────────────────────────
    const allMessages = [...conversation_history, { role: "user", content: customer_message }];
    const recent = allMessages.filter((m: any) => m.role !== "system").slice(-8);

    const prompt = customerPrompt +
      "\n\nConversation:\n" +
      recent.map((m: any) => (m.role === "user" ? "Customer: " : "Assistant: ") + m.content).join("\n") +
      "\n\nRespond to the latest customer message.";

    const result = await sr.integrations.Core.InvokeLLM({ prompt, model: "gpt_5_mini" });
    const reply = (typeof result === "string" ? result : null) ||
      result?.reply || result?.content || result?.message ||
      "I'm sorry, I didn't catch that. Could you repeat?";

    // ── 4. Save customer message to ChatMessage ───────────────────────
    await sr.entities.ChatMessage.create({
      shop_email,
      session_id,
      sender_type: "customer",
      sender_name: customer_name || "Customer",
      message: customer_message,
      customer_name,
      customer_phone,
      vehicle_info,
      service_requested: "",
      status: "open",
      is_read: false,
      source: "widget",
    });

    // ── 5. Save AI reply to ChatMessage ────────────────────────────────
    await sr.entities.ChatMessage.create({
      shop_email,
      session_id,
      sender_type: "ai",
      sender_name: "AI",
      message: reply,
      customer_name,
      customer_phone,
      vehicle_info,
      service_requested: "",
      status: "ai_handled",
      is_read: false,
      source: "widget",
    });

    // ── 6. Extract booking info using LLM ──────────────────────────────
    let booking_made = false;
    try {
      const extraction = await sr.integrations.Core.InvokeLLM({
        prompt: `Extract booking information from this conversation. Return JSON only, no markdown.\n\nConversation:\n${recent.map((m: any) => (m.role === "user" ? "Customer: " : "Assistant: ") + m.content).join("\n")}\n\nExtract these fields. Use null for any field that is NOT clearly provided by the customer:\n- customer_name (full name)\n- customer_phone (phone number)\n- service_type (the service they want)\n- vehicle_info (year make model if mentioned)\n- preferred_date (YYYY-MM-DD if mentioned)\n- preferred_time (e.g. "10:00 AM" if mentioned)`,
        response_json_schema: {
          type: "object",
          properties: {
            customer_name: { type: "string" },
            customer_phone: { type: "string" },
            service_type: { type: "string" },
            vehicle_info: { type: "string" },
            preferred_date: { type: "string" },
            preferred_time: { type: "string" },
          },
        },
        model: "gpt_5_mini",
      });

      const booking = extraction || {};

      if (
        booking.customer_name && booking.customer_phone && booking.service_type &&
        String(booking.customer_name) !== "null" &&
        String(booking.customer_phone) !== "null" &&
        String(booking.service_type) !== "null"
      ) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const date = booking.preferred_date || tomorrow.toISOString().slice(0, 10);
        const time_slot = booking.preferred_time || "10:00 AM";

        const bookingResult = await sr.functions.invoke("bookAppointment", {
          shop_email,
          customer_name: booking.customer_name,
          customer_phone: booking.customer_phone,
          customer_email: "",
          service_type: booking.service_type,
          date,
          time_slot,
          vehicle_info: booking.vehicle_info || vehicle_info || "",
          notes: "Auto-booked by LBC Auto AI chat widget",
        });

        if (bookingResult?.data?.success || bookingResult?.success) {
          booking_made = true;

          // Send summary email to shop owner
          const conversationSummary = recent
            .map((m: any) => (m.role === "user" ? "Customer: " : "AI: ") + m.content)
            .join("\n");

          await sr.integrations.Core.SendEmail({
            to: shop_email,
            subject: "🤖 AI Chat Booking — " + booking.customer_name + " · " + booking.service_type,
            body: "New booking from AI Chat Widget!\n\n" +
              "Customer: " + booking.customer_name + "\n" +
              "Phone: " + booking.customer_phone + "\n" +
              "Service: " + booking.service_type + "\n" +
              "Vehicle: " + (booking.vehicle_info || vehicle_info || "Not specified") + "\n" +
              "Date: " + date + " @ " + time_slot + "\n\n" +
              "AI Conversation Summary:\n" + conversationSummary + "\n\n" +
              "View conversation in LBC Auto dashboard → Chat Inbox",
            from_name: "LBC Auto AI",
          });
        }
      }
    } catch (e) {
      console.error("Booking extraction/creation failed:", e);
    }

    return Response.json(
      { reply, session_id, booking_made },
      { status: 200, headers: CORS }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
});