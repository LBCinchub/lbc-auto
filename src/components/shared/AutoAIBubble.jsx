import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Wrench } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SYSTEM_PROMPT = `You are LBC Auto AI — a professional automotive assistant for an auto repair shop.

YOUR ONLY DOMAIN IS CARS AND AUTO REPAIR. If asked anything unrelated, politely say "I only help with automotive topics."

EXPERTISE:
- Diagnosing car problems by symptoms (sounds, warning lights, behavior)
- Estimating labor hours for repairs (flat-rate standard times)
- Rust and corrosion severity — how it affects labor time
- Parts cost ranges (ballpark)
- Common issues by make/model/year
- OBD-II error codes (P-codes, B-codes, C-codes)
- Maintenance intervals
- Safety-critical vs non-urgent repairs

LABOR HOUR GUIDE (base times — adjust for rust):
- Oil change: 0.3–0.5h
- Brake pads per axle: 1.0–1.5h | Rotors: add 0.5h
- Tire rotation: 0.3h | Tire swap x4: 0.5–1.0h
- Battery: 0.3–0.5h | Alternator: 1.5–3.0h | Starter: 1.0–2.5h
- Water pump: 2.0–5.0h | Timing belt: 3.0–6.0h | Serpentine: 0.5–1.5h
- CV axle/side: 1.5–2.5h | Strut/side: 1.5–2.5h | Control arm: 1.5–3.0h
- Tie rod end: 0.8–1.5h | Wheel bearing: 1.5–3.0h
- Exhaust mid-pipe: 1.0–2.5h | Catalytic converter: 1.5–3.0h | O2 sensor: 0.5–1.5h
- Spark plugs 4-cyl: 0.5–1.5h | V6: 1.5–3.0h | V8: 2.0–4.0h
- Thermostat: 0.5–2.0h | Radiator: 2.0–4.0h | Heater core: 4.0–10.0h
- Head gasket: 6.0–16.0h | Transmission R&R: 6.0–15.0h | Clutch: 4.0–8.0h
- A/C compressor: 2.0–4.0h | Fuel pump: 1.5–4.0h
- Power steering pump: 1.5–3.0h

RUST MULTIPLIERS (apply to base hours):
- Clean / southern car: 1.0x
- Light surface rust: 1.1–1.2x
- Moderate rust (some seized bolts expected): 1.3–1.5x
- Heavy rust (most bolts seized, possible breakage): 1.6–2.0x
- Severe / rotted (structural rust, broken bolts guaranteed): 2.0–3.0x+

RESPONSE STYLE:
- Direct and practical — you are talking to a mechanic or shop owner
- Always give specific numbers (hours, cost ranges)
- Mention rust adjustment when relevant
- Bullet points preferred — keep it concise
- Suggest related upsell services when appropriate (e.g. brake fluid flush with brake job)`;

const QUICK_PROMPTS = [
  { label: "Brake job hours", q: "How many hours for a full brake job (pads + rotors, all 4 wheels)?" },
  { label: "Rust factor", q: "How do I adjust labor hours for a heavily rusted Canadian car?" },
  { label: "P0420 code", q: "What does P0420 mean and how many hours to fix?" },
  { label: "Head gasket", q: "How many hours for a head gasket replacement?" },
  { label: "Seized bolts", q: "Tips for dealing with seized exhaust bolts on a rusty car?" },
];

export default function AutoAIBubble({ vehicle = "", description = "" }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");

    const userMsg = { role: "user", content: q };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      // Build context from current RO form
      let context = "";
      if (vehicle) context += `\nCurrent vehicle: ${vehicle}`;
      if (description) context += `\nJob description: ${description}`;

      // Call Base44 built-in AI — uses Base44 integration credits
      const fullMessages = [
        { role: "user", content: SYSTEM_PROMPT + (context ? "\n\nShop context:" + context : "") + "\n\nReady to help." },
        { role: "assistant", content: "Ready. Ask me anything about this vehicle or repair job." },
        ...history,
      ];

      const response = await base44.ai.chat(fullMessages);

      // Handle various response shapes Base44 AI might return
      const reply =
        (typeof response === "string" ? response : null) ||
        response?.content ||
        response?.message ||
        response?.choices?.[0]?.message?.content ||
        "No response generated.";

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("AutoAI error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ AI unavailable right now. Try again in a moment." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="space-y-2">
      {/* ── LBC Auto AI Toggle Bar ── */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          cursor: "pointer",
          userSelect: "none",
          background: open ? "#0c4a6e" : "#0369a1",
          border: "2px solid #0ea5e9",
          boxShadow: "0 0 12px #0ea5e950",
        }}
      >
        {/* Robot icon — solid white circle so it always pops */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#0ea5e9",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 0 8px #0ea5e9",
        }}>
          <Bot style={{ width: 18, height: 18, color: "#ffffff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: 0.3 }}>
            LBC Auto AI
          </p>
          <p style={{ color: "#bae6fd", fontSize: 10, margin: 0 }}>
            {open ? "▼ Close" : "▲ Labor hours · Rust · Error codes"}
          </p>
        </div>
        <span style={{
          background: "#0ea5e9",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 20,
        }}>
          {open ? "CLOSE" : "ASK AI"}
        </span>
      </div>

      {/* ── Chat Panel ── */}
      {open && (
        <div className="rounded-xl border border-sky-500/20 bg-gray-900/95 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-sky-900/40 to-gray-900 border-b border-sky-500/20">
            <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
              <Bot className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold">LBC Auto AI</p>
              <p className="text-gray-500 text-[10px]">Labor hours · Rust diagnosis · Error codes</p>
            </div>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">Free · Beta</span>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto p-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="text-center py-4">
                <Wrench className="w-7 h-7 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">
                  {vehicle ? `Vehicle loaded: ${vehicle}` : "Ask anything about cars, labor hours, or rust."}
                </p>
              </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center mr-1.5 mt-0.5 flex-shrink-0">
                    <Bot className="w-3 h-3 text-sky-400" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-sky-600/30 border border-sky-500/30 text-sky-100"
                    : "bg-gray-800/80 border border-gray-700/50 text-gray-200"
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-sky-400" />
                </div>
                <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl px-3 py-2 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts — only on first open */}
          {messages.length === 0 && (
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap border-t border-gray-800/50 pt-2">
              {QUICK_PROMPTS.map(p => (
                <button
                  key={p.label}
                  onClick={() => sendMessage(p.q)}
                  className="text-[10px] px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:border-sky-500/40 hover:text-sky-400 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-gray-800">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={vehicle ? `Ask about ${vehicle}…` : "Ask about labor hours, rust, codes…"}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-sky-500/50 transition-colors"
              disabled={loading}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="w-7 h-7 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                : <Send className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
