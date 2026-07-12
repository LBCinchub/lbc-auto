import { base44 } from "@/api/base44Client";

/**
 * lbcAutoAI — Frontend proxy that calls the backend lbcAutoAI function.
 *
 * Supports:
 *   - mode: 'owner' (full diagnostic + shop data) | 'customer' (restricted pricing only)
 *   - shop_email: tenant identifier for shop-specific context
 *   - image_base64: base64 data URL for vision/image analysis
 *   - vehicle, description: contextual info for owner mode
 */
export default async function lbcAutoAI({
  messages = [],
  mode = "owner",
  vehicle = "",
  description = "",
  shop_email = "",
  image_base64 = null,
  image_context = "",
} = {}) {
  if (!messages || messages.length === 0) {
    return { reply: "No messages provided." };
  }

  try {
    const response = await base44.functions.invoke("lbcAutoAI", {
      messages,
      mode,
      vehicle,
      description,
      shop_email,
      image_base64,
      image_context,
    });

    const reply =
      response?.data?.reply ||
      response?.reply ||
      response?.data ||
      (typeof response === "string" ? response : null) ||
      "No response generated.";

    return { reply };
  } catch (error) {
    console.error("lbcAutoAI proxy error:", error);
    return { reply: "AI service temporarily unavailable. Please try again." };
  }
}