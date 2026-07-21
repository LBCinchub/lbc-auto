import React, { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Wrench, Camera, Paperclip, X, Pin, CalendarPlus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SavePhotoToProfile from "@/components/photos/SavePhotoToProfile";


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
      0%,100% { box-shadow: 0 0 6px 1px #00b4ff, 0 0 14px 2px #0070cc; }
      50%      { box-shadow: 0 0 14px 4px #00d4ff, 0 0 28px 6px #0090ee; }
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
      background: linear-gradient(135deg, #001f3f 0%, #003366 60%, #004080 100%);
      border: 2px solid #00aaff;
      animation: lbc-led-pulse 2.2s ease-in-out infinite;
      transition: background 0.2s;
    }
    .lbc-ai-toggle:hover {
      background: linear-gradient(135deg, #002b55 0%, #004080 60%, #0055aa 100%);
    }
    .lbc-ai-icon-ring {
      width: 34px; height: 34px;
      border-radius: 50%;
      background: #00aaff;
      border: 2px solid #80d8ff;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 0 10px #00aaff, 0 0 20px #0077cc;
    }
    .lbc-ai-panel {
      border-radius: 12px;
      border: 2px solid #00aaff;
      overflow: hidden;
      box-shadow: 0 0 18px #00aaff55, 0 4px 24px #00000088;
      background: #020d1a;
    }
    .lbc-ai-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: linear-gradient(90deg, #001533, #002855);
      border-bottom: 1px solid #00aaff44;
    }
    .lbc-ai-messages {
      height: 220px;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      scrollbar-width: thin;
      scrollbar-color: #00aaff33 transparent;
    }
    .lbc-ai-input-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid #00aaff22;
      background: #01111f;
    }
    .lbc-ai-input {
      flex: 1;
      background: #001829;
      border: 1px solid #00aaff55;
      border-radius: 8px;
      padding: 7px 12px;
      font-size: 12px;
      color: #e0f4ff;
      outline: none;
      transition: border-color 0.2s;
    }
    .lbc-ai-input::placeholder { color: #3a7a9a; }
    .lbc-ai-input:focus { border-color: #00aaff; }
    .lbc-ai-send {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: #00aaff;
      border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      box-shadow: 0 0 8px #00aaff88;
      transition: background 0.15s;
    }
    .lbc-ai-send:hover { background: #33ccff; }
    .lbc-ai-send:disabled { opacity: 0.35; cursor: not-allowed; }
    .lbc-dot { width:6px; height:6px; border-radius:50%; background:#00aaff; display:inline-block; animation: lbc-dot-bounce 1.2s infinite ease-in-out; }
  `;
  document.head.appendChild(style);
}

export default function AutoAIBubble({ vehicle = "", description = "" }) {
  injectLEDStyle();

  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { file, preview }
  const [savePhoto, setSavePhoto] = useState(null); // { photoUrl, aiAnalysis }
  const endRef   = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (open && endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

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
      const assistantMsg = { role: "assistant", content: replyRaw, offerApt };
      if (imageUrl) {
        assistantMsg.imageUrl = imageUrl;
        assistantMsg.saveable = true;
      }
      setMessages(prev => [...prev, assistantMsg]);
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
    <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 50, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>

      {/* ── Chat Panel (opens above the button) ── */}
      {open && (
        <div className="lbc-ai-panel" style={{ width: 340 }}>

          {/* Header */}
          <div className="lbc-ai-header">
            <div className="lbc-ai-icon-ring" style={{ width:28, height:28 }}>
              <Bot style={{ width:14, height:14, color:"#fff" }} />
            </div>
            <div style={{ flex:1 }}>
              <div style={{ color:"#fff", fontSize:12, fontWeight:700 }}>LBC Auto AI</div>
              <div style={{ color:"#60b8d4", fontSize:10 }}>Automotive knowledge assistant</div>
            </div>
            <span style={{
              background:"#00ff8822", border:"1px solid #00ff88",
              color:"#00ff88", fontSize:9, fontWeight:700,
              padding:"2px 8px", borderRadius:20,
            }}>● LIVE</span>
          </div>

          {/* Messages */}
          <div className="lbc-ai-messages">
            {messages.length === 0 && (
              <div style={{ textAlign:"center", padding:"16px 0" }}>
                <Wrench style={{ width:28, height:28, color:"#1a4a6a", margin:"0 auto 8px" }} />
                <div style={{ color:"#3a7a9a", fontSize:11 }}>
                  {vehicle ? `Vehicle loaded: ${vehicle}` : "Ask about labor hours, rust, error codes…"}
                </div>
                {/* Quick prompts */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginTop:12 }}>
                  {QUICK_PROMPTS.map(p => (
                    <button key={p.label} onClick={() => sendMessage(p.q)}
                      style={{
                        fontSize:10, padding:"4px 10px", borderRadius:20, cursor:"pointer",
                        background:"#001829", border:"1px solid #00aaff44",
                        color:"#60b8d4", transition:"all 0.15s",
                      }}
                      onMouseOver={e => { e.target.style.borderColor="#00aaff"; e.target.style.color="#80d8ff"; }}
                      onMouseOut={e => { e.target.style.borderColor="#00aaff44"; e.target.style.color="#60b8d4"; }}
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
                  <div style={{
                    width:20, height:20, borderRadius:"50%",
                    background:"#00aaff22", border:"1px solid #00aaff55",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    marginRight:6, marginTop:2, flexShrink:0,
                  }}>
                    <Bot style={{ width:11, height:11, color:"#00aaff" }} />
                  </div>
                )}
                <div style={{
                  maxWidth:"82%", borderRadius:10, padding:"8px 12px",
                  fontSize:11, lineHeight:1.6, whiteSpace:"pre-wrap",
                  background: m.role==="user" ? "#002244" : "#001829",
                  border: m.role==="user" ? "1px solid #00aaff55" : "1px solid #00aaff22",
                  color: m.role==="user" ? "#b0e0ff" : "#c8e8f8",
                }}>
                  {m.image && (
                    <img src={m.image} alt="upload" style={{ width:"100%", borderRadius:6, marginBottom: m.content ? 6 : 0, display:"block" }} />
                  )}
                  {m.content}
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
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#001f3a", border: "1px solid #00aaff44" }}>
                      <div style={{ color: "#80d8ff", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>
                        📅 Want to schedule this at Haj Rims &amp; Tires?
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => sendMessage("Yes, I'd like to schedule an appointment at Haj Rims & Tires")}
                          style={{
                            fontSize: 11, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                            background: "linear-gradient(135deg, #004080, #0066cc)",
                            border: "1px solid #00aaff", color: "#fff", fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 5,
                            boxShadow: "0 0 8px #00aaff44",
                          }}
                        >
                          <CalendarPlus style={{ width: 11, height: 11 }} /> Yes, book me in
                        </button>
                        <button
                          onClick={() => sendMessage("Call Haj Rims & Tires to book")}
                          style={{
                            fontSize: 11, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
                            background: "#001829", border: "1px solid #00aaff44",
                            color: "#60b8d4",
                          }}
                        >
                          📞 Call 613-672-2727
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{
                  width:20, height:20, borderRadius:"50%",
                  background:"#00aaff22", border:"1px solid #00aaff55",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
                }}>
                  <Bot style={{ width:11, height:11, color:"#00aaff" }} />
                </div>
                <div style={{
                  background:"#001829", border:"1px solid #00aaff22",
                  borderRadius:10, padding:"8px 14px", display:"flex", gap:4, alignItems:"center",
                }}>
                  <div className="lbc-dot" style={{ animationDelay:"0ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"180ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"360ms" }} />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Pending image preview */}
          {pendingImage && (
            <div style={{ position:"relative", padding:"8px 12px 0", background:"#01111f" }}>
              <img src={pendingImage.preview} alt="preview" style={{ height:60, borderRadius:6, border:"1px solid #00aaff55" }} />
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
                background:"#001829", border:"1px solid #00aaff44", display:"flex",
                alignItems:"center", justifyContent:"center", padding:0, opacity:loading?0.4:1,
              }}
            >
              <Camera style={{ width:15, height:15, color:"#60b8d4" }} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload photo"
              style={{
                width:32, height:32, borderRadius:8, flexShrink:0, cursor:loading?"not-allowed":"pointer",
                background:"#001829", border:"1px solid #00aaff44", display:"flex",
                alignItems:"center", justifyContent:"center", padding:0, opacity:loading?0.4:1,
              }}
            >
              <Paperclip style={{ width:15, height:15, color:"#60b8d4" }} />
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
              onClick={() => sendMessage()}
              disabled={(!input.trim() && !pendingImage) || loading}
            >
              {loading
                ? <Loader2 style={{ width:14, height:14, color:"#fff", animation:"spin 1s linear infinite" }} />
                : <Send style={{ width:14, height:14, color:"#fff" }} />
              }
            </button>
          </div>

        </div>
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
      <div className="lbc-ai-toggle" onClick={() => setOpen(v => !v)}>
        <div className="lbc-ai-icon-ring">
          <Bot style={{ width: 18, height: 18, color: "#ffffff" }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#ffffff", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
            LBC Auto AI
          </div>
          <div style={{ color: "#80d8ff", fontSize: 10, marginTop: 1 }}>
            {open ? "Click to close" : "Labor hours · Rust · Codes"}
          </div>
        </div>
        {/* Live LED dot */}
        <div style={{ width:8, height:8, borderRadius:"50%", background:"#00ff88", boxShadow:"0 0 6px #00ff88", flexShrink:0 }} />
      </div>
    </div>
  );
}