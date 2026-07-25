import { useState } from "react";
import { base44 } from "@/api/base44Client";

export function useScannerAiChat(context) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState(null);

  const ask = async (nextMessages, nextFocus = focus) => {
    setLoading(true);
    const response = await base44.functions.invoke("lbcDiagAI", {
      mode: "chat", messages: nextMessages, codes: context.codes, vehicle_details: context.vehicle,
      live_data: context.liveSnapshot, freeze_frame: context.freezeFrame, readiness_monitors: context.readiness,
      scan_timestamp: context.timestamp, health_summary: context.healthSummary, focused_code: nextFocus?.code ? nextFocus : null,
      connection_issue: nextFocus?.connectionIssue || null, protocol_attempts: context.protocolAttempts,
      shop_email: context.shopEmail, labor_rate: context.laborRate,
    });
    setMessages(prev => [...prev, { role: "assistant", content: response.data.reply }]);
    setLoading(false);
  };

  const openChat = (nextFocus = null) => {
    const prompt = nextFocus?.connectionIssue
      ? "Explain why this scan connection failed and give the safest next diagnostic steps."
      : nextFocus?.code
        ? `Analyze ${nextFocus.code} for this vehicle and provide the full mechanic and customer guidance.`
        : nextFocus?.allCodes
          ? "Analyze every detected code together, identify root causes versus symptoms, and provide complete mechanic and customer guidance."
          : "Review this complete health scan and tell us what to diagnose, repair, and quote next.";
    const first = [{ role: "user", content: prompt }];
    setFocus(nextFocus); setMessages(first); setOpen(true);
    ask(first, nextFocus).catch(error => { setMessages([...first, { role: "assistant", content: error?.message || "AI could not respond." }]); setLoading(false); });
  };

  const send = (text) => {
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    ask(next).catch(error => { setMessages(prev => [...prev, { role: "assistant", content: error?.message || "AI could not respond." }]); setLoading(false); });
  };

  return { open, setOpen, messages, loading, focus, openChat, send };
}