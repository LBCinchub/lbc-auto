import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const SYSTEM_PROMPT = `You are LBC Auto AI — a professional automotive assistant for an auto repair shop.

YOUR ONLY DOMAIN IS CARS AND AUTO REPAIR. If asked anything unrelated, say "I only help with automotive topics."

LABOR HOURS (base times):
- Oil change: 0.3-0.5h | Brake pads/axle: 1-1.5h | Rotors: +0.5h
- Battery: 0.3h | Alternator: 1.5-3h | Starter: 1-2.5h
- Water pump: 2-5h | Timing belt: 3-6h | CV axle: 1.5-2.5h | Strut: 1.5-2.5h
- Wheel bearing: 1.5-3h | Cat converter: 1.5-3h | O2 sensor: 0.5-1.5h
- Spark plugs 4cyl: 0.5-1.5h | V6: 1.5-3h | V8: 2-4h
- Radiator: 2-4h | Head gasket: 6-16h | Transmission: 6-15h
- AC compressor: 2-4h | Fuel pump: 1.5-4h | Heater core: 4-10h

RUST MULTIPLIERS: Clean 1.0x | Light 1.1-1.2x | Moderate 1.3-1.5x | Heavy 1.6-2.0x | Severe 2-3x+

RESPONSE: Direct, bullet points, specific numbers always. Mention rust when relevant. Keep it concise.`;

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

    let context = "";
    if (vehicle) context += "\nVehicle: " + vehicle;
    if (description) context += "\nJob: " + description;

    const prompt =
      SYSTEM_PROMPT +
      (context ? "\n\nShop Context:" + context : "") +
      "\n\nConversation so far:\n" +
      messages
        .filter(m => m.role !== "system")
        .map(m => (m.role === "user" ? "User: " : "Assistant: ") + m.content)
        .join("\n") +
      "\n\nRespond to the user's latest message as LBC Auto AI.";

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