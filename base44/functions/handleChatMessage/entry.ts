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

    const allMessages = [...conversation_history, { role: "user", content: customer_message }];
    const recent = allMessages.filter((m: any) => m.role !== "system").slice(-8);

    // ── 1. Extract booking info FIRST so we can populate ChatMessage fields ──
    let extractedName = customer_name;
    let extractedPhone = customer_phone;
    let extractedVehicle = vehicle_info;
    let extractedService = "";
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

      // Use extracted values if provided (and not null), fall back to what was passed in
      if (booking.customer_name && String(booking.customer_name) !== "null") extractedName = booking.customer_name;
      if (booking.customer_phone && String(booking.customer_phone) !== "null") extractedPhone = booking.customer_phone;
      if (booking.vehicle_info && String(booking.vehicle_info) !== "null") extractedVehicle = booking.vehicle_info;
      if (booking.service_type && String(booking.service_type) !== "null") extractedService = booking.service_type;

      // Auto-book if all three pieces are present
      if (
        extractedName && extractedPhone && extractedService &&
        String(extractedName) !== "null" &&
        String(extractedPhone) !== "null" &&
        String(extractedService) !== "null"
      ) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const date = booking.preferred_date || tomorrow.toISOString().slice(0, 10);
        const time_slot = booking.preferred_time || "10:00 AM";

        const bookingResult = await sr.functions.invoke("bookAppointment", {
          shop_email,
          customer_name: extractedName,
          customer_phone: extractedPhone,
          customer_email: "",
          service_type: extractedService,
          date,
          time_slot,
          vehicle_info: extractedVehicle,
          notes: "Auto-booked by LBC Auto AI chat widget",
        });

        if (bookingResult?.data?.success || bookingResult?.success) {
          booking_made = true;
        }
      }
    } catch (e) {
      console.error("Booking extraction failed:", e);
    }

    // ── 2. Call lbcAutoAI with mode="customer" + shop_email ────────────
    const aiResult = await sr.functions.invoke("lbcAutoAI", {
      mode: "customer",
      shop_email,
      messages: allMessages,
    });

    const reply = aiResult?.data?.reply || aiResult?.reply ||
      "I'm sorry, I didn't catch that. Could you repeat?";

    // ── 3. Save customer message to ChatMessage ───────────────────────
    await sr.entities.ChatMessage.create({
      shop_email,
      session_id,
      sender_type: "customer",
      sender_name: extractedName || "Customer",
      message: customer_message,
      customer_name: extractedName,
      customer_phone: extractedPhone,
      vehicle_info: extractedVehicle,
      service_requested: extractedService,
      status: "open",
      is_read: false,
      source: "widget",
    });

    // ── 4. Save AI reply to ChatMessage ────────────────────────────────
    await sr.entities.ChatMessage.create({
      shop_email,
      session_id,
      sender_type: "ai",
      sender_name: "AI",
      message: reply,
      customer_name: extractedName,
      customer_phone: extractedPhone,
      vehicle_info: extractedVehicle,
      service_requested: extractedService,
      status: "ai_handled",
      is_read: false,
      source: "widget",
    });

    // ── 5. Send summary email to shop owner if booking was made ────────
    if (booking_made) {
      try {
        const conversationSummary = recent
          .map((m: any) => (m.role === "user" ? "Customer: " : "AI: ") + m.content)
          .join("\n");

        await sr.integrations.Core.SendEmail({
          to: shop_email,
          subject: "🤖 AI Chat Booking — " + extractedName + " · " + extractedService,
          body: "New booking from AI Chat Widget!\n\n" +
            "Customer: " + extractedName + "\n" +
            "Phone: " + extractedPhone + "\n" +
            "Service: " + extractedService + "\n" +
            "Vehicle: " + (extractedVehicle || "Not specified") + "\n\n" +
            "AI Conversation Summary:\n" + conversationSummary + "\n\n" +
            "View conversation in LBC Auto dashboard → Chat Inbox",
          from_name: "LBC Auto AI",
        });
      } catch (e) {
        console.error("Summary email failed:", e);
      }
    }

    // ── 6. Return ──────────────────────────────────────────────────────
    return Response.json(
      { reply, session_id, booking_made },
      { status: 200, headers: CORS }
    );
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: CORS });
  }
});