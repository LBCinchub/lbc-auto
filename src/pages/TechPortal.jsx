import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wrench, ArrowLeft, Copy, CheckCheck, Link } from "lucide-react";

export default function TechPortal() {
  // Assume true until the teamLogin check says otherwise, so we don't flash a
  // false "no team" warning while the request is in flight.
  const [hasTeam, setHasTeam] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [noOwner, setNoOwner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isOwnerView, setIsOwnerView] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("tech_session");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        window.location.href = s?.role === "office_staff" ? "/OfficeAssistant" : "/TechDashboard";
      } catch {
        window.location.href = "/TechDashboard";
      }
      return;
    }

    // Checks (via the teamLogin backend function, which uses asServiceRole to bypass
    // RLS) whether this shop has any PIN-enabled team members, just to power the
    // "no techs with a PIN set" warning banner — no PINs are ever sent to the browser.
    const loadTeamStatus = (email) => {
      base44.functions.invoke("teamLogin", { shop_email: email })
        .then(res => setHasTeam(!!res?.data?.has_team))
        .catch(() => setHasTeam(true)) // don't show a false warning just because this check failed
        .finally(() => setLoading(false));
    };

    const params = new URLSearchParams(window.location.search);
    const ownerParam = params.get("owner");

    if (ownerParam) {
      // Mechanic/team member is using the shared link — this never needs a Base44
      // login (the route is public and most team members have no account at all).
      // Previously this whole branch lived inside base44.auth.me().then(...) with no
      // .catch() — if that call rejected for a logged-out visitor (the normal case),
      // setLoading(false) never ran and the page spun on "Loading..." forever.
      try {
        const decoded = atob(ownerParam);
        setOwnerEmail(decoded);
        setShopName(decoded.split("@")[0]);
        setIsOwnerView(false);
        loadTeamStatus(decoded);
      } catch {
        setNoOwner(true);
        setLoading(false);
      }
      return;
    }

    // No owner param — this is the shop owner viewing their own share-link/PIN-test screen,
    // so a real Base44 session is expected here. Still catch failures so we never hang on loading.
    base44.auth.me()
      .then(u => {
        if (u) {
          setOwnerEmail(u.email);
          setShopName(u.full_name || u.email.split("@")[0]);
          setIsOwnerView(true);
          loadTeamStatus(u.email);
        } else {
          setNoOwner(true);
          setLoading(false);
        }
      })
      .catch(() => { setNoOwner(true); setLoading(false); });
  }, []);

  const getTechLink = () => {
    // Always hand out the short, memorable /lbc-team link (not whatever path was used to view this page)
    const base = `${window.location.origin}/lbc-team`;
    return `${base}?owner=${btoa(ownerEmail)}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getTechLink()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleDigit = (d) => {
    if (pin.length >= 4 || checking) return;
    const next = pin + d;
    setPin(next);
    setError("");
    if (next.length === 4) setTimeout(() => checkPin(next), 150);
  };

  const checkPin = (p) => {
    // Verified server-side via the teamLogin function (asServiceRole bypasses RLS,
    // and only the single matched mechanic's info is ever returned to the browser —
    // never the full team list or anyone's PIN).
    setChecking(true);
    base44.functions.invoke("teamLogin", { shop_email: ownerEmail, pin: p })
      .then(res => {
        const data = res?.data;
        if (data?.success && data.mechanic) {
          const m = data.mechanic;
          const role = m.role || "mechanic";
          sessionStorage.setItem("tech_session", JSON.stringify({
            id: m.id,
            name: m.name,
            specialty: m.specialty || "",
            hourly_rate: m.hourly_rate || 0,
            owner_email: ownerEmail,
            role,
          }));
          window.location.href = role === "office_staff" ? "/OfficeAssistant" : "/TechDashboard";
          return;
        }
        setError("Wrong PIN. Try again.");
        setPin("");
      })
      .catch(() => {
        setError("Couldn't verify PIN — check your connection and try again.");
        setPin("");
      })
      .finally(() => setChecking(false));
  };

  const handleDelete = () => { setPin(p => p.slice(0,-1)); setError(""); };

  const digits = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:"#38bdf8",fontSize:18}}>Loading...</div>
    </div>
  );

  if (noOwner) return (
    <div style={{minHeight:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:18,padding:32,textAlign:"center",maxWidth:380}}>
        <Wrench style={{width:40,height:40,color:"#334155",margin:"0 auto 16px"}}/>
        <p style={{color:"#f87171",fontSize:15,fontWeight:700}}>Invalid Tech Portal Link</p>
        <p style={{color:"#64748b",fontSize:13}}>Ask your shop owner for the correct tablet link.</p>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight:"100vh", background:"#020617",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      fontFamily:"inherit", padding:24, position:"relative",
    }}>
      {/* Back */}
      <button onClick={() => window.history.back()} style={{
        position:"absolute",top:24,left:24,
        background:"transparent",border:"1px solid #1e293b",
        borderRadius:10,padding:"8px 14px",color:"#64748b",cursor:"pointer",
        display:"flex",alignItems:"center",gap:6,fontSize:13,fontWeight:600,
      }}>
        <ArrowLeft style={{width:15,height:15}}/> Back
      </button>

      {/* Logo */}
      <div style={{marginBottom:24,textAlign:"center"}}>
        <div style={{
          width:80,height:80,borderRadius:"50%",
          background:"linear-gradient(135deg,#001f3f,#003366)",
          border:"3px solid #00aaff",boxShadow:"0 0 24px #00aaff60",
          display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",
        }}>
          <Wrench style={{width:36,height:36,color:"#00aaff"}}/>
        </div>
        <h1 style={{color:"#fff",fontSize:26,fontWeight:800,margin:0}}>Tech Portal</h1>
        {shopName && <p style={{color:"#38bdf8",fontSize:14,marginTop:4,textTransform:"capitalize"}}>{shopName}</p>}
        <p style={{color:"#475569",fontSize:13,marginTop:2}}>Enter your 4-digit PIN</p>
      </div>

      {/* Owner: shareable link banner */}
      {isOwnerView && ownerEmail && (
        <div style={{
          background:"rgba(0,170,255,0.07)",border:"1px solid rgba(0,170,255,0.25)",
          borderRadius:14,padding:"16px 18px",marginBottom:24,maxWidth:340,width:"100%",
        }}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <Link style={{width:13,height:13,color:"#38bdf8"}}/>
            <span style={{color:"#38bdf8",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>
              Your Mechanic Tablet Link
            </span>
          </div>
          <p style={{color:"#64748b",fontSize:11,margin:"0 0 10px",lineHeight:1.5}}>
            Share this with your mechanics. Their PIN only works for your shop — no other shop can use it.
          </p>
          <div style={{
            background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,
            padding:"8px 10px",fontSize:10,color:"#94a3b8",
            wordBreak:"break-all",marginBottom:10,fontFamily:"monospace",lineHeight:1.6,
          }}>
            {getTechLink()}
          </div>
          <button onClick={copyLink} style={{
            width:"100%",
            background: copied ? "linear-gradient(135deg,#166534,#15803d)" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
            border:"none",borderRadius:8,padding:"10px",
            color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          }}>
            {copied
              ? <><CheckCheck style={{width:14,height:14}}/> Copied!</>
              : <><Copy style={{width:14,height:14}}/> Copy Link to Share</>
            }
          </button>
        </div>
      )}

      {/* No PIN warning */}
      {!hasTeam && (
        <div style={{
          background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",
          color:"#fbbf24",borderRadius:10,padding:"10px 20px",
          fontSize:13,marginBottom:20,fontWeight:600,textAlign:"center",maxWidth:320,
        }}>
          No techs with a PIN set.<br/>
          <span style={{fontWeight:400,fontSize:12}}>Go to Mechanics → Edit → set a 4-digit PIN first</span>
        </div>
      )}

      {/* PIN dots */}
      <div style={{display:"flex",gap:12,marginBottom:28}}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:52,height:52,borderRadius:12,
            border:`2px solid ${pin.length > i ? "#00aaff" : "#1e293b"}`,
            background: pin.length > i ? "rgba(0,170,255,0.1)" : "#0f172a",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all 0.15s",
          }}>
            {pin.length > i && (
              <div style={{width:14,height:14,borderRadius:"50%",background:"#00aaff",boxShadow:"0 0 8px #00aaff"}}/>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",
          color:"#f87171",borderRadius:10,padding:"8px 20px",
          fontSize:13,marginBottom:16,fontWeight:600,
        }}>{error}</div>
      )}

      {/* Checking indicator */}
      {checking && (
        <div style={{color:"#38bdf8",fontSize:13,marginBottom:16,fontWeight:600}}>Verifying...</div>
      )}

      {/* Keypad */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,80px)",gap:12, opacity: checking ? 0.5 : 1, pointerEvents: checking ? "none" : "auto"}}>
        {digits.map((d,i) => {
          if (d === "") return <div key={i}/>;
          return (
            <button key={i}
              onClick={() => d === "⌫" ? handleDelete() : handleDigit(d)}
              style={{
                width:80,height:80,borderRadius:16,
                background: d === "⌫" ? "#1e293b" : "#0f172a",
                border: d === "⌫" ? "1px solid #334155" : "1px solid #1e293b",
                color:"#fff",fontSize: d === "⌫" ? 20 : 26,
                fontWeight:700,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 2px 8px rgba(0,0,0,0.3)",
              }}
              onMouseDown={e => e.currentTarget.style.background="#162032"}
              onMouseUp={e => e.currentTarget.style.background= d==="⌫"?"#1e293b":"#0f172a"}
            >{d}</button>
          );
        })}
      </div>

      <p style={{color:"#1e293b",fontSize:11,marginTop:40}}>Powered by LBC.NETWORK</p>
    </div>
  );
}
