import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Tag, Star, Bell, Plus, Send, X,
  ChevronRight, Users, Trash2, Check, AlertTriangle,
  Copy, CheckCheck, Link, Wrench, Phone
} from "lucide-react";

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso);
  const m = Math.floor(diff/60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export default function CustomerHub() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("messages");
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [offers, setOffers] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [inbox, setInbox] = useState([]); // all latest messages per customer
  const [copied, setCopied] = useState(false);
  const msgEndRef = useRef(null);
  const pollRef = useRef(null);
  const qc = useQueryClient();

  // Offer form
  const [offerForm, setOfferForm] = useState({ title:"", description:"", valid_until:"", is_active:true });
  const [savingOffer, setSavingOffer] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);

  // Recommendation form
  const [recForm, setRecForm] = useState({ title:"", description:"", urgency:"medium", estimated_cost:"", vehicle_info:"" });
  const [showRecForm, setShowRecForm] = useState(false);
  const [savingRec, setSavingRec] = useState(false);

  // Reply to review
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!u) return;
      loadAll(u);
      pollRef.current = setInterval(() => refreshInbox(u), 5000);
    });
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (selectedCustomer) loadThread(selectedCustomer);
  }, [selectedCustomer]);

  useEffect(() => {
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  }, [messages]);

  const loadAll = async (u) => {
    const [custs, msgs, offs, revs, recs] = await Promise.all([
      base44.entities.Customer.filter({ created_by: u.email }, "full_name", 500),
      base44.entities.CustomerMessage.filter({ shop_owner_email: u.email }, "-sent_at", 200),
      base44.entities.ShopOffer.filter({ shop_owner_email: u.email }, "-created_date", 50),
      base44.entities.CustomerReview.filter({ shop_owner_email: u.email }, "-created_date", 50),
      base44.entities.CarRecommendation.filter({ shop_owner_email: u.email }, "-created_date", 50),
    ]);
    setCustomers(custs);
    setOffers(offs);
    setReviews(revs);
    setRecommendations(recs);
    // Build inbox: latest message per customer
    buildInbox(msgs, custs);
  };

  const refreshInbox = async (u) => {
    const msgs = await base44.entities.CustomerMessage.filter({ shop_owner_email: u.email }, "-sent_at", 200);
    buildInbox(msgs, customers);
    if (selectedCustomer) {
      const thread = msgs.filter(m => m.customer_id === selectedCustomer.id).sort((a,b) => new Date(a.sent_at) - new Date(b.sent_at));
      setMessages(thread);
    }
  };

  const buildInbox = (msgs, custs) => {
    const map = {};
    msgs.forEach(m => {
      if (!map[m.customer_id] || new Date(m.sent_at) > new Date(map[m.customer_id].sent_at)) {
        map[m.customer_id] = m;
      }
    });
    const inboxList = Object.values(map).sort((a,b) => new Date(b.sent_at) - new Date(a.sent_at));
    setInbox(inboxList);
  };

  const loadThread = async (cust) => {
    const msgs = await base44.entities.CustomerMessage.filter({ customer_id: cust.id }, "sent_at", 200);
    setMessages(msgs);
    // Mark shop messages as read
    msgs.filter(m => m.sender==="customer" && !m.read_by_shop).forEach(m =>
      base44.entities.CustomerMessage.update(m.id, { read_by_shop: true })
    );
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedCustomer || !user) return;
    setSending(true);
    const msg = {
      shop_owner_email: user.email,
      customer_id: selectedCustomer.id,
      customer_phone: selectedCustomer.phone,
      customer_name: selectedCustomer.full_name,
      sender: "shop",
      message: newMsg.trim(),
      sent_at: new Date().toISOString(),
      read_by_shop: true,
      read_by_customer: false,
    };
    const created = await base44.entities.CustomerMessage.create(msg);
    setMessages(prev => [...prev, created]);

    // Create notification for customer
    await base44.entities.CustomerNotification.create({
      shop_owner_email: user.email,
      customer_id: selectedCustomer.id,
      customer_phone: selectedCustomer.phone,
      type: "message",
      title: "New message from the shop",
      body: newMsg.trim().slice(0, 80),
      is_read: false,
      sent_at: new Date().toISOString(),
    });

    setNewMsg(""); setSending(false);
  };

  const createOffer = async () => {
    if (!offerForm.title || !user) return;
    setSavingOffer(true);
    const o = await base44.entities.ShopOffer.create({
      ...offerForm,
      shop_owner_email: user.email,
      shop_name: user.full_name || user.email.split("@")[0],
    });
    setOffers(prev => [o, ...prev]);
    setOfferForm({ title:"", description:"", valid_until:"", is_active:true });
    setShowOfferForm(false);
    setSavingOffer(false);
  };

  const deleteOffer = async (id) => {
    await base44.entities.ShopOffer.delete(id);
    setOffers(prev => prev.filter(o => o.id !== id));
  };

  const createRecommendation = async () => {
    if (!recForm.title || !selectedCustomer || !user) return;
    setSavingRec(true);
    const rec = await base44.entities.CarRecommendation.create({
      ...recForm,
      shop_owner_email: user.email,
      customer_id: selectedCustomer.id,
      estimated_cost: Number(recForm.estimated_cost) || null,
    });
    setRecommendations(prev => [rec, ...prev]);

    // Notify customer
    await base44.entities.CustomerNotification.create({
      shop_owner_email: user.email,
      customer_id: selectedCustomer.id,
      customer_phone: selectedCustomer.phone,
      type: "recommendation",
      title: `⚠️ Shop Recommendation: ${recForm.title}`,
      body: recForm.description,
      is_read: false,
      sent_at: new Date().toISOString(),
    });

    setRecForm({ title:"", description:"", urgency:"medium", estimated_cost:"", vehicle_info:"" });
    setShowRecForm(false);
    setSavingRec(false);
  };

  const replyToReview = async (review) => {
    if (!replyText.trim()) return;
    await base44.entities.CustomerReview.update(review.id, {
      shop_reply: replyText.trim(),
      shop_replied_at: new Date().toISOString(),
    });
    setReviews(prev => prev.map(r => r.id===review.id ? {...r, shop_reply: replyText.trim()} : r));
    setReplyingTo(null); setReplyText("");
  };

  // LBC Hub (lbc-hub.com) is the public customer-facing site — this internal app's own
  // preview/production URL is never what customers should see. Map each shop owner's login
  // email to the short slug LBC Hub's /services page expects.
  const SHOP_SLUGS = {
    "mokhtartareksamara@gmail.com": "mokhtar",
    "belalautoservices@gmail.com": "belal",
    "hajwheels@gmail.com": "haj",
    "aka.auto.group@gmail.com": "aka",
  };

  const getPortalLink = () => {
    // Public LBC Hub Services page, pre-filled with this shop's slug via ?shop= so
    // customers land straight on the phone-number step — no shop email to type or remember.
    const slug = user?.email ? SHOP_SLUGS[user.email] : null;
    const shopParam = slug ? `?shop=${encodeURIComponent(slug)}` : "";
    return `https://lbc-hub.com/services${shopParam}`;
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s,r) => s + r.rating, 0) / reviews.length).toFixed(1) : null;

  const unreadFromCustomers = inbox.filter(m => m.sender==="customer" && !m.read_by_shop).length;

  const S = {
    card: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:18, marginBottom:12 },
    input: { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:14, boxSizing:"border-box", fontFamily:"inherit" },
    label: { color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6, display:"block" },
    btn: (color="blue") => ({
      background: color==="blue" ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : color==="green" ? "linear-gradient(135deg,#166534,#15803d)" : "linear-gradient(135deg,#92400e,#b45309)",
      border:"none", borderRadius:10, padding:"10px 16px", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer",
    }),
  };

  const tabs = [
    { id:"messages", label:"💬 Messages", badge: unreadFromCustomers },
    { id:"offers",   label:"🏷️ Offers" },
    { id:"reviews",  label:`⭐ Reviews${avgRating ? ` (${avgRating})` : ""}` },
    { id:"share",    label:"🔗 Share" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0f1a] p-4 pb-8" style={{ fontFamily:"inherit" }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:0 }}>Customer Hub</h1>
          <p style={{ color:"#64748b", fontSize:13, margin:"4px 0 0" }}>Manage customer communications, offers & reviews</p>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
          {[
            { label:"Customers", val: customers.length, color:"#38bdf8" },
            { label:"Messages", val: inbox.length, color:"#a78bfa" },
            { label:"Offers", val: offers.filter(o=>o.is_active).length, color:"#fbbf24" },
            { label:"Reviews", val: reviews.length, color:"#4ade80" },
          ].map(s => (
            <div key={s.label} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"12px 8px", textAlign:"center" }}>
              <div style={{ color:s.color, fontSize:22, fontWeight:800 }}>{s.val}</div>
              <div style={{ color:"#475569", fontSize:10 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", background:"#0f172a", borderRadius:12, padding:4, marginBottom:16, gap:2 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex:1, padding:"10px 4px", background: activeTab===t.id ? "#1e293b" : "transparent",
              border:"none", borderRadius:10, color: activeTab===t.id ? "#fff" : "#475569",
              fontSize:11, fontWeight:700, cursor:"pointer", position:"relative", whiteSpace:"nowrap",
            }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ position:"absolute", top:4, right:4, width:14, height:14, background:"#ef4444", borderRadius:"50%", fontSize:8, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══ MESSAGES ══ */}
        {activeTab === "messages" && (
          <div style={{ display:"grid", gridTemplateColumns: selectedCustomer ? "1fr 1.6fr" : "1fr", gap:12 }}>

            {/* Inbox list */}
            <div>
              <p style={{ ...S.label, marginBottom:10 }}>Customer Threads</p>
              {inbox.length === 0 && customers.length > 0 && (
                <p style={{ color:"#475569", fontSize:13 }}>No messages yet. Select a customer to start chatting.</p>
              )}
              {/* Customer picker when no messages yet */}
              {inbox.length === 0 && (
                <div style={{ maxHeight:400, overflowY:"auto" }}>
                  {customers.slice(0,20).map(c => (
                    <button key={c.id} onClick={() => setSelectedCustomer(c)} style={{
                      width:"100%", background: selectedCustomer?.id===c.id ? "#1e293b" : "#0f172a",
                      border:`1px solid ${selectedCustomer?.id===c.id ? "rgba(56,189,248,0.4)" : "#1e293b"}`,
                      borderRadius:12, padding:"10px 14px", cursor:"pointer", textAlign:"left", marginBottom:6,
                      display:"flex", alignItems:"center", gap:10,
                    }}>
                      <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#fff", flexShrink:0 }}>
                        {c.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color:"#fff", fontSize:13, fontWeight:600, margin:0 }}>{c.full_name}</p>
                        <p style={{ color:"#64748b", fontSize:11, margin:0 }}>{c.phone}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {inbox.map(m => {
                const cust = customers.find(c => c.id === m.customer_id);
                if (!cust) return null;
                const unread = m.sender === "customer" && !m.read_by_shop;
                return (
                  <button key={m.customer_id} onClick={() => setSelectedCustomer(cust)} style={{
                    width:"100%", background: selectedCustomer?.id===cust.id ? "#1e293b" : "#0f172a",
                    border:`1px solid ${selectedCustomer?.id===cust.id ? "rgba(56,189,248,0.4)" : unread ? "rgba(239,68,68,0.3)" : "#1e293b"}`,
                    borderRadius:12, padding:"10px 12px", cursor:"pointer", textAlign:"left", marginBottom:6,
                    display:"flex", alignItems:"center", gap:10,
                  }}>
                    <div style={{ position:"relative" }}>
                      <div style={{ width:34, height:34, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff" }}>
                        {cust.full_name?.charAt(0).toUpperCase()}
                      </div>
                      {unread && <div style={{ position:"absolute", top:-2, right:-2, width:10, height:10, background:"#ef4444", borderRadius:"50%", border:"2px solid #0f172a" }}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ color: unread ? "#fff" : "#94a3b8", fontSize:13, fontWeight: unread ? 700 : 500, margin:0 }}>{cust.full_name}</p>
                      <p style={{ color:"#475569", fontSize:11, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{m.message}</p>
                    </div>
                    <span style={{ color:"#334155", fontSize:10 }}>{timeAgo(m.sent_at)}</span>
                  </button>
                );
              })}
            </div>

            {/* Thread */}
            {selectedCustomer && (
              <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                {/* Thread header */}
                <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:"12px 12px 0 0", padding:"12px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{selectedCustomer.full_name}</p>
                    <p style={{ color:"#64748b", fontSize:11, margin:0 }}>{selectedCustomer.phone}</p>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => { setShowRecForm(true); }} style={{ background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:8, padding:"4px 10px", color:"#fbbf24", cursor:"pointer", fontSize:11, fontWeight:700 }}>
                      + Rec
                    </button>
                    <button onClick={() => setSelectedCustomer(null)} style={{ background:"transparent", border:"none", color:"#64748b", cursor:"pointer" }}>
                      <X style={{ width:16, height:16 }}/>
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div style={{ background:"#070d18", border:"1px solid #1e293b", borderLeft:"1px solid #1e293b", borderRight:"1px solid #1e293b", padding:14, maxHeight:350, overflowY:"auto", display:"flex", flexDirection:"column", gap:8 }}>
                  {messages.length === 0 && (
                    <p style={{ color:"#334155", textAlign:"center", fontSize:13, padding:20 }}>Start the conversation</p>
                  )}
                  {messages.map(m => (
                    <div key={m.id} style={{ display:"flex", justifyContent: m.sender==="shop" ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth:"80%",
                        background: m.sender==="shop" ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#1e293b",
                        borderRadius: m.sender==="shop" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        padding:"8px 12px",
                      }}>
                        <p style={{ color:"#fff", fontSize:13, margin:0 }}>{m.message}</p>
                        <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, margin:"3px 0 0", textAlign: m.sender==="shop" ? "right" : "left" }}>{timeAgo(m.sent_at)}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={msgEndRef}/>
                </div>

                {/* Compose */}
                <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"10px 12px", display:"flex", gap:8 }}>
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && sendMessage()}
                    placeholder={`Message ${selectedCustomer.full_name}...`}
                    style={{ ...S.input, flex:1, padding:"10px 12px", borderRadius:10 }}
                  />
                  <button onClick={sendMessage} disabled={sending || !newMsg.trim()} style={{
                    background:"linear-gradient(135deg,#1d4ed8,#2563eb)", border:"none", borderRadius:10,
                    padding:"0 14px", color:"#fff", cursor:"pointer", opacity: !newMsg.trim() ? 0.4 : 1,
                  }}>
                    <Send style={{ width:16, height:16 }}/>
                  </button>
                </div>

                {/* Recommendation form */}
                {showRecForm && (
                  <div style={{ ...S.card, marginTop:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                      <p style={{ color:"#fbbf24", fontSize:13, fontWeight:700, margin:0 }}>⚠️ Add Recommendation</p>
                      <button onClick={() => setShowRecForm(false)} style={{ background:"transparent", border:"none", color:"#64748b", cursor:"pointer" }}><X style={{ width:14, height:14 }}/></button>
                    </div>
                    <input style={{ ...S.input, marginBottom:8 }} placeholder="e.g. Brake pads need replacement" value={recForm.title} onChange={e => setRecForm(f => ({...f,title:e.target.value}))}/>
                    <input style={{ ...S.input, marginBottom:8 }} placeholder="Description (optional)" value={recForm.description} onChange={e => setRecForm(f => ({...f,description:e.target.value}))}/>
                    <input style={{ ...S.input, marginBottom:8 }} placeholder="Vehicle (e.g. 2019 Honda Civic)" value={recForm.vehicle_info} onChange={e => setRecForm(f => ({...f,vehicle_info:e.target.value}))}/>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                      <select style={{ ...S.input }} value={recForm.urgency} onChange={e => setRecForm(f => ({...f,urgency:e.target.value}))}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">🚨 Critical</option>
                      </select>
                      <input style={S.input} type="number" placeholder="Est. cost $" value={recForm.estimated_cost} onChange={e => setRecForm(f => ({...f,estimated_cost:e.target.value}))}/>
                    </div>
                    <button onClick={createRecommendation} disabled={savingRec} style={S.btn("green")}>
                      {savingRec ? "Sending..." : "Send to Customer"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ OFFERS ══ */}
        {activeTab === "offers" && (
          <>
            <button onClick={() => setShowOfferForm(!showOfferForm)} style={{ ...S.btn("blue"), display:"flex", alignItems:"center", gap:6, marginBottom:16 }}>
              <Plus style={{ width:14, height:14 }}/> New Offer
            </button>

            {showOfferForm && (
              <div style={{ ...S.card, border:"1px solid rgba(56,189,248,0.3)", marginBottom:16 }}>
                <p style={{ color:"#38bdf8", fontSize:14, fontWeight:700, marginBottom:14 }}>Create Shop Offer</p>
                <input style={{ ...S.input, marginBottom:8 }} placeholder="Offer title e.g. '20% off oil change this week!'" value={offerForm.title} onChange={e => setOfferForm(f => ({...f,title:e.target.value}))}/>
                <textarea rows={3} style={{ ...S.input, resize:"vertical", marginBottom:8 }} placeholder="Description (optional)" value={offerForm.description} onChange={e => setOfferForm(f => ({...f,description:e.target.value}))}/>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div>
                    <span style={S.label}>Valid Until</span>
                    <input type="date" style={S.input} value={offerForm.valid_until} onChange={e => setOfferForm(f => ({...f,valid_until:e.target.value}))}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={createOffer} disabled={savingOffer} style={S.btn("blue")}>
                    {savingOffer ? "Posting..." : "Post Offer"}
                  </button>
                  <button onClick={() => setShowOfferForm(false)} style={{ background:"#1e293b", border:"none", borderRadius:10, padding:"10px 14px", color:"#64748b", cursor:"pointer", fontSize:13 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {offers.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Tag style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No offers yet. Create your first promotion!</p>
              </div>
            ) : offers.map(o => (
              <div key={o.id} style={S.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div style={{ flex:1 }}>
                    <p style={{ color:"#fff", fontSize:15, fontWeight:700, margin:0 }}>{o.title}</p>
                    {o.description && <p style={{ color:"#94a3b8", fontSize:13, margin:"4px 0 0" }}>{o.description}</p>}
                    {o.valid_until && <p style={{ color:"#fbbf24", fontSize:11, margin:"4px 0 0" }}>📅 Until {o.valid_until}</p>}
                  </div>
                  <button onClick={() => deleteOffer(o.id)} style={{ background:"transparent", border:"none", color:"#475569", cursor:"pointer", padding:4 }}>
                    <Trash2 style={{ width:14, height:14 }}/>
                  </button>
                </div>
                {/* Reactions summary */}
                {o.reactions && Object.keys(o.reactions).length > 0 && (
                  <div style={{ display:"flex", gap:8, marginTop:10, flexWrap:"wrap" }}>
                    {Object.entries(o.reactions).map(([k,v]) => v > 0 && (
                      <span key={k} style={{ background:"#1e293b", borderRadius:20, padding:"2px 10px", fontSize:12 }}>
                        {{"thumbsup":"👍","fire":"🔥","heart":"❤️","wow":"😮"}[k] || k} {v}
                      </span>
                    ))}
                  </div>
                )}
                {/* Comments */}
                {(o.comments||[]).length > 0 && (
                  <div style={{ marginTop:10, borderTop:"1px solid #1e293b", paddingTop:10 }}>
                    <p style={{ ...S.label, marginBottom:6 }}>Comments ({o.comments.length})</p>
                    {o.comments.slice(-3).map((c,i) => (
                      <div key={i} style={{ marginBottom:6 }}>
                        <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, margin:0 }}>{c.customer_name}</p>
                        <p style={{ color:"#94a3b8", fontSize:12, margin:"2px 0 0" }}>{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ══ REVIEWS ══ */}
        {activeTab === "reviews" && (
          <>
            {avgRating && (
              <div style={{ ...S.card, background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.2)", textAlign:"center", marginBottom:16 }}>
                <p style={{ color:"#fbbf24", fontSize:42, fontWeight:800, margin:0 }}>{avgRating}</p>
                <div style={{ display:"flex", justifyContent:"center", gap:4, margin:"6px 0" }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ fontSize:20, color: i <= Math.round(avgRating) ? "#fbbf24" : "#334155" }}>★</span>
                  ))}
                </div>
                <p style={{ color:"#64748b", fontSize:13, margin:0 }}>{reviews.length} review{reviews.length!==1?"s":""}</p>
              </div>
            )}

            {reviews.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Star style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No reviews yet. Share the portal link with customers!</p>
              </div>
            ) : reviews.map(r => (
              <div key={r.id} style={S.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{r.customer_name}</p>
                    <div style={{ display:"flex", gap:2, marginTop:4 }}>
                      {[1,2,3,4,5].map(i => <span key={i} style={{ fontSize:14, color: i<=r.rating ? "#fbbf24" : "#334155" }}>★</span>)}
                    </div>
                  </div>
                  <p style={{ color:"#475569", fontSize:11 }}>{r.created_date?.slice(0,10)}</p>
                </div>
                {r.review_text && <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6, margin:"6px 0 10px" }}>&ldquo;{r.review_text}&rdquo;</p>}

                {/* Shop reply */}
                {r.shop_reply ? (
                  <div style={{ background:"rgba(56,189,248,0.06)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:10, padding:"8px 12px" }}>
                    <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, margin:"0 0 4px" }}>Your Reply</p>
                    <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>{r.shop_reply}</p>
                  </div>
                ) : (
                  replyingTo === r.id ? (
                    <div style={{ display:"flex", gap:8 }}>
                      <input
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Write your reply..."
                        style={{ ...S.input, flex:1 }}
                        onKeyDown={e => e.key==="Enter" && replyToReview(r)}
                      />
                      <button onClick={() => replyToReview(r)} style={S.btn("blue")}>Reply</button>
                      <button onClick={() => setReplyingTo(null)} style={{ background:"#1e293b", border:"none", borderRadius:10, padding:"8px 12px", color:"#64748b", cursor:"pointer" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyingTo(r.id)} style={{ background:"transparent", border:"1px solid #334155", borderRadius:8, padding:"5px 12px", color:"#64748b", cursor:"pointer", fontSize:12 }}>
                      Reply
                    </button>
                  )
                )}
              </div>
            ))}
          </>
        )}

        {/* ══ SHARE ══ */}
        {activeTab === "share" && (
          <div style={S.card}>
            <h3 style={{ color:"#fff", fontSize:16, fontWeight:800, marginBottom:6 }}>Customer Portal Link</h3>
            <p style={{ color:"#64748b", fontSize:13, lineHeight:1.6, marginBottom:16 }}>
              Share this link with your customers. Your shop is already built in — they just enter their phone number to see their car history, messages, and your offers.
            </p>

            <div style={{ background:"#1e293b", borderRadius:10, padding:"10px 14px", fontSize:12, color:"#94a3b8", wordBreak:"break-all", fontFamily:"monospace", marginBottom:12 }}>
              {getPortalLink()}
            </div>

            <button onClick={() => { navigator.clipboard.writeText(getPortalLink()); setCopied(true); setTimeout(()=>setCopied(false),2500); }} style={{
              ...S.btn(copied ? "green" : "blue"),
              display:"flex", alignItems:"center", gap:6, width:"100%", justifyContent:"center", marginBottom:20,
            }}>
              {copied ? <><CheckCheck style={{ width:14, height:14 }}/> Copied!</> : <><Copy style={{ width:14, height:14 }}/> Copy Portal Link</>}
            </button>

            <div style={{ borderTop:"1px solid #1e293b", paddingTop:16 }}>
              <p style={{ ...S.label, marginBottom:10 }}>How customers log in:</p>
              {[
                { step:"1", text:"Open the portal link" },
                { step:"2", text:`Type your shop email: ${user?.email || "your@email.com"}` },
                { step:"3", text:"Type their phone number (must be on file)" },
                { step:"4", text:"Access their car history, messages & your offers" },
              ].map(s => (
                <div key={s.step} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:10 }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:"rgba(56,189,248,0.15)", border:"1px solid rgba(56,189,248,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#38bdf8", fontSize:11, fontWeight:700 }}>
                    {s.step}
                  </div>
                  <p style={{ color:"#94a3b8", fontSize:13, margin:0, lineHeight:1.5 }}>{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
