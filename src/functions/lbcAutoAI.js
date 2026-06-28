import { base44 } from "base44-sdk";

const SYSTEM_PROMPT = `You are LBC Auto AI — a professional automotive assistant for an auto repair shop.
YOUR ONLY DOMAIN IS CARS AND AUTO REPAIR. If asked anything unrelated, say "I only help with automotive topics."
EXPERTISE: diagnosing car problems, labor hour estimates, rust multipliers, OBD-II codes, parts cost ranges, maintenance intervals.
LABOR HOURS (base): oil change 0.3-0.5h | brakes/axle 1-1.5h | rotors +0.5h | battery 0.3h | alternator 1.5-3h | water pump 2-5h | timing belt 3-6h | CV axle 1.5-2.5h | strut 1.5-2.5h | wheel bearing 1.5-3h | cat converter 1.5-3h | spark plugs 4cyl 0.5-1.5h V6 1.5-3h | radiator 2-4h | head gasket 6-16h | transmission 6-15h | AC compressor 2-4h | fuel pump 1.5-4h.
RUST MULTIPLIERS: clean 1.0x | light rust 1.1-1.2x | moderate 1.3-1.5x | heavy 1.6-2.0x | severe/rotted 2-3x+.
RESPONSE: direct, bullet points, specific numbers always, mention rust adjustment when relevant.`;

export default async function lbcAutoAI(req) {
  const { messages = [], vehicle = "", description = "" } = req.body || {};

  if (!messages || messages.length === 0) {
    return { reply: "No messages provided." };
  }

  let ctx = "";
  if (vehicle) ctx += `\nVehicle: ${vehicle}`;
  if (description) ctx += `\nJob: ${description}`;

  const fullMessages = [
    { role: "system", content: SYSTEM_PROMPT + (ctx ? "\n\nContext:" + ctx : "") },
    ...messages,
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
      "I couldn\'t generate a response.";

    return { reply };
  } catch (error) {
    console.error("LBC Auto AI error:", error);
    return { reply: "AI service temporarily unavailable. Please try again." };
  }
}
