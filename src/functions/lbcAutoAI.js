import { base44 } from "base44-sdk";

export default async function lbcAutoAI(req) {
  const { messages = [] } = req.body || {};

  if (!messages || messages.length === 0) {
    return { reply: "No messages provided." };
  }

  try {
    // Use Base44 built-in AI — no API key needed
    const response = await base44.ai.chat({
      messages,
      model: "gpt-4o-mini",   // free tier model
      temperature: 0.4,
      max_tokens: 600,
    });

    const reply = response?.choices?.[0]?.message?.content
      || response?.content
      || response?.message
      || "I couldn\'t generate a response.";

    return { reply };
  } catch (error) {
    console.error("LBC Auto AI error:", error);
    return { reply: "AI service temporarily unavailable. Please try again." };
  }
}
