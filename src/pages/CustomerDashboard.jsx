import React, { useState, useEffect, useRef } from "react";
import {
  Car, MessageSquare, Bell, Tag, Star, Wrench,
  Send, X, ChevronRight, LogOut, ThumbsUp, Flame,
  Heart, Gauge, AlertTriangle, CheckCircle2, Clock,
  Image, ArrowLeft
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import CustomerAIChat from "@/components/shared/CustomerAIChat";

const REACTIONS = [
  { emoji:"👍", key:"thumbsup" },
  { emoji:"🔥", key:"fire" },
  { emoji:"❤️",  key:"heart" },
  { emoji:"😮", key:"wow" },
];

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

function UrgencyBadge({ urgency }) {
  const map = {
    critical: { bg:"rgba(239,68,68,0.15)", color:"#f87171", border:"rgba(239,68,68,0.3)", label:"🚨 Critical" },
    high:     { bg:"rgba(251,191,36,0.15)", color:"#fbbf24", border:"rgba(251,191,36,0.3)", label:"⚠️ High" },
    medium:   { bg:"rgba(56,189,248,0.15)", color:"#38bdf8", border:"rgba(56,189,248,0.3)", label:"🔧 Medium" },
    low:      { bg:"rgba(74,222,128,0.15)", color:"#4ade80", border:"rgba(74,222,128,0.3)", label:"✅ Low" },
  };
  const s = map[urgency] || map.low;
  return <span style={{ background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{s.label}</span>;
}

export default function CustomerDashboard() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [loading, setLoading] = useState(true);

  // Data
  const [vehicles, setVehicles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [offers, setOffers] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [myReview, setMyReview] = useState(null);

  // Message compose
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgEndRef = useRef(null);
  const pollRef = useRef(null);

  // Review compose
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("customer_session");
    if (!saved) { window.location.href = "/CustomerPortal"; return; }
    const sess = JSON.parse(saved);
    setSession(sess);
    loadAll(sess);

    // Poll messages + notifications every 5s
    pollRef.current = setInterval(() => refreshMessages(sess), 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    if (activeTab === "messages") {
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
    }
  }, [messages, activeTab]);

  const loadAll = async (sess) => {
    try {
      const d = await (await fetch("/api/functions/customerData", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        customer_id: sess.customer_id,
        shop_email: sess.shop_email,
      }) })).json();
      setVehicles(d.vehicles || []); setOrders(d.orders || []); setInvoices(d.invoices || []);
      setEstimates(d.estimates || []); setAppointments(d.appointments || []);
      setMessages(d.messages || []); setNotifications(d.notifications || []);
      setOffers(d.offers || []); setRecommendations(d.recommendations || []);
      setReviews(d.reviews || []);
      if (d.reviews?.length > 0) { setMyReview(d.reviews[0]); setReviewDone(true); }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const refreshMessages = async (sess) => {
    try {
      const d = await (await fetch("/api/functions/customerData", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
        customer_id: sess.customer_id,
        shop_email: sess.shop_email,
      }) })).json();
      if (d.messages) setMessages(d.messages);
      if (d.notifications) setNotifications(d.notifications);
    } catch {}
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !session) return;
    setSendingMsg(true);
    const msgPayload = {
      shop_owner_email: session.shop_email,
      customer_id: session.customer_id,
      customer_phone: session.customer_phone,
      customer_name: session.customer_name,
      sender: "customer",
      message: newMsg.trim(),
      sent_at: new Date().toISOString(),
    };
    const data = await base44.functions.invoke("customerSendMessage", msgPayload);
    if (data.message) setMessages(prev => [...prev, data.message]);
    setNewMsg("");
    setSendingMsg(false);
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior:"smooth" }), 100);
  };

  const reactToOffer = async (offer, reactionKey) => {
    const current = offer.reactions || {};
    const updated = { ...current, [reactionKey]: (current[reactionKey] || 0) + 1 };
    await base44.entities.ShopOffer.update(offer.id, { reactions: updated });
    setOffers(prev => prev.map(o => o.id===offer.id ? {...o, reactions: updated} : o));
  };

  const commentOnOffer = async (offer, text) => {
    if (!text.trim()) return;
    const comment = {
      customer_name: session.customer_name,
      customer_phone: session.customer_phone,
      text: text.trim(),
      created_at: new Date().toISOString(),
    };
    const updatedComments = [...(offer.comments || []), comment];
    await base44.entities.ShopOffer.update(offer.id, { comments: updatedComments });
    setOffers(prev => prev.map(o => o.id===offer.id ? {...o, comments: updatedComments} : o));
  };

  const submitReview = async () => {
    if (!reviewRating || !session) return;
    setSubmittingReview(true);
    const rev = await base44.entities.CustomerReview.create({
      shop_owner_email: session.shop_email,
      customer_id: session.customer_id,
      customer_name: session.customer_name,
      customer_phone: session.customer_phone,
      rating: reviewRating,
      review_text: reviewText,
      is_published: true,
    });
    setMyReview(rev);
    setReviewDone(true);
    setSubmittingReview(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const webBookingUnread = notifications.filter(n => !n.is_read && (n.title || "").toLowerCase().includes("web booking")).length;
  const unreadMsgs = messages.filter(m => m.sender === "shop" && !m.read_by_customer).length;

  const S = {
    card: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:18, marginBottom:14 },
    label: { color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" },
  };

  if (loading || !session) return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#38bdf8" }}>Loading your portal...</div>
    </div>
  );

  const tabs = [
    { id:"home",    icon:"🏠", label:"Home" },
    { id:"cars",    icon:"🚗", label:"My Cars" },
    { id:"billing", icon:"🧾", label:"Billing" },
    { id:"messages",icon:"💬", label:"Chat",    badge: unreadMsgs },
    { id:"offers",  icon:"🏷️", label:"Offers" },
    { id:"review",  icon:"⭐", label:"Review" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#020617", fontFamily:"inherit", paddingBottom:80 }}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderBottom:"1px solid rgba(0,170,255,0.2)",
        padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div>
          <h1 style={{ color:"#fff", fontSize:18, fontWeight:800, margin:0 }}>{session.customer_name}</h1>
          <p style={{ color:"#38bdf8", fontSize:12, margin:0, textTransform:"capitalize" }}>{session.shop_name}</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {/* Notifications bell */}
          <button onClick={() => setActiveTab("notifications")} style={{
            position:"relative", background:"transparent", border:"none", cursor:"pointer", padding:4,
          }}>
            <Bell style={{ width:22, height:22, color: unreadCount > 0 ? "#fbbf24" : "#475569" }}/>
            {unreadCount > 0 && (
              <span style={{
                position:"absolute", top:-2, right:-2, width:16, height:16,
                background:"#ef4444", borderRadius:"50%", fontSize:9, color:"#fff",
                display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700,
              }}>{unreadCount}</span>
            )}
            {webBookingUnread > 0 && (
              <span style={{
                position:"absolute", bottom:-1, left:-1, width:9, height:9,
                background:"#10b981", borderRadius:"50%", border:"2px solid #0a0f1a",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:7,
              }}>🌐</span>
            )}
          </button>
          <button onClick={() => { sessionStorage.removeItem("customer_session"); window.location.href="/CustomerPortal"; }}
            style={{ background:"transparent", border:"1px solid #334155", borderRadius:8, padding:"6px 10px", color:"#64748b", cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
            <LogOut style={{ width:13, height:13 }}/> Out
          </button>
        </div>
      </div>

      <div style={{ padding:16 }}>

        {/* ══ HOME ══ */}
        {activeTab === "home" && (
          <>
            {/* Recommendations alert */}
            {recommendations.length > 0 && (
              <div style={{ ...S.card, background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.25)", marginBottom:14 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <AlertTriangle style={{ width:18, height:18, color:"#f87171" }}/>
                  <p style={{ color:"#f87171", fontSize:14, fontWeight:800, margin:0 }}>Shop Recommendations</p>
                </div>
                {recommendations.slice(0,3).map(rec => (
                  <div key={rec.id} style={{ borderBottom:"1px solid #1e293b", paddingBottom:10, marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:0, flex:1 }}>{rec.title}</p>
                      <UrgencyBadge urgency={rec.urgency}/>
                    </div>
                    {rec.description && <p style={{ color:"#64748b", fontSize:12, margin:0 }}>{rec.description}</p>}
                    {rec.vehicle_info && <p style={{ color:"#38bdf8", fontSize:11, margin:"4px 0 0" }}>🚗 {rec.vehicle_info}</p>}
                    {rec.estimated_cost && <p style={{ color:"#4ade80", fontSize:12, fontWeight:600, margin:"4px 0 0" }}>Est. ${rec.estimated_cost}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Quick stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
              {[
                { label:"Visits", val: orders.length, color:"#38bdf8" },
                { label:"Invoices", val: invoices.length, color:"#4ade80" },
                { label:"Vehicles", val: vehicles.length, color:"#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:12, padding:"14px 10px", textAlign:"center" }}>
                  <div style={{ color:s.color, fontSize:26, fontWeight:800 }}>{s.val}</div>
                  <div style={{ color:"#475569", fontSize:10, marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Latest vehicle */}
            {vehicles[0] && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:10 }}>Your Vehicle</p>
                <p style={{ color:"#fff", fontSize:17, fontWeight:800, margin:0 }}>
                  {vehicles[0].year} {vehicles[0].make} {vehicles[0].model}
                </p>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:8 }}>
                  {vehicles[0].mileage && (
                    <span style={{ background:"#1e293b", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#38bdf8" }}>
                      📍 {Number(vehicles[0].mileage).toLocaleString()} km
                    </span>
                  )}
                  {vehicles[0].color && <span style={{ background:"#1e293b", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#94a3b8" }}>🎨 {vehicles[0].color}</span>}
                  {vehicles[0].engine_type && <span style={{ background:"#1e293b", borderRadius:6, padding:"4px 8px", fontSize:12, color:"#94a3b8" }}>⚙️ {vehicles[0].engine_type}</span>}
                </div>
                {/* Intake photos */}
                {vehicles[0].intake_photos && Object.values(vehicles[0].intake_photos).some(Boolean) && (
                  <div style={{ display:"flex", gap:6, marginTop:12, overflowX:"auto" }}>
                    {["front","back","driver","passenger","dashboard"].map(k =>
                      vehicles[0].intake_photos[k] && (
                        <img key={k} src={vehicles[0].intake_photos[k]} alt={k}
                          style={{ width:70, height:52, objectFit:"cover", borderRadius:8, flexShrink:0, border:"1px solid #1e293b" }}/>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Latest order */}
            {orders[0] && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:10 }}>Last Service</p>
                <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{orders[0].description || "Service"}</p>
                <p style={{ color:"#64748b", fontSize:12, margin:"4px 0 0" }}>{orders[0].created_date?.slice(0,10)}</p>
                <span style={{
                  display:"inline-block", marginTop:6,
                  background: orders[0].status==="completed" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                  color: orders[0].status==="completed" ? "#4ade80" : "#fbbf24",
                  border:`1px solid ${orders[0].status==="completed" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
                  borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, textTransform:"capitalize",
                }}>{orders[0].status || "pending"}</span>
              </div>
            )}
          </>
        )}

        {/* ══ BILLING (Estimates + Invoices) ══ */}
        {activeTab === "billing" && (
          <>
            {/* Upcoming appointments */}
            {appointments.filter(a => a.status !== "completed" && a.status !== "cancelled").length > 0 && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:10 }}>Upcoming Appointments</p>
                {appointments
                  .filter(a => a.status !== "completed" && a.status !== "cancelled")
                  .map(a => (
                    <div key={a.id} style={{ borderBottom:"1px solid #1e293b", paddingBottom:10, marginBottom:10 }}>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:0 }}>{a.service_type || "Appointment"}</p>
                      <p style={{ color:"#64748b", fontSize:12, margin:"4px 0 0" }}>
                        {a.date ? new Date(a.date).toLocaleDateString() : ""}{a.time_slot ? ` · ${a.time_slot}` : ""}
                      </p>
                    </div>
                  ))}
              </div>
            )}

            {/* Estimates */}
            <div style={S.card}>
              <p style={{ ...S.label, marginBottom:10 }}>Estimates</p>
              {estimates.length === 0 ? (
                <p style={{ color:"#475569", fontSize:13 }}>No estimates yet.</p>
              ) : [...estimates].reverse().map(e => (
                <div key={e.id} style={{ borderBottom:"1px solid #1e293b", paddingBottom:10, marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:0 }}>
                        {e.estimate_number ? `#${e.estimate_number}` : "Estimate"}
                      </p>
                      <p style={{ color:"#64748b", fontSize:11, margin:"2px 0 0" }}>{e.created_date?.slice(0,10)}</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {e.grand_total != null && <p style={{ color:"#38bdf8", fontSize:14, fontWeight:800, margin:0 }}>${Number(e.grand_total).toFixed(2)}</p>}
                      <span style={{
                        display:"inline-block", marginTop:4,
                        background: e.status==="approved" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                        color: e.status==="approved" ? "#4ade80" : "#fbbf24",
                        border:`1px solid ${e.status==="approved" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
                        borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700, textTransform:"capitalize",
                      }}>{e.status || "pending"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Invoices */}
            <div style={S.card}>
              <p style={{ ...S.label, marginBottom:10 }}>Invoices</p>
              {invoices.length === 0 ? (
                <p style={{ color:"#475569", fontSize:13 }}>No invoices yet.</p>
              ) : [...invoices].reverse().map(inv => (
                <div key={inv.id} style={{ borderBottom:"1px solid #1e293b", paddingBottom:10, marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:0 }}>
                        {inv.invoice_number ? `#${inv.invoice_number}` : "Invoice"}
                      </p>
                      <p style={{ color:"#64748b", fontSize:11, margin:"2px 0 0" }}>{inv.created_date?.slice(0,10)}</p>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      {inv.total != null && <p style={{ color:"#4ade80", fontSize:14, fontWeight:800, margin:0 }}>${Number(inv.total).toFixed(2)}</p>}
                      <span style={{
                        display:"inline-block", marginTop:4,
                        background: inv.status==="paid" ? "rgba(74,222,128,0.1)" : "rgba(239,68,68,0.1)",
                        color: inv.status==="paid" ? "#4ade80" : "#f87171",
                        border:`1px solid ${inv.status==="paid" ? "rgba(74,222,128,0.3)" : "rgba(239,68,68,0.3)"}`,
                        borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700, textTransform:"capitalize",
                      }}>{inv.status || "unpaid"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ MY CARS ══ */}
        {activeTab === "cars" && (
          <>
            {vehicles.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Car style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No vehicles on file yet.</p>
              </div>
            ) : vehicles.map(v => (
              <div key={v.id} style={S.card}>
                <p style={{ color:"#fff", fontSize:17, fontWeight:800, margin:"0 0 8px" }}>
                  {v.year} {v.make} {v.model}
                  {v.trim && <span style={{ color:"#64748b", fontWeight:400, fontSize:13 }}> · {v.trim}</span>}
                </p>

                {/* Specs */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                  {[
                    v.engine_type && `⚙️ ${v.engine_type}`,
                    v.fuel_type && `⛽ ${v.fuel_type}`,
                    v.drive_type && `🔄 ${v.drive_type}`,
                    v.color && `🎨 ${v.color}`,
                    v.license_plate && `🪪 ${v.license_plate}`,
                  ].filter(Boolean).map((s,i) => (
                    <span key={i} style={{ background:"#1e293b", borderRadius:6, padding:"4px 8px", fontSize:11, color:"#94a3b8" }}>{s}</span>
                  ))}
                </div>

                {/* Mileage */}
                {v.mileage && (
                  <div style={{ background:"#1e293b", borderRadius:10, padding:"10px 14px", marginBottom:12 }}>
                    <p style={{ ...S.label, margin:0 }}>Current Mileage</p>
                    <p style={{ color:"#38bdf8", fontSize:20, fontWeight:800, margin:"4px 0 0" }}>
                      {Number(v.mileage).toLocaleString()} km
                    </p>
                  </div>
                )}

                {/* Mileage history */}
                {v.mileage_history?.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <p style={{ ...S.label, marginBottom:8 }}>Visit History</p>
                    {[...v.mileage_history].reverse().map((h,i) => (
                      <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #1e293b" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <div style={{ width:6, height:6, borderRadius:"50%", background:"#38bdf8" }}/>
                          <span style={{ color:"#94a3b8", fontSize:13 }}>{h.date}</span>
                        </div>
                        <span style={{ color:"#38bdf8", fontSize:13, fontWeight:700 }}>
                          {Number(h.mileage).toLocaleString()} km
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Intake photos */}
                {v.intake_photos && Object.values(v.intake_photos).some(Boolean) && (
                  <div>
                    <p style={{ ...S.label, marginBottom:6 }}>Intake Photos</p>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6 }}>
                      {["front","back","driver","passenger","dashboard"].map(k => v.intake_photos[k] && (
                        <div key={k} style={{ borderRadius:8, overflow:"hidden", aspectRatio:"4/3", position:"relative" }}>
                          <img src={v.intake_photos[k]} alt={k} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(0,0,0,0.6)", padding:"2px 6px", fontSize:9, color:"#94a3b8", textTransform:"capitalize" }}>{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {v.vin && <p style={{ color:"#334155", fontSize:10, fontFamily:"monospace", marginTop:10 }}>VIN: {v.vin}</p>}
              </div>
            ))}

            {/* Service history */}
            {orders.length > 0 && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:12 }}>Service Records</p>
                {orders.map(o => (
                  <div key={o.id} style={{ borderBottom:"1px solid #1e293b", paddingBottom:10, marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:700, margin:0 }}>{o.description || "Service"}</p>
                      <span style={{
                        background: o.status==="completed" ? "rgba(74,222,128,0.1)" : "rgba(56,189,248,0.1)",
                        color: o.status==="completed" ? "#4ade80" : "#38bdf8",
                        borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:700,
                        border:`1px solid ${o.status==="completed" ? "rgba(74,222,128,0.3)" : "rgba(56,189,248,0.3)"}`,
                      }}>{o.status || "pending"}</span>
                    </div>
                    <p style={{ color:"#64748b", fontSize:12, margin:"3px 0 0" }}>{o.created_date?.slice(0,10)}</p>
                    {o.mileage && <p style={{ color:"#38bdf8", fontSize:11, margin:"2px 0 0" }}>📍 {Number(o.mileage).toLocaleString()} km</p>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ MESSAGES ══ */}
        {activeTab === "messages" && (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            <div style={{ ...S.card, maxHeight:500, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, padding:14 }}>
              {messages.length === 0 && (
                <p style={{ color:"#475569", textAlign:"center", padding:20, fontSize:14 }}>
                  No messages yet. Send the shop a message!
                </p>
              )}
              {messages.map(m => (
                <div key={m.id} style={{
                  display:"flex",
                  justifyContent: m.sender==="customer" ? "flex-end" : "flex-start",
                }}>
                  <div style={{
                    maxWidth:"80%",
                    background: m.sender==="customer" ? "linear-gradient(135deg,#1d4ed8,#2563eb)" : "#1e293b",
                    borderRadius: m.sender==="customer" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    padding:"10px 14px",
                  }}>
                    {m.sender==="shop" && (
                      <p style={{ color:"#38bdf8", fontSize:10, fontWeight:700, margin:"0 0 4px", textTransform:"capitalize" }}>
                        {session.shop_name}
                      </p>
                    )}
                    <p style={{ color:"#fff", fontSize:14, margin:0, lineHeight:1.5 }}>{m.message}</p>
                    <p style={{ color: m.sender==="customer" ? "rgba(255,255,255,0.5)" : "#475569", fontSize:10, margin:"4px 0 0", textAlign: m.sender==="customer" ? "right" : "left" }}>
                      {timeAgo(m.sent_at)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={msgEndRef}/>
            </div>

            {/* Compose */}
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              <input
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key==="Enter" && !e.shiftKey && sendMessage()}
                placeholder="Message the shop..."
                style={{
                  flex:1, background:"#0f172a", border:"1px solid #1e293b",
                  borderRadius:14, padding:"14px 16px", color:"#fff",
                  fontSize:15, fontFamily:"inherit", outline:"none",
                }}
              />
              <button onClick={sendMessage} disabled={sendingMsg || !newMsg.trim()} style={{
                background:"linear-gradient(135deg,#1d4ed8,#2563eb)",
                border:"none", borderRadius:14, padding:"0 18px",
                color:"#fff", cursor:"pointer", display:"flex", alignItems:"center",
                opacity: !newMsg.trim() ? 0.4 : 1,
              }}>
                <Send style={{ width:18, height:18 }}/>
              </button>
            </div>
          </div>
        )}

        {/* ══ OFFERS ══ */}
        {activeTab === "offers" && (
          <>
            {offers.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Tag style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No active offers right now. Check back soon!</p>
              </div>
            ) : offers.map(offer => (
              <OfferCard key={offer.id} offer={offer} session={session} onReact={reactToOffer} onComment={commentOnOffer}/>
            ))}
          </>
        )}

        {/* ══ REVIEW ══ */}
        {activeTab === "review" && (
          <div style={S.card}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <Star style={{ width:40, height:40, color:"#fbbf24", margin:"0 auto 10px" }}/>
              <h2 style={{ color:"#fff", fontSize:18, fontWeight:800, margin:0 }}>Rate Your Experience</h2>
              <p style={{ color:"#64748b", fontSize:13, marginTop:4, textTransform:"capitalize" }}>{session.shop_name}</p>
            </div>

            {reviewDone && myReview ? (
              <div style={{ textAlign:"center" }}>
                <CheckCircle2 style={{ width:40, height:40, color:"#4ade80", margin:"0 auto 12px" }}/>
                <p style={{ color:"#4ade80", fontSize:16, fontWeight:700 }}>Review Submitted!</p>
                <div style={{ display:"flex", justifyContent:"center", gap:4, marginTop:8 }}>
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} style={{ width:24, height:24, color: i<=myReview.rating ? "#fbbf24" : "#334155", fill: i<=myReview.rating ? "#fbbf24" : "none" }}/>
                  ))}
                </div>
                {myReview.review_text && <p style={{ color:"#94a3b8", fontSize:14, marginTop:12, lineHeight:1.6 }}>&ldquo;{myReview.review_text}&rdquo;</p>}
                {myReview.shop_reply && (
                  <div style={{ background:"rgba(56,189,248,0.08)", border:"1px solid rgba(56,189,248,0.2)", borderRadius:10, padding:"10px 14px", marginTop:14, textAlign:"left" }}>
                    <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, margin:"0 0 4px", textTransform:"capitalize" }}>Reply from {session.shop_name}</p>
                    <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>{myReview.shop_reply}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Stars */}
                <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:20 }}>
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onClick={() => setReviewRating(i)} style={{ background:"transparent", border:"none", cursor:"pointer", padding:4 }}>
                      <Star style={{ width:36, height:36, color: i<=reviewRating ? "#fbbf24" : "#334155", fill: i<=reviewRating ? "#fbbf24" : "none", transition:"all 0.1s" }}/>
                    </button>
                  ))}
                </div>
                {reviewRating > 0 && (
                  <p style={{ color:"#94a3b8", textAlign:"center", fontSize:13, marginBottom:16 }}>
                    {["","😞 Poor","😐 Below average","😊 Good","😃 Very good","🤩 Excellent!"][reviewRating]}
                  </p>
                )}
                <textarea
                  value={reviewText}
                  onChange={e => setReviewText(e.target.value)}
                  placeholder="Tell us about your experience (optional)..."
                  rows={4}
                  style={{ width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"12px 14px", color:"#fff", fontSize:14, fontFamily:"inherit", boxSizing:"border-box", resize:"vertical", marginBottom:14 }}
                />
                <button onClick={submitReview} disabled={!reviewRating || submittingReview} style={{
                  width:"100%", background:"linear-gradient(135deg,#d97706,#b45309)",
                  border:"none", borderRadius:12, padding:"14px",
                  color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer",
                  opacity: !reviewRating ? 0.4 : 1,
                }}>
                  {submittingReview ? "Submitting..." : "⭐ Submit Review"}
                </button>
              </>
            )}
          </div>
        )}

        {/* ══ NOTIFICATIONS ══ */}
        {activeTab === "notifications" && (
          <>
            <button onClick={() => setActiveTab("home")} style={{ background:"transparent", border:"none", color:"#38bdf8", cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:13, marginBottom:12, padding:0 }}>
              <ArrowLeft style={{ width:14, height:14 }}/> Back
            </button>
            {notifications.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Bell style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No notifications yet.</p>
              </div>
            ) : notifications.map(n => {
              const isWebBooking = (n.title || "").toLowerCase().includes("web booking");
              return (
              <div key={n.id} style={{ ...S.card, borderLeft:`3px solid ${isWebBooking ? "#10b981" : (n.is_read ? "#1e293b" : "#38bdf8")}`, ...(isWebBooking ? { background:"#052e1a", borderColor:"#10b98144" } : {}) }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <p style={{ color: isWebBooking ? "#34d399" : (n.is_read ? "#94a3b8" : "#fff"), fontSize:14, fontWeight: n.is_read ? 400 : 700, margin:0, display:"flex", alignItems:"center", gap:6 }}>
                    {isWebBooking && <span style={{ fontSize:15 }}>🌐</span>}{n.title}
                  </p>
                  <span style={{ color:"#475569", fontSize:10 }}>{timeAgo(n.sent_at)}</span>
                </div>
                {n.body && <p style={{ color: isWebBooking ? "#6ee7b7" : "#64748b", fontSize:13, margin:"4px 0 0" }}>{n.body}</p>}
              </div>
              );
            })}
          </>
        )}
      </div>

      {/* Customer AI chat — sends ONLY { messages, mode: "customer" }, no shop data */}
      <CustomerAIChat />

      {/* Bottom nav */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:"#0a0f1a", borderTop:"1px solid #1e293b",
        display:"flex", zIndex:100,
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            flex:1, padding:"12px 4px", background:"transparent", border:"none",
            borderTop:`2px solid ${activeTab===t.id ? "#00aaff" : "transparent"}`,
            cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2,
            position:"relative",
          }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ color: activeTab===t.id ? "#00aaff" : "#475569", fontSize:9, fontWeight:700 }}>{t.label}</span>
            {t.badge > 0 && (
              <span style={{
                position:"absolute", top:6, right:"calc(50% - 16px)",
                width:14, height:14, background:"#ef4444", borderRadius:"50%",
                fontSize:8, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Offer card with reactions + comments
function OfferCard({ offer, session, onReact, onComment }) {
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(false);

  return (
    <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, marginBottom:14, overflow:"hidden" }}>
      {offer.image_url && (
        <img src={offer.image_url} alt="" style={{ width:"100%", height:180, objectFit:"cover" }}/>
      )}
      <div style={{ padding:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <h3 style={{ color:"#fff", fontSize:16, fontWeight:800, margin:0, flex:1 }}>{offer.title}</h3>
          {offer.valid_until && (
            <span style={{ background:"rgba(251,191,36,0.1)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.3)", borderRadius:20, padding:"2px 8px", fontSize:10, fontWeight:700, flexShrink:0, marginLeft:8 }}>
              Until {offer.valid_until}
            </span>
          )}
        </div>
        {offer.description && <p style={{ color:"#94a3b8", fontSize:13, margin:"0 0 14px", lineHeight:1.5 }}>{offer.description}</p>}

        {/* Reactions */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
          {REACTIONS.map(r => (
            <button key={r.key} onClick={() => onReact(offer, r.key)} style={{
              background:"#1e293b", border:"1px solid #334155", borderRadius:20,
              padding:"4px 12px", cursor:"pointer", display:"flex", alignItems:"center", gap:5,
              fontSize:13,
            }}>
              <span>{r.emoji}</span>
              <span style={{ color:"#94a3b8", fontSize:12, fontWeight:600 }}>
                {(offer.reactions?.[r.key] || 0) > 0 ? offer.reactions[r.key] : ""}
              </span>
            </button>
          ))}
        </div>

        {/* Comments toggle */}
        <button onClick={() => setShowComments(!showComments)} style={{
          background:"transparent", border:"none", color:"#64748b", cursor:"pointer",
          fontSize:12, padding:0, marginBottom: showComments ? 10 : 0,
        }}>
          💬 {(offer.comments||[]).length} comments {showComments ? "▲" : "▼"}
        </button>

        {showComments && (
          <div style={{ borderTop:"1px solid #1e293b", paddingTop:10 }}>
            {(offer.comments||[]).map((c,i) => (
              <div key={i} style={{ marginBottom:8 }}>
                <p style={{ color:"#38bdf8", fontSize:11, fontWeight:700, margin:"0 0 2px" }}>{c.customer_name}</p>
                <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>{c.text}</p>
              </div>
            ))}
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                style={{ flex:1, background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"8px 12px", color:"#fff", fontSize:13, fontFamily:"inherit" }}
                onKeyDown={e => { if(e.key==="Enter"){ onComment(offer,commentText); setCommentText(""); } }}
              />
              <button onClick={() => { onComment(offer,commentText); setCommentText(""); }} style={{
                background:"#1d4ed8", border:"none", borderRadius:10, padding:"0 14px",
                color:"#fff", cursor:"pointer", fontSize:13,
              }}>Post</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}