import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { shouldAnimate } from "@/lib/typewriter";
import { X, Pin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SavePhotoToProfile from "@/components/photos/SavePhotoToProfile";
import AiMessageBody from "@/components/shared/AiMessageBody";
import StaffEstimateResult from "@/components/shared/StaffEstimateResult";
import AiOverlayLayer from "@/components/shared/AiOverlayLayer";
import { FocusScope } from "@radix-ui/react-focus-scope";
import useFinancialShellOpen from "@/hooks/useFinancialShellOpen";
import useDialogOpen from "@/hooks/useDialogOpen";
import useKeyboardInset from "@/hooks/useKeyboardInset";
import { useQueryClient } from "@tanstack/react-query";
import StaffToolResults from "@/components/staff-ai/StaffToolResults";
import AiRetryButton from "@/components/staff-ai/AiRetryButton";
import AiLauncher from "@/components/staff-ai/AiLauncher";
import AiChatHeader from "@/components/staff-ai/AiChatHeader";
import AiComposer from "@/components/staff-ai/AiComposer";
import AiEmptyState from "@/components/staff-ai/AiEmptyState";
import AiAppointmentOffer from "@/components/staff-ai/AiAppointmentOffer";
import { BotOrb } from "@/components/staff-ai/BotAvatar";
import { injectAiChatStyles } from "@/components/staff-ai/aiChatStyles";
import { requestAiReply } from "@/lib/aiChatRequest";

// Detail pages with a sticky bottom financial action bar — lift the widget above it.
const DETAIL_PATTERN = /\/(EstimateDetail|RepairOrderDetail|InvoiceDetail)/i;

// One shared LBC Auto AI widget (rendered once by the app layout). Minimizing keeps the conversation
// and the unsent draft: all chat state lives here, only the panel unmounts.
export default function AutoAIBubble({ vehicle = "", description = "" }) {
  injectAiChatStyles();
  const location = useLocation();
  // On financial detail pages, lift the widget above the sticky action bar.
  const detailMode = DETAIL_PATTERN.test(location.pathname) || new URLSearchParams(location.search).has("doc");
  // Also lift above the financial editor's bottom action bar while it is open.
  const shellOpen = useFinancialShellOpen();
  const dialogOpen = useDialogOpen();
  const returnFocusRef = useRef(null); // where the cursor was before the chat opened

  const [open, setOpen]       = useState(false);
  const keyboard = useKeyboardInset(open); // mobile keyboard: keep the composer above it
  const bottomOffset = `calc(${keyboard ? keyboard + 8 : (detailMode || shellOpen || dialogOpen ? 92 : 20)}px + env(safe-area-inset-bottom, 0px))`;
  const [messages, setMessages] = useState([]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { file, preview }
  const [savePhoto, setSavePhoto] = useState(null); // { photoUri, preview, aiAnalysis }
  const [user, setUser] = useState(null);
  const [decisions, setDecisions] = useState({}); // message id -> "busy" | "done"
  const [shop, setShop] = useState(null); // verified active shop, as reported by the server
  const shopKeyRef = useRef(null);
  const queryClient = useQueryClient();
  const listRef  = useRef(null);
  const nearBottomRef = useRef(true);
  const msgIdRef = useRef(0);
  const requestSeqRef = useRef(0); // only the newest request may write a reply
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

  // Minimizing the chat finishes any in-progress reveal (no retype on reopen).
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

  // retryOf: a failed assistant reply to re-ask (read-only: the server will not prepare a change).
  const sendMessage = async (text, retryOf = null) => {
    if (loading) return;
    let userMsg, history;
    if (retryOf) {
      const idx = messages.findIndex(m => m.id === retryOf.id);
      if (idx < 1 || messages[idx - 1].role !== "user") return;
      history = messages.slice(0, idx);
      userMsg = history[history.length - 1];
    } else {
      const q = (text || input).trim();
      if (!q && !pendingImage) return;
      if (!text) setInput(""); // a suggestion tap never wipes an unsent draft
      userMsg = { role: "user", content: q || "Please analyze this image.", image: pendingImage?.preview || null };
      history = [...messages, userMsg];
    }
    const preview = retryOf ? null : pendingImage?.preview || null;
    const seq = ++requestSeqRef.current;
    setMessages(history);
    nearBottomRef.current = true; // sending a message returns the view to the latest reply
    setLoading(true);

    try {
      // Photos are stored privately; the AI reads them through a short-lived link.
      let imageUri = null;
      let imageUrl = null;
      if (pendingImage && !retryOf) {
        try {
          const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: pendingImage.file });
          const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri, expires_in: 600 });
          imageUri = file_uri;
          imageUrl = signed_url;
        } catch (uploadErr) {
          console.error("Image upload failed:", uploadErr);
        }
      }

      const payload = {
        mode: "owner",
        messages: history.map(m => ({ role: m.role, content: m.content })),
        vehicle: vehicle || "",
        description: description || "",
        page: location.pathname,
        request_id: crypto.randomUUID(),
        shop_key: shopKeyRef.current || undefined,
        read_only: retryOf ? true : undefined,
      };
      if (imageUrl) {
        payload.image_url = imageUrl;
        payload.image_context = "User uploaded a photo for AI analysis";
      }

      const out = await requestAiReply((name, p) => base44.functions.invoke(name, p), payload);
      if (seq !== requestSeqRef.current) return; // a newer request owns the chat: drop this reply
      if (!retryOf) setPendingImage(null);

      const data = out.data || {};
      const assistantMsg = { id: `a${++msgIdRef.current}`, animate: out.ok, role: "assistant", content: out.content, offerApt: !!data.offer_appointment, estimateCapability: data.estimate_capability || null, staff: data.staff || null,
        retry: out.retryable && !preview };
      if (imageUri) {
        assistantMsg.imageUri = imageUri;
        assistantMsg.imagePreview = preview;
        assistantMsg.saveable = true;
      }
      // A different verified shop means earlier replies belong to another shop: drop them.
      const nextShop = data.shop || null;
      const mismatch = data.staff?.error_code === "shop_mismatch";
      const switched = mismatch || !!(nextShop?.key && shopKeyRef.current && nextShop.key !== shopKeyRef.current);
      if (mismatch) { shopKeyRef.current = null; setShop(null); }
      if (nextShop?.key) { shopKeyRef.current = nextShop.key; setShop(nextShop); }
      setMessages(prev => (switched ? [userMsg, assistantMsg] : [...prev, assistantMsg]));
    } catch (e) {
      console.error("AutoAI error:", e?.name || "error");
      if (seq === requestSeqRef.current) setMessages(prev => [...prev, { id: `a${++msgIdRef.current}`, role: "assistant", content: "LBC Auto AI Is Unavailable Right Now. Nothing Was Changed. Tap Retry.", retry: !preview }]);
    } finally {
      if (seq === requestSeqRef.current) setLoading(false);
    }
  };

  // Confirm / Cancel a previewed change. The server holds the details; we send only id + token.
  const decide = async (msg, decision) => {
    if (decisions[msg.id]) return;
    setDecisions(d => ({ ...d, [msg.id]: "busy" }));
    const { action_id, token } = msg.staff.confirmation;
    // Confirmations are never retried automatically; a failure tells staff to check the record.
    try {
      const out = await requestAiReply((name, p) => base44.functions.invoke(name, p), { mode: "owner", shop_key: shopKeyRef.current || undefined, staff_action: { action_id, token, decision } });
      const staff = out.data?.staff || null;
      const content = out.ok || staff ? out.content : "Could Not Confirm The Result. Check The Record Before Trying Again.";
      setMessages(prev => [...prev, { id: `a${++msgIdRef.current}`, role: "assistant", content, staff }]);
      if (staff?.refresh?.length) queryClient.invalidateQueries();
    } finally {
      setDecisions(d => ({ ...d, [msg.id]: "done" }));
    }
  };

  const placeholder = pendingImage ? "Add A Note (Optional)…" : (vehicle ? `Ask About ${vehicle}…` : "Ask About Parts, Labor Time, Codes…");

  return (
    <AiOverlayLayer>
    <div className={`lbc-ai-root${open ? " lbc-ai-root--open" : ""}`} style={{ "--lbc-ai-bottom": bottomOffset }}>

      {/* ── Chat Panel (opens above the button) ── */}
      {/* FocusScope pauses any open dialog's focus trap while chat is open. Closing the chat puts
          the cursor back where it was (e.g. a line item field) WITHOUT selecting that field's text,
          so the next keys typed continue the field instead of replacing it. */}
      {open && (
        <FocusScope asChild loop={false} trapped={false}
          onMountAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current = document.activeElement; inputRef.current?.focus({ preventScroll: true }); }}
          onUnmountAutoFocus={(e) => { e.preventDefault(); returnFocusRef.current?.focus?.({ preventScroll: true }); }}>
        <div className="lbc-ai-panel" role="dialog" aria-label="LBC Auto AI Chat" aria-modal="false"
          onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } }}>

          <AiChatHeader shop={shop} onMinimize={() => setOpen(false)} />

          {/* Messages: the only scroller in the panel */}
          <div className="lbc-ai-messages" ref={listRef} onScroll={handleListScroll} aria-live="off">
            {messages.length === 0 && <AiEmptyState vehicle={vehicle} pathname={location.pathname} onAsk={(q) => sendMessage(q)} />}

            {messages.map((m, idx) => (
              <div key={idx} style={{ display:"flex", gap: 8, alignItems: "flex-start", justifyContent: m.role==="user" ? "flex-end" : "flex-start" }}>
                {m.role === "assistant" && <BotOrb size={30} />}
                <div className={`lbc-ai-bubble ${m.role === "user" ? "lbc-ai-bubble--user" : "lbc-ai-bubble--ai"}`}>
                  {m.image && (
                    <img src={m.image} alt="Uploaded Photo" style={{ width:"100%", borderRadius:8, marginBottom: m.content ? 8 : 0, display:"block" }} />
                  )}
                  {m.role === "assistant" && m.content ? (
                    <AiMessageBody
                      content={m.content}
                      animate={shouldAnimate(m, animatedIdsRef.current)}
                      onDone={() => animatedIdsRef.current.add(m.id)}
                      onProgress={followIfNear}
                      showCopy={!m.staff?.confirmation}
                    />
                  ) : m.content}
                  {m.role === "assistant" && m.estimateCapability && <StaffEstimateResult capability={m.estimateCapability} />}
                  {m.role === "assistant" && m.staff && (
                    <StaffToolResults staff={m.staff} decisionState={decisions[m.id]} onDecision={(d) => decide(m, d)} onAsk={(q) => sendMessage(q)} />
                  )}
                  {m.role === "assistant" && m.retry && idx === messages.length - 1 && (
                    <AiRetryButton disabled={loading} onRetry={() => sendMessage(null, m)} />
                  )}
                  {m.saveable && (
                    <button type="button" className="lbc-ai-chip-btn"
                      onClick={() => setSavePhoto({ photoUri: m.imageUri, preview: m.imagePreview, aiAnalysis: m.content })}
                      style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, background: "#0a2a1a", borderColor: "#00ff8855", color: "#86efac" }}>
                      <Pin style={{ width: 13, height: 13 }} /> Save To Customer Profile
                    </button>
                  )}
                  {m.offerApt && <AiAppointmentOffer user={user} onAsk={(q) => sendMessage(q)} />}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }} role="status" aria-label="LBC Auto AI Is Replying">
                <BotOrb size={30} className="lbc-ai-pulse" />
                <div className="lbc-ai-bubble lbc-ai-bubble--ai" style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <div className="lbc-dot" style={{ animationDelay:"0ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"180ms" }} />
                  <div className="lbc-dot" style={{ animationDelay:"360ms" }} />
                </div>
              </div>
            )}
          </div>

          {/* Pending image preview */}
          {pendingImage && (
            <div style={{ position:"relative", padding:"8px 12px 0", background:"#110a05", flexShrink: 0 }}>
              <img src={pendingImage.preview} alt="Photo To Send" style={{ height:64, borderRadius:8, border:"1px solid #f9731655" }} />
              <button type="button" onClick={removePendingImage} aria-label="Remove Photo" style={{
                position:"absolute", top:4, left:70, width:28, height:28, borderRadius:"50%", border:"1px solid #ff4444",
                background:"#330000", color:"#ff6666", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0,
              }}>
                <X style={{ width:14, height:14 }} />
              </button>
            </div>
          )}

          {/* Hidden file inputs */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFileSelect} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={handleFileSelect} />

          <AiComposer inputRef={inputRef} value={input} onChange={setInput} onSend={() => sendMessage()} loading={loading}
            canSend={!!input.trim() || !!pendingImage} placeholder={placeholder}
            onCamera={() => cameraInputRef.current?.click()} onUpload={() => fileInputRef.current?.click()} />
        </div>
        </FocusScope>
      )}

      {/* ── Save Photo Dialog ── */}
      {savePhoto && (
        <SavePhotoToProfile
          open={true}
          onClose={() => setSavePhoto(null)}
          photoUri={savePhoto.photoUri}
          previewSrc={savePhoto.preview}
          aiAnalysis={savePhoto.aiAnalysis}
          source="ai_chat"
        />
      )}

      <AiLauncher open={open} compact={dialogOpen} onToggle={() => setOpen(v => !v)} />
    </div>
    </AiOverlayLayer>
  );
}