import React, { useState, useEffect } from "react";
import { Search, Phone, Store, AlertCircle, CheckCircle2 } from "lucide-react";

export default function CustomerPortal() {
  const [step, setStep] = useState("shop");
  const [shopEmail, setShopEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [shopUser, setShopUser] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("customer_session");
    if (saved) { window.location.href = "/CustomerDashboard"; return; }
  }, []);

  const findShop = () => {
    const target = shopEmail.trim().toLowerCase();
    if (!target || !target.includes("@") || !target.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    setShopUser({ email: target });
    const namePart = target.split("@")[0].replace(/[._\-]/g, " ");
    setShopName(namePart.replace(/\b\w/g, l => l.toUpperCase()));
    setStep("phone");
    setError("");
  };

  const handlePhoneLogin = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 7) { setError("Enter your full phone number."); return; }
    setLoading(true);
    setError("");
    try {
      // Use raw fetch — this page is public (no auth token), SDK invoke requires auth
      const fnRes = await fetch("/api/functions/customerLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_email: shopUser.email, phone: cleaned }),
      });
      const result = await fnRes.json();

      if (result?.success && result?.customer) {
        sessionStorage.setItem("customer_session", JSON.stringify({
          customer_id: result.customer.id,
          customer_name: result.customer.full_name,
          customer_phone: result.customer.phone,
          shop_email: shopUser.email,
          shop_name: shopName,
        }));
        window.location.href = "/CustomerDashboard";
      } else {
        setError("Phone number not found at this shop. Make sure the shop has your number on file.");
      }
    } catch (e) {
      console.error("Login error:", e);
      setError("Connection error — please try again.");
    }
    setLoading(false);
  };

  const S = {
    page: { minHeight:"100vh", background:"#020617", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"inherit" },
    card: { width:"100%", maxWidth:380, background:"#0f172a", border:"1px solid #1e293b", borderRadius:20, padding:28 },
    input: { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"14px 16px", color:"#fff", fontSize:16, boxSizing:"border-box", fontFamily:"inherit", outline:"none" },
    btn: { width:"100%", background:"linear-gradient(135deg,#1d4ed8,#2563eb)", border:"none", borderRadius:12, padding:"14px", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", marginTop:12 },
    label: { color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8, display:"block" },
  };

  return (
    <div style={S.page}>
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:"linear-gradient(135deg,#001f3f,#003366)", border:"3px solid #00aaff", boxShadow:"0 0 24px #00aaff50", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
          <Store style={{ width:32, height:32, color:"#00aaff" }}/>
        </div>
        <h1 style={{ color:"#fff", fontSize:24, fontWeight:800, margin:0 }}>Customer Portal</h1>
        <p style={{ color:"#475569", fontSize:13, marginTop:6 }}>Access your car history, messages & offers</p>
      </div>

      <div style={S.card}>
        {step === "shop" && (
          <>
            <div style={{ marginBottom:20, textAlign:"center" }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
                <Search style={{ width:18, height:18, color:"#38bdf8" }}/>
              </div>
              <h2 style={{ color:"#fff", fontSize:18, fontWeight:700, margin:0 }}>Find Your Shop</h2>
              <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>Enter the shop's email address</p>
            </div>
            <span style={S.label}>Shop Email</span>
            <input
              style={S.input}
              type="email" inputMode="email" autoComplete="email"
              placeholder="e.g. hajwheels@gmail.com"
              value={shopEmail}
              onChange={e => { setShopEmail(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && findShop()}
            />
            {error && (
              <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10, color:"#f87171", fontSize:13 }}>
                <AlertCircle style={{ width:14, height:14 }}/> {error}
              </div>
            )}
            <button style={S.btn} onClick={findShop}>Continue →</button>
          </>
        )}

        {step === "phone" && (
          <>
            <button onClick={() => { setStep("shop"); setError(""); setPhone(""); }} style={{ background:"transparent", border:"none", color:"#38bdf8", cursor:"pointer", fontSize:13, padding:0, marginBottom:16, display:"flex", alignItems:"center", gap:4 }}>
              ← Change shop
            </button>
            <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <CheckCircle2 style={{ width:14, height:14, color:"#4ade80" }}/>
                <p style={{ color:"#4ade80", fontSize:13, fontWeight:700, margin:0 }}>{shopName}</p>
              </div>
              <p style={{ color:"#64748b", fontSize:11, margin:"3px 0 0" }}>{shopUser?.email}</p>
            </div>
            <div style={{ marginBottom:20, textAlign:"center" }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(167,139,250,0.1)", border:"1px solid rgba(167,139,250,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px" }}>
                <Phone style={{ width:18, height:18, color:"#a78bfa" }}/>
              </div>
              <h2 style={{ color:"#fff", fontSize:18, fontWeight:700, margin:0 }}>Enter Your Phone</h2>
              <p style={{ color:"#64748b", fontSize:13, marginTop:4 }}>The number you gave the shop</p>
            </div>
            <span style={S.label}>Phone Number</span>
            <input
              style={{ ...S.input, fontSize:22, fontWeight:700, textAlign:"center", letterSpacing:2 }}
              type="tel" inputMode="tel"
              placeholder="613-555-0100"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePhoneLogin()}
            />
            {error && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:6, marginTop:10, color:"#f87171", fontSize:13, lineHeight:1.4 }}>
                <AlertCircle style={{ width:14, height:14, flexShrink:0, marginTop:2 }}/> {error}
              </div>
            )}
            <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} onClick={handlePhoneLogin} disabled={loading}>
              {loading ? "Checking..." : "Sign In →"}
            </button>
            <p style={{ color:"#334155", fontSize:11, textAlign:"center", marginTop:14, lineHeight:1.5 }}>
              Your phone number must be saved at the shop.
            </p>
          </>
        )}
      </div>
      <p style={{ color:"#1e293b", fontSize:11, marginTop:32 }}>Powered by LBC Auto · lbc.network</p>
    </div>
  );
}
