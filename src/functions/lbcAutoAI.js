import { base44 } from "base44-sdk";

const SYSTEM_PROMPT = `You are LBC Auto AI — a professional automotive assistant for an auto repair shop, powered by Lumina (LBC Brain).

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

RESPONSE: Direct, bullet points, specific numbers always. Mention rust when relevant.`;

export default async function lbcAutoAI(req) {
  const { messages = [], vehicle = "", description = "" } = req.body || {};

  if (!messages || messages.length === 0) {
    return { reply: "No messages provided." };
  }

  let context = "";
  if (vehicle) context += "\nVehicle: " + vehicle;
  if (description) context += "\nJob: " + description;

  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT + (context ? "\n\nShop Context:" + context : "") },
    ...messages.filter(m => m.role !== "system"),
  ];

  try {
    const response = await base44.ai.chat({
      messages: fullMessages,
      model: "gpt-4o-mini",
      temperature: 0.4,
      max_tokens: 600,
    });

    const reply =
      response?.choices?.[0]?.message?.content ||
      response?.content ||
      response?.message ||
      (typeof response === "string" ? response : null) ||
      "No response generated.";

    return { reply };
  } catch (error) {
    console.error("lbcAutoAI error:", error);
    return { reply: "AI service temporarily unavailable. Please try again." };
  }
}
