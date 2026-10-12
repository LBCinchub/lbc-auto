import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import LbcAutoLogo from "@/components/brand/LbcAutoLogo";
import { shouldAnimate } from "@/lib/typewriter";
import { Send, Loader2, Wrench, Camera, Paperclip, X, Pin, CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SavePhotoToProfile from "@/components/photos/SavePhotoToProfile";
import AiMessageBody from "@/components/shared/AiMessageBody";
import StaffEstimateResult from "@/components/shared/StaffEstimateResult";
import AiOverlayLayer from "@/components/shared/AiOverlayLayer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import useFinancialShellOpen from "@/hooks/useFinancialShellOpen";

// Detail pages with a sticky bottom financial action bar — lift the widget above it.
const DETAIL_PATTERN = /\/(EstimateDetail|RepairOrderDetail|InvoiceDetail)/i;


const QUICK_PROMPTS = [
  { label: "🔧 Brake job hours", q: "How many hours for a full brake job (pads + rotors, all 4 wheels)?" },
  { label: "🦀 Rust factor", q: "How do I adjust labor hours for a heavily rusted Canadian car?" },
  { label: "⚠️ P0420 code", q: "What does P0420 mean and how many hours to fix?" },
  { label: "🔩 Head gasket", q: "How many hours for a head gasket replacement?" },
  { label: "🪛 Seized bolts", q: "Tips for dealing with seized exhaust bolts on a rusty car?" },
];

// ── LED pulse animation injected once ────────────────────────────────────────
let _ledStyleInjected = false;
function injectLEDStyle() {
  if (_ledStyleInjected || typeof document === "undefined") return;
  _ledStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes lbc-led-pulse {
      0%,100% { box-shadow: 0 0 6px 1px #f97316, 0 0 14px 2px #c2410c; }
      50%      { box-shadow: 0 0 14px 4px #fb923c, 0 0 28px 6px #ea580c; }
    }
    @keyframes lbc-dot-bounce {
      0%,80%,100% { transform: scale(0.6); opacity:0.4; }
      40%         { transform: scale(1.0); opacity:1; }
    }
    .lbc-ai-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 14px;
      cursor: pointer;
      user-select: none;
      background: linear-gradient(135deg, #1c0d02 0%, #2e1503 60%, #431c04 100%);
      border: 2px solid #f97316;
      animation: lbc-led-pulse 2.2s ease-in-out infinite;
      transition: background 0.2s;
    }
    .lbc-ai-toggle:hover {
      background: linear-gradient(135deg, #2a1404 0%, #431c04 60%, #5a2606 100%);
    }
    .lbc-ai-icon-ring {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: #f97316;
      border: 2px solid #fdba74;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 10px #f97316, 0 0 20px #c2410c;
    }
    .lbc-ai-panel {
      border-radius: 12px;
      border: 2px solid #f97316;
      overflow: hidden;
      box-shadow: 0 0 18px #f9731655, 0 4px 24px #00000088;
      background: #0c0705;
    }
    .lbc-ai-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(90deg, #160b03, #2a1404);
      border-bottom: 1px solid #f9731644;
    }
    .lbc-ai-md h1, .lbc-ai-md h2, .lbc-ai-md h3, .lbc-ai-md h4 { font-size: 12px; font-weight: 700; color: #fdba74; margin: 8px 0 4px; }
    .lbc-ai-md p { margin: 0 0 6px; }
    .lbc-ai-md ol { list-style: decimal; padding-left: 18px; margin: 0 0 6px; }
    .lbc-ai-md ul { list-style: disc; padding-left: 18px; margin: 0 0 6px; }
    .lbc-ai-md li { margin-bottom: 2px; }
    .lbc-ai-md button:focus-visible, .lbc-ai-panel button:focus-visible { outline: 2px solid #f97316; outline-offset: 2px; }
    .lbc-ai-messages {
      height: 220px;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
      scrollbar-color: #f9731633 transparent;
    }
    .lbc-ai-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #f9731622;
      background: #110a05;
    }
    .lbc-ai-input {
      flex: 1;
      background: #1a0f06;
      border: 1px solid #f9731655;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      color: #fafaf9;
      outline: none;
      transition: border-color 0.2s;
    }
    .lbc-ai-input::placeholder { color: #a8a29e; }
    .lbc-ai-input:focus { border-color: #f97316; }
    .lbc-ai-send {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: #f97316;
      border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 0 8px #f9731688;
      transition: background 0.15s;
    }
    .lbc-ai-send:hover { background: #fb923c; }
    .lbc-ai-send:disabled { opacity: 0.35; cursor: not-allowed; }
    @keyframes lbc-logo-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.92); } }
    .lbc-ai-logo-pulse { animation: lbc-logo-pulse 1.1s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .lbc-ai-toggle, .lbc-dot, .lbc-ai-logo-pulse { animation: none !important; }
    }
    .lbc-dot { width:6px; height:6px; border-radius:50%; background:#f97316; display:inline-block; animation: lbc-dot-bounce 1.2s infinite ease-in-out; }
  `;
  document.head.appendChild(style);
}

export default function AutoAIBubble({ vehicle = "", description = "" }) {
  injectLEDStyle();
  const location = useLocation();
  // On financial detail pages, lift the widget above the sticky action bar.
  const detailMode = DETAIL_PATTERN.test(location.pathname);
  // Also lift above the financial editor's bottom action bar while it is open.
  const shellOpen = useFinancialShellOpen();
  const bottomOffset = `calc(${detailMode || shellOpen ? 92 : 20}px + env(safe-area-inset-bottom, 0px))`;

  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { file, preview }
  const [savePhoto, setSavePhoto] = useState(null); // { photoUrl, aiAnalysis }
  const [user, setUser] = useState(null);
  const listRef  = useRef(null);
  const nearBottomRef = useRef(true);
  const msgIdRef = useRef(0);
  const animatedIdsRef = useRef(new Set()); // replies already revealed once — never retype
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Follow new content only when the user is already near the bottom.
  const followIfNear = () => {
    const el = listRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  };
  const handleListScroll = () => {
    const el = listRef.current;
    if (el) nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  useEffect(() => {
    if (open) followIfNear();
  }, [messages, open, loading]);

  // Closing the chat finishes any in-progress reveal (no retype on reopen).
  useEffect(() => {
    if (!open) messages.forEach(m => m.id && animatedIdsRef.current.add(m.id));
  }, [open, messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage({ file, preview: reader.result });
    reader.readAsDataURL(file);
    e.target.value = ""; // reset so same file can be re-selected
  };

  const removePendingImage = () => setPendingImage(null);

  const sendMessage = async (text) => {
    const q = (text || input).trim();
    if ((!q && !pendingImage) || loading) return;
    setInput("");

    const preview = pendingImage?.preview || null;
    const userMsg = { role: "user", content: q || "Please analyze this image.", image: preview };
    const history = [...messages, userMsg];
    setMessages(history);
    nearBottomRef.current = true; // sending a message returns the view to the latest reply
    setLoading(true);

    try {
      let imageUrl = null;
      if (pendingImage) {
        try {
          const uploadRes = await base44.integrations.Core.UploadFile({ file: pendingImage.file });
          imageUrl = uploadRes?.file_url || null;
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
        }
      }

      const payload = {
        mode: "owner",
        messages: history.map(m => ({ role: m.role, content: m.content })),
        vehicle: vehicle || "",
        description: description || "",
      };
      if (imageUrl) {
        payload.image_url = imageUrl;
        payload.image_context = "User uploaded a photo for AI analysis";
      }

      const result = await base44.functions.invoke("lbcAutoAI", payload);
      setPendingImage(null);

      const replyRaw = result?.data?.reply || result?.reply || "No response generated.";
      const offerApt  = result?.data?.offer_appointment || result?.offer_appointment || false;
      const assistantMsg = { id: `a${++msgIdRef.current}`, animate: true, role: "assistant", content: replyRaw, offerApt, estimateCapability: result?.data?.estimate_capability || null };
      if (imageUrl) {
        assistantMsg.imageUrl = imageUrl;
        assistantMsg.saveable = true;
      }
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e) {
      console.error("AutoAI error:", e);
      setMessages(prev => [...prev, { id: `a${++msgIdRef.current}`, role: "assistant", content: "⚠️ AI unavailable right now. Try again in a moment." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <AiOverlayLayer>
    <div style={{ position: "fixed", bottom: bottomOffset, right: 20, zIndex: 9998, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

      {/* ── Chat Panel (opens above the button) ── */}
      {/* FocusScope pauses any open dialog's focus trap while chat is open,
          and returns focus to the launcher when chat closes. */}
      {open && (
        <FocusScope asChild loop={false} trapped={false}
          onMountAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus({ preventScroll: true }); }}>
        <div className="lbc-ai-panel" role="dialog" aria-label="LBC Auto AI Chat" aria-modal="false"
          style={{ width: 340, maxWidth: "calc(100vw - 40px)" }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } }}>

          {/* Header */}
          <div className="lbc-ai-header">
            <LbcAutoLogo size="xs" />
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff", fontSize:12, fontWeight:700 }}>LBC Auto AI</div>
              <div style={{ color:"#fed7aa", fontSize:10 }}>Automotive knowledge assistant</div>
            </div>
            <span style={{
              background:"#00ff8822", border:"1px solid #00ff88",
              color:"#00ff88", fontSize:9, fontWeight:700,
              padding:"2px 8px", borderRadius:20,
            }}>● LIVE</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close LBC Auto AI"
              style={{
                width: 32, height: 32, borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid #f9731644",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fdba74", flexShrink: 0, marginLeft: 4, padding: 0,
              }}
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Messages */}
          <div className="lbc-ai-messages" ref={listRef} onScroll={handleListScroll} style={detailMode ? { height: 150 } : undefined}>
            {messages.length === 0 && (
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <Wrench style={{ width:28, height:28, color:"#c2410c", margin:"0 auto 8px" }} />
                <div style={{ color:"#d6d3d1", fontSize:11 }}>
                  {vehicle ? `Vehicle loaded: ${vehicle}` : "Ask about labor hours, rust, error codes…"}
                </div>
                {/* Quick prompts */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginTop:12 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p.label} onClick={() => sendMessage(p.q)}
                      style={{
                        fontSize:10, padding:"4px 10px", borderRadius:20, cursor:"pointer",
                        background:"#1a0f06", border:"1px solid #f9731644",
                        color:"#fed7aa", transition:"all 0.15s",
                      }}
                      onMouseOver={e => { e.target.style.borderColor="#f97316"; e.target.style.color="#fdba74"; }}
                      onMouseOut={e => { e.target.style.borderColor="#f9731644"; e.target.style.color="#fed7aa"; }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div key={idx} style={{ display:"flex", justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && (
                  <LbcAutoLogo size="xxs" style={{ marginRight: 6, marginTop: 2 }} />
                )}
                <div style={{
                  maxWidth:"82%", borderRadius:10, padding:"8px 12px",
                  fontSize:11, lineHeight:1.6, whiteSpace:"pre-wrap",
                  background: m.role==="user" ? "#2a1607" : "#1a0f06",
                  border: m.role==="user" ? "1px solid #f9731655" : "1px solid #f9731622",
                  color: m.role==="user" ? "#fed7aa" : "#f5f5f4",
                }}>
                  {m.image && (
                    <img src={m.image} alt="upload" style={{ width:"100%", borderRadius:6, marginBottom: m.content ? 6 : 0, display:"block" }} />
                  )}
                  {m.role === "assistant" && m.content ? (
                    <AiMessageBody
                      content={m.content}
                      animate={shouldAnimate(m, animatedIdsRef.current)}
                      onDone={() => animatedIdsRef.current.add(m.id)}
                      onProgress={followIfNear}
                    />
                  ) : m.content}
                  {m.role === "assistant" && m.estimateCapability && <StaffEstimateResult capability={m.estimateCapability} />}
                  {m.saveable && (
                    <button
                      onClick={() => setSavePhoto({ photoUrl: m.imageUrl, aiAnalysis: m.content })}
                      style={{
                        marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 10, padding: "3px 8px", borderRadius: 20, cursor: "pointer",
                        background: "#0a2a1a", border: "1px solid #00ff8844",
                        color: "#00ff88", transition: "all 0.15s",
                      }}
                      onMouseOver={e => { e.target.style.background = "#0e3a26"; e.target.style.borderColor = "#00ff88"; }}
                      onMouseOut={e => { e.target.style.background = "#0a2a1a"; e.target.style.borderColor = "#00ff8844"; }}
                    >
                      <Pin style={{ width: 10, height: 10 }} /> Save to Customer Profile
                    </button>
                  )}
                  {m.offerApt && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#1f1206", border: "1px solid #f9731644" }}>
                      <div style={{ color: "#fdba74", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                        📅 Want to schedule this at {user?.business_name || "your shop"}?
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => sendMessage("Yes, I'd like to schedule an appointment")}
                          style={{
                            fontSize: 11, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                            background: "linear-gradient(135deg, #9a3412, #c2410c)",
                            border: "1px solid #f97316", color: "#fff", fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 5,
                            boxShadow: "0 0 8px #f9731644",
                          }}
                        >
                          <CalendarPlus style={{ width: 11, height: 11 }} /> Yes, book me in
                        </button>
                        {user?.phone && (
                          <button
                            onClick={() => sendMessage("I will call the shop to book")}
                            style={{
                              fontSize: 11, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                              background: "#1a0f06", border: "1px solid #f9731644",
                              color: "#fed7aa",
                            }}
                          >
                            📞 Call {user.phone}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }} role="status" aria-label="LBC Auto AI Is Replying">
                <LbcAutoLogo size="xxs" className="lbc-ai-logo-pulse" />
                <div style={{
                  background:"#1a0f06", border:"1px solid #f9731622",
                  borderRadius:10, padding:"8px 14px", display:"flex", gap:4, alignItems:"center",
                }}>
                  <div className="lbc-dot" style={{ animationDelay:"0ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"180ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"360ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Pending image preview */}
          {pendingImage && (
            <div style={{ position:"relative", padding:"8px 12px 0", background:"#110a05" }}>
              <img src={pendingImage.preview} alt="preview" style={{ height:60, borderRadius:6, border:"1px solid #f9731655" }} />
              <button onClick={removePendingImage} style={{
                position:"absolute", top:10, left:64,
                width:20, height:20, borderRadius:"50%", border:"1px solid #ff4444",
                background:"#330000", color:"#ff6666", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", padding:0,
              }}>
                <X style={{ width:12, height:12 }} />
              </button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileSelect} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleFileSelect} />

          {/* Input row */}
          <div className="lbc-ai-input-row">
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={loading}
              title="Take photo"
              style={{
                width:32, height:32, borderRadius:8, flexShrink:0, cursor:loading?"not-allowed":"pointer",
                background:"#1a0f06", border:"1px solid #f9731644", display:"flex",
                alignItems:"center", justifyContent:"center", padding:0, opacity:loading?0.4:1,
              }}
            >
              <Camera style={{ width:15, height:15, color:"#fed7aa" }} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload photo"
              style={{
                width:32, height:32, borderRadius:8, flexShrink:0, cursor:loading?"not-allowed":"pointer",
                background:"#1a0f06", border:"1px solid #f9731644", display:"flex",
                alignItems:"center", justifyContent:"center", padding:0, opacity:loading?0.4:1,
              }}
            >
              <Paperclip style={{ width:15, height:15, color:"#fed7aa" }} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={pendingImage ? "Add a note (optional)…" : (vehicle ? `Ask about ${vehicle}…` : "Ask about labor hours, rust, codes…")}
              className="lbc-ai-input"
              disabled={loading}
            />
            <button
              className="lbc-ai-send"
              aria-label="Send Message"
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !pendingImage) || loading}
            >
              {loading
                ? <Loader2 style={{ width:14, height:14, color:"#1a0d05", animation:"spin 1s linear infinite" }} />
                : <Send style={{ width:14, height:14, color:"#1a0d05" }} />
              }
            </button>
          </div>

        </div>
        </FocusScope>
      )}

      {/* ── Save Photo Dialog ── */}
      {savePhoto && (
        <SavePhotoToProfile
          open={true}
          onClose={() => setSavePhoto(null)}
          photoUrl={savePhoto.photoUrl}
          aiAnalysis={savePhoto.aiAnalysis}
          source="ai_chat"
        />
      )}

      {/* ── LED Floating Toggle Button ── */}
      <div className="lbc-ai-toggle" role="button" tabIndex={0} aria-expanded={open}
        aria-label={open ? "Close LBC Auto AI" : "Open LBC Auto AI"}
        onClick={() => setOpen(v => !v)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(v => !v); } }}>
        <LbcAutoLogo size="xs" />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
            LBC Auto AI
          </div>
          <div style={{ color: "#fdba74", fontSize: 10, marginTop: 1 }}>
            {open ? "Click to close" : "Labor hours · Rust · Codes"}
          </div>
        </div>
        {/* Live LED dot */}
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88", flexShrink:0 }} />
      </div>
    </div>
    </AiOverlayLayer>
  );
}