import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Phone, Store, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export default function CustomerPortal() {
  const [step, setStep] = useState("shop"); // shop | phone | loading
  const [shopEmail, setShopEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [shopUser, setShopUser] = useState(null);

  useEffect(() => {
    // Already logged in?
    const saved = sessionStorage.getItem("customer_session");
    if (saved) { window.location.href = "/CustomerDashboard"; return; }
    // Pre-fill from URL ?shop=
    const params = new URLSearchParams(window.location.search);
    const s = params.get("shop");
    if (s) { setShopEmail(s); findShop(s); }
  }, []);

  const findShop = async (email) => {
    const target = (email || shopEmail).trim().toLowerCase();
    if (!target || !target.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      // Try to find any record created by this email across multiple entities
      // This is resilient — works even if shop has no customers yet
      let found = false;

      // Method 1: Check Users entity (most reliable)
      try {
        const users = await base44.entities.User.filter({ email: target }, "email", 1);
        if (users.length > 0) { found = true; }
      } catch {}

      // Method 2: Check Customers (existing shops with data)
      if (!found) {
        try {
          const custs = await base44.entities.Customer.filter({ created_by: target }, "full_name", 1);
          if (custs.length > 0) found = true;
        } catch {}
      }

      // Method 3: Check RepairOrders
      if (!found) {
        try {
          const ros = await base44.entities.RepairOrder.filter({ created_by: target }, "id", 1);
          if (ros.length > 0) found = true;
        } catch {}
      }

      // Method 4: Check Vehicles
      if (!found) {
        try {
          const vs = await base44.entities.Vehicle.filter({ created_by: target }, "id", 1);
          if (vs.length > 0) found = true;
        } catch {}
      }

      if (found) {
        setShopUser({ email: target });
        // Build a readable shop name from email
        const namePart = target.split("@")[0].replace(/[._\-]/g, " ");
        setShopName(namePart.replace(/\w/g, l => l.toUpperCase()));
        setStep("phone");
      } else {
        setError("No LBC Auto account found with that email. Double-check the shop's email address.");
      }
    } catch {
      setError("Could not connect. Please try again.");
    }
    setSearching(false);
  };

  const handlePhoneLogin = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 7) { setError("Enter your phone number."); return; }
    setStep("loading");
    setError("");
    try {
      // Find customer in this shop by phone
      const customers = await base44.entities.Customer.filter(
        { created_by: shopUser.email }, "full_name", 1000
      );
      const match = customers.find(c => {
        const cp = (c.phone || "").replace(/\D/g, "");
        return cp === cleaned || cp.endsWith(cleaned) || cleaned.endsWith(cp);
      });

      if (match) {
        sessionStorage.setItem("customer_session", JSON.stringify({
          customer_id: match.id,
          customer_name: match.full_name,
          customer_phone: match.phone,
          shop_email: shopUser.email,
          shop_name: shopName,
        }));
        window.location.href = "/CustomerDashboard";
      } else {
        setError("Phone number not found in this shop's records. Make sure your number is on file.");
        setStep("phone");
      }
    } catch {
      setError("Something went wrong. Try again.");
      setStep("phone");
    }
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
      {/* Logo */}
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{
          width:72, height:72, borderRadius:"50%",
          background:"linear-gradient(135deg,#001f3f,#003366)",
          border:"3px solid #00aaff", boxShadow:"0 0 24px #00aaff50",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 14px",
        }}>
          <Store style={{ width:32, height:32, color:"#00aaff" }}/>
        </div>
        <h1 style={{ color:"#fff", fontSize:24, fontWeight:800, margin:0 }}>Customer Portal</h1>
        <p style={{ color:"#475569", fontSize:13, marginTop:6 }}>Access your car history, messages & offers</p>
      </div>

      <div style={S.card}>
        {/* Step 1: Find shop */}
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
              type="email" inputMode="email"
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
            <button style={S.btn} onClick={() => findShop()} disabled={searching}>
              {searching ? "Searching..." : "Find Shop →"}
            </button>
          </>
        )}

        {/* Step 2: Enter phone */}
        {step === "phone" && (
          <>
            <button onClick={() => { setStep("shop"); setError(""); setPhone(""); }} style={{ background:"transparent", border:"none", color:"#38bdf8", cursor:"pointer", fontSize:13, padding:0, marginBottom:16, display:"flex", alignItems:"center", gap:4 }}>
              ← Change shop
            </button>
            <div style={{ background:"rgba(74,222,128,0.08)", border:"1px solid rgba(74,222,128,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <CheckCircle2 style={{ width:14, height:14, color:"#4ade80" }}/>
                <p style={{ color:"#4ade80", fontSize:13, fontWeight:700, margin:0, textTransform:"capitalize" }}>
                  {shopName}
                </p>
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
              placeholder="e.g. 613-555-0100"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handlePhoneLogin()}
            />
            {error && (
              <div style={{ display:"flex", alignItems:"flex-start", gap:6, marginTop:10, color:"#f87171", fontSize:13, lineHeight:1.4 }}>
                <AlertCircle style={{ width:14, height:14, flexShrink:0, marginTop:2 }}/> {error}
              </div>
            )}
            <button style={S.btn} onClick={handlePhoneLogin}>
              Sign In →
            </button>
            <p style={{ color:"#334155", fontSize:11, textAlign:"center", marginTop:14, lineHeight:1.5 }}>
              Your phone number must be on file at the shop. Ask the shop owner to add it.
            </p>
          </>
        )}

        {/* Loading */}
        {step === "loading" && (
          <div style={{ textAlign:"center", padding:20 }}>
            <div style={{ color:"#38bdf8", fontSize:16 }}>Signing you in...</div>
          </div>
        )}
      </div>

      <p style={{ color:"#1e293b", fontSize:11, marginTop:32 }}>Powered by LBC Auto · LBC.NETWORK</p>
    </div>
  );
}
