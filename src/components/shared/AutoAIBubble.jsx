import React, { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, Wrench, Lightbulb, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";

const SYSTEM_PROMPT = `You are LBC Auto AI — a professional automotive assistant for an auto repair shop.

YOUR ONLY DOMAIN IS CARS AND AUTO REPAIR. If asked anything unrelated, politely say "I only help with automotive topics."

YOU ARE EXPERT IN:
- Diagnosing car problems by symptoms (sounds, warning lights, behavior)
- Estimating labor hours for repairs (standard flat-rate times)
- Rust and corrosion severity — how it affects labor time (add 20-50% for moderate rust, 50-150% for severe rust/seized bolts)
- Parts costs ranges (ballpark)
- Common issues by make/model/year
- OBD-II error codes (P-codes, B-codes, C-codes)
- Maintenance intervals
- Safety-critical vs non-urgent repairs

LABOR HOUR GUIDE (use these as base, adjust for rust):
- Oil change: 0.3–0.5h
- Brake pads (per axle): 1.0–1.5h | Rotors: add 0.5h
- Tire rotation: 0.3h | Tire swap (4): 0.5–1.0h
- Battery: 0.3–0.5h
- Alternator: 1.5–3.0h
- Starter: 1.0–2.5h
- Water pump: 2.0–5.0h (timing chain: add 2–4h)
- Timing belt: 3.0–6.0h
- Serpentine belt: 0.5–1.5h
- CV axle (per side): 1.5–2.5h
- Strut/shock (per side): 1.5–2.5h
- Control arm: 1.5–3.0h
- Tie rod end: 0.8–1.5h
- Wheel bearing: 1.5–3.0h
- Exhaust (mid-pipe): 1.0–2.5h | Full exhaust: 2.0–4.0h
- Catalytic converter: 1.5–3.0h
- O2 sensor: 0.5–1.5h
- Spark plugs (4-cyl): 0.5–1.5h | (V6): 1.5–3.0h | (V8): 2.0–4.0h
- Ignition coil: 0.5–1.0h (per coil)
- Thermostat: 0.5–2.0h
- Radiator: 2.0–4.0h
- Heater core: 4.0–10.0h
- Head gasket: 6.0–16.0h
- Transmission flush: 0.5–1.0h
- Transmission (remove/replace): 6.0–15.0h
- Clutch: 4.0–8.0h
- A/C recharge: 0.5–1.0h | Compressor: 2.0–4.0h
- Power steering pump: 1.5–3.0h
- Fuel pump: 1.5–4.0h

RUST MULTIPLIERS:
- Clean/southern car: 1.0x (baseline)
- Light surface rust: 1.1–1.2x
- Moderate rust (some seized bolts expected): 1.3–1.5x
- Heavy rust (most bolts seized, possible breakage): 1.6–2.0x
- Severe/rotted (structural rust, broken bolts guaranteed): 2.0–3.0x+

RESPONSE STYLE:
- Be direct and practical — you are talking to a mechanic or shop owner
- Give specific numbers (labor hours, cost ranges)
- Always mention rust adjustment if vehicle condition is known
- Keep responses concise — bullet points preferred
- Suggest related services the shop could upsell (e.g. brake fluid flush with brake job)`;

// Quick-prompt chips the tech can tap
const QUICK_PROMPTS = [
  { label: "Brake job hours", q: "How many hours for a full brake job (pads + rotors, all 4 wheels)?" },
  { label: "Rust factor", q: "How do I adjust labor hours for a heavily rusted car?" },
  { label: "Check engine P0420", q: "What does P0420 mean and how many hours to fix?" },
  { label: "Head gasket estimate", q: "How many hours for a head gasket replacement?" },
  { label: "Seized bolts", q: "Tips for dealing with seized exhaust bolts on a rusted car?" },
];

export default function AutoAIBubble({ vehicle, description }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQuick, setShowQuick] = useState(true);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const buildContext = () => {
    let ctx = "";
    if (vehicle) ctx += `\nCurrent vehicle: ${vehicle}`;
    if (description) ctx += `\nJob description: ${description}`;
    return ctx;
  };

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput("");
    setShowQuick(false);

    const userMsg = { role: "user", content: q };
    const history = [...messages, userMsg];
    setMessages(history);
    setLoading(true);

    try {
      const res = await base44.functions.callFunction("lbcAutoAI", {
        messages: history,
        vehicle: vehicle || "",
        description: description || "",
      });

      const reply = res?.reply || res?.content || res?.message || "Sorry, no response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ AI unavailable right now. Try again." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* ── Floating Bubble Trigger ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            open
              ? "bg-sky-500/20 border border-sky-500/40 text-sky-300"
              : "bg-gray-800/80 border border-gray-700/60 text-gray-400 hover:border-sky-500/40 hover:text-sky-400"
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          LBC Auto AI
          {open ? <X className="w-3 h-3 ml-1" /> : <span className="ml-1 text-gray-600">▲</span>}
        </button>
        {!open && (
          <span className="text-xs text-gray-600 italic">Ask about labor hours, rust, error codes…</span>
        )}
      </div>

      {/* ── Expanded Chat Panel ── */}
      {open && (
        <div className="rounded-xl border border-sky-500/20 bg-gray-900/95 overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-sky-900/40 to-gray-900 border-b border-sky-500/20">
            <div className="w-7 h-7 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="flex-1">
              <p className="text-white text-xs font-semibold">LBC Auto AI</p>
              <p className="text-gray-500 text-xs">Automotive knowledge · Labor hours · Rust diagnosis</p>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Free · Beta</span>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto p-3 space-y-2.5" style={{ scrollbarWidth: "thin" }}>
            {messages.length === 0 && (
              <div className="text-center py-3">
                <Wrench className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500 text-xs">
                  {vehicle ? `Loaded: ${vehicle}` : "Ask anything about cars, labor hours, or rust conditions."}
                </p>
              </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/20 flex items-center justify-center mr-1.5 mt-0.5 flex-shrink-0">
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
                <div className="w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-sky-400" />
                </div>
                <div className="bg-gray-800/80 border border-gray-700/50 rounded-xl px-3 py-2 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts */}
          {showQuick && messages.length === 0 && (
            <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
              {QUICK_PROMPTS.map(p => (
                <button key={p.label} onClick={() => sendMessage(p.q)}
                  className="text-xs px-2 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:border-sky-500/40 hover:text-sky-400 transition-colors">
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
              {loading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
