import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Phone, Store, AlertCircle, CheckCircle2 } from "lucide-react";

export default function CustomerPortal() {
  const [step, setStep] = useState("shop");
  const [shopEmail, setShopEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("customer_session");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s?.customer_id) window.location.href = "/CustomerDashboard";
      } catch {}
    }
  }, []);

  const findShop = () => {
    const em = shopEmail.trim().toLowerCase();
    if (!em || !em.includes("@")) { setError("Enter a valid email address."); return; }
    setError("");
    const namePart = em.split("@")[0].replace(/[._\-]/g, " ");
    setShopName(namePart.replace(/\b\w/g, l => l.toUpperCase()));
    setStep("phone");
  };

  const handlePhoneLogin = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 7) { setError("Enter your full phone number."); return; }
    setLoading(true);
    setError("");
    try {
      const result = await base44.functions.invoke("customerLogin", {
        shop_email: shopEmail.trim().toLowerCase(),
        phone: cleaned,
      });

      if (result?.success && result?.customer) {
        sessionStorage.setItem("customer_session", JSON.stringify({
          customer_id: result.customer.id,
          customer_name: result.customer.full_name,
          customer_phone: result.customer.phone,
          shop_email: shopEmail.trim().toLowerCase(),
          shop_name: shopName,
        }));
        window.location.href = "/CustomerDashboard";
      } else {
        const count = result?.debug_count ?? "?";
        setError("Phone not found. (" + count + " records checked) Make sure the shop saved this number exactly.");
      }
    } catch (e) {
      setError("Error: " + (e?.message || String(e)));
    }
    setLoading(false);
  };

  const S = {
    page: { minHeight:"100vh", background:"#020617", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"system-ui,sans-serif", padding:"20px" },
    card: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:"32px 28px", width:"100%", maxWidth:420 },
    title: { color:"#fff", fontSize:28, fontWeight:800, textAlign:"center", margin:"12px 0 4px" },
    sub: { color:"#64748b", textAlign:"center", marginBottom:24, fontSize:14 },
    label: { display:"block", color:"#94a3b8", fontSize:11, fontWeight:700, letterSpacing:1, marginBottom:6, textTransform:"uppercase" },
    input: { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"14px 16px", color:"#fff", fontSize:16, boxSizing:"border-box", outline:"none" },
    btn: { width:"100%", background:"#3b82f6", color:"#fff", border:"none", borderRadius:10, padding:"15px", fontSize:16, fontWeight:700, cursor:"pointer", marginTop:12 },
    err: { color:"#f87171", fontSize:13, display:"flex", alignItems:"flex-start", gap:6, marginTop:8, lineHeight:1.4, wordBreak:"break-word" },
    shopBadge: { background:"#0f3b2e", border:"1px solid #16a34a", borderRadius:10, padding:"12px 16px", marginBottom:20 },
    back: { background:"transparent", border:"none", color:"#60a5fa", cursor:"pointer", fontSize:13, padding:0, marginBottom:16 },
    icon: { width:56, height:56, borderRadius:"50%", background:"#1e3a5f", border:"2px solid #3b82f6", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" },
    footer: { color:"#334155", fontSize:12, textAlign:"center", marginTop:24 }
  };

  return (
    <div style={S.page}>
      <div style={S.icon}>
        <Store style={{ color:"#60a5fa", width:26, height:26 }} />
      </div>
      <h1 style={S.title}>Customer Portal</h1>
      <p style={S.sub}>Access your car history, messages & offers</p>

      <div style={S.card}>
        {step === "shop" && (
          <>
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <Search style={{ color:"#60a5fa", width:28, height:28 }} />
            </div>
            <h2 style={{ color:"#fff", fontSize:18, fontWeight:700, textAlign:"center", margin:"0 0 4px" }}>Find Your Shop</h2>
            <p style={{ ...S.sub, marginBottom:20 }}>Enter the shop's email address</p>
            <label style={S.label}>Shop Email</label>
            <input
              style={S.input}
              type="email"
              placeholder="e.g. hajwheels@gmail.com"
              value={shopEmail}
              onChange={e => { setShopEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && findShop()}
              autoFocus
            />
            {error && <div style={S.err}><AlertCircle style={{ width:14, height:14, flexShrink:0, marginTop:1 }} /><span>{error}</span></div>}
            <button style={S.btn} onClick={findShop}>Continue →</button>
          </>
        )}

        {step === "phone" && (
          <>
            <button onClick={() => { setStep("shop"); setError(""); setPhone(""); }} style={S.back}>← Change shop</button>
            <div style={S.shopBadge}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <CheckCircle2 style={{ color:"#22c55e", width:18, height:18 }} />
                <div>
                  <div style={{ color:"#22c55e", fontWeight:700, fontSize:14 }}>{shopName}</div>
                  <div style={{ color:"#64748b", fontSize:12 }}>{shopEmail.trim().toLowerCase()}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign:"center", marginBottom:12 }}>
              <Phone style={{ color:"#a78bfa", width:28, height:28 }} />
            </div>
            <h2 style={{ color:"#fff", fontSize:18, fontWeight:700, textAlign:"center", margin:"0 0 4px" }}>Enter Your Phone</h2>
            <p style={{ ...S.sub, marginBottom:20 }}>The number you gave the shop (digits only)</p>
            <label style={S.label}>Phone Number</label>
            <input
              style={S.input}
              type="tel"
              placeholder="6135551234"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePhoneLogin()}
              autoFocus
            />
            {error && <div style={S.err}><AlertCircle style={{ width:14, height:14, flexShrink:0, marginTop:1 }} /><span>{error}</span></div>}
            <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={handlePhoneLogin} disabled={loading}>
              {loading ? "Checking..." : "Sign In →"}
            </button>
            <p style={{ color:"#475569", fontSize:12, textAlign:"center", marginTop:10 }}>Your phone number must be saved at the shop.</p>
          </>
        )}
      </div>
      <p style={S.footer}>Powered by LBC Auto · lbc.network</p>
    </div>
  );
}
