import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wrench, Delete, ArrowLeft } from "lucide-react";

export default function TechPortal() {
  const [mechanics, setMechanics] = useState([]);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if already logged in as tech
    const saved = sessionStorage.getItem("tech_session");
    if (saved) {
      window.location.href = "/TechDashboard";
      return;
    }
    base44.auth.me().then(u => {
      setUser(u);
      if (u) {
        base44.entities.Mechanic.list("-created_date", 100)
          .then(all => {
            // Only keep mechanics with a PIN set
            setMechanics(all.filter(m => m.pin && m.pin.length === 4));
          }).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) {
      // Auto check PIN
      setTimeout(() => checkPin(next), 150);
    }
  };

  const checkPin = (p) => {
    const match = mechanics.find(m => String(m.pin).trim() === String(p).trim());
    if (match) {
      sessionStorage.setItem("tech_session", JSON.stringify({
        id: match.id,
        name: match.name,
        specialty: match.specialty || "",
        hourly_rate: match.hourly_rate || 0,
      }));
      window.location.href = "/TechDashboard";
    } else {
      setError("Wrong PIN. Try again.");
      setPin("");
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError("");
  };

  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#38bdf8", fontSize:18 }}>Loading...</div>
    </div>
  );

  return (
    <div style={{
      minHeight:"100vh", background:"#020617",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"inherit", padding:24, position:"relative",
    }}>
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        style={{
          position:"absolute", top:24, left:24,
          background:"transparent", border:"1px solid #1e293b",
          borderRadius:10, padding:"8px 14px",
          color:"#64748b", cursor:"pointer",
          display:"flex", alignItems:"center", gap:6,
          fontSize:13, fontWeight:600,
        }}
      >
        <ArrowLeft style={{ width:15, height:15 }} /> Back
      </button>

      {/* Logo */}
      <div style={{ marginBottom:32, textAlign:"center" }}>
        <div style={{
          width:80, height:80, borderRadius:"50%",
          background:"linear-gradient(135deg,#001f3f,#003366)",
          border:"3px solid #00aaff",
          boxShadow:"0 0 24px #00aaff60",
          display:"flex", alignItems:"center", justifyContent:"center",
          margin:"0 auto 16px",
        }}>
          <Wrench style={{ width:36, height:36, color:"#00aaff" }} />
        </div>
        <h1 style={{ color:"#fff", fontSize:26, fontWeight:800, margin:0 }}>Tech Portal</h1>
        <p style={{ color:"#475569", fontSize:14, marginTop:6 }}>Enter your 4-digit PIN to continue</p>
      </div>

      {/* PIN display */}
      <div style={{ display:"flex", gap:12, marginBottom:32 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:52, height:52, borderRadius:12,
            border:`2px solid ${pin.length > i ? "#00aaff" : "#1e293b"}`,
            background: pin.length > i ? "rgba(0,170,255,0.1)" : "#0f172a",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.15s",
          }}>
            {pin.length > i && (
              <div style={{ width:14, height:14, borderRadius:"50%", background:"#00aaff", boxShadow:"0 0 8px #00aaff" }} />
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {!loading && mechanics.length === 0 && (
        <div style={{
          background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.3)",
          color:"#fbbf24", borderRadius:10, padding:"10px 20px",
          fontSize:13, marginBottom:20, fontWeight:600, textAlign:"center",
        }}>
          No techs with a PIN set yet.<br/>
          <span style={{ fontWeight:400, fontSize:12 }}>Go to Mechanics → Edit → set a 4-digit PIN</span>
        </div>
      )}
      {error && (
        <div style={{
          background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
          color:"#f87171", borderRadius:10, padding:"8px 20px",
          fontSize:13, marginBottom:20, fontWeight:600,
        }}>{error}</div>
      )}

      {/* Keypad */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,80px)", gap:12 }}>
        {digits.map((d, i) => {
          if (d === "") return <div key={i} />;
          return (
            <button
              key={i}
              onClick={() => d === "⌫" ? handleDelete() : handleDigit(d)}
              style={{
                width:80, height:80, borderRadius:16,
                background: d === "⌫" ? "#1e293b" : "#0f172a",
                border: d === "⌫" ? "1px solid #334155" : "1px solid #1e293b",
                color:"#fff", fontSize: d === "⌫" ? 20 : 26,
                fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.1s",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
              onMouseDown={e => e.currentTarget.style.background = "#162032"}
              onMouseUp={e => e.currentTarget.style.background = d === "⌫" ? "#1e293b" : "#0f172a"}
            >
              {d}
            </button>
          );
        })}
      </div>

      <p style={{ color:"#1e293b", fontSize:11, marginTop:40 }}>Powered by LBC.NETWORK</p>
    </div>
  );
}
