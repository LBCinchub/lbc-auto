import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Camera, Upload, Clock, CheckCircle2,
  Wrench, Car, Hash, Gauge, Play, Pause, StopCircle, Image, Trash2
} from "lucide-react";

// Parse all labor hours from labor_items + description text
function parseTotalHours(order) {
  let total = 0;
  try {
    const items = typeof order.labor_items === "string"
      ? JSON.parse(order.labor_items) : (order.labor_items || []);
    items.forEach(it => { total += parseFloat(it.hours) || 0; });
  } catch {}
  // Also scan description for patterns like "2.5h", "1 hour", "3hrs"
  const desc = (order.description || "") + " " + (order.notes || "");
  const matches = desc.match(/(\d+\.?\d*)\s*h(?:ours?|rs?)?/gi) || [];
  matches.forEach(m => {
    const n = parseFloat(m);
    if (n && n < 24) total += n;
  });
  return Math.round(total * 10) / 10;
}

export default function TechJobView() {
  const [order, setOrder] = useState(null);
  const [tech, setTech] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Form fields
  const [notes, setNotes] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState("pending");
  const [photos, setPhotos] = useState([]); // base64 previews
  const [vinLoading, setVinLoading] = useState(false);
  const [vinInfo, setVinInfo] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const orderId = new URLSearchParams(window.location.search).get("id");

  useEffect(() => {
    const saved = sessionStorage.getItem("tech_session");
    if (!saved) { window.location.href = "/TechPortal"; return; }
    setTech(JSON.parse(saved));

    base44.auth.me().then(u => {
      setUser(u);
      if (u && orderId) {
        base44.entities.RepairOrder.get(orderId).then(o => {
          setOrder(o);
          setNotes(o.tech_notes || "");
          setMileage(o.mileage || "");
          setVin(o.vin || "");
          setStatus(o.status || "pending");
          if (o.tech_photos) {
            try { setPhotos(JSON.parse(o.tech_photos)); } catch {}
          }
          // Restore elapsed time
          if (o.tech_elapsed_seconds) setElapsed(o.tech_elapsed_seconds);
        }).finally(() => setLoading(false));
      } else setLoading(false);
    });
  }, []);

  // Timer logic
  useEffect(() => {
    if (timerRunning) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  const handleVinDecode = async (v) => {
    const vinVal = v || vin;
    if (vinVal.length !== 17) return;
    setVinLoading(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vinVal}?format=json`);
      const data = await res.json();
      const get = (var_) => data.Results?.find(r => r.Variable === var_)?.Value || "";
      const year = get("Model Year");
      const make = get("Make");
      const model = get("Model");
      if (year && make && model) {
        setVinInfo({ year, make, model });
      }
    } catch {}
    setVinLoading(false);
  };

  const handlePhoto = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos(prev => [...prev, { data: ev.target.result, name: f.name, time: new Date().toISOString() }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleSave = async () => {
    if (!order || !user) return;
    setSaving(true);
    try {
      await base44.entities.RepairOrder.update(order.id, {
        tech_notes: notes,
        mileage: mileage,
        vin: vin,
        status,
        tech_elapsed_seconds: elapsed,
        tech_photos: JSON.stringify(photos),
        updated_by_tech: tech?.name,
        updated_by_tech_at: new Date().toISOString(),
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const estimatedHours = order ? parseTotalHours(order) : 0;
  const elapsedHours = Math.round((elapsed / 3600) * 10) / 10;
  const progressPct = estimatedHours > 0 ? Math.min(100, Math.round((elapsedHours / estimatedHours) * 100)) : 0;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#38bdf8" }}>Loading job...</div>
    </div>
  );

  if (!order) return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#f87171" }}>Job not found.</div>
    </div>
  );

  const statusOptions = [
    { value:"pending", label:"Pending", color:"#fbbf24" },
    { value:"in-progress", label:"In Progress", color:"#38bdf8" },
    { value:"waiting", label:"Waiting for Parts", color:"#a78bfa" },
    { value:"completed", label:"Completed", color:"#4ade80" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#020617", fontFamily:"inherit", paddingBottom:120 }}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderBottom:"1px solid rgba(0,170,255,0.2)",
        padding:"16px 20px",
        display:"flex", alignItems:"center", gap:14,
        position:"sticky", top:0, zIndex:100,
      }}>
        <button onClick={() => window.location.href = "/TechDashboard"} style={{
          background:"transparent", border:"none", color:"#38bdf8",
          cursor:"pointer", display:"flex", alignItems:"center", gap:6,
          fontSize:14, fontWeight:600, padding:0,
        }}>
          <ArrowLeft style={{ width:18, height:18 }} /> Back
        </button>
        <div style={{ flex:1 }}>
          <h1 style={{ color:"#fff", fontSize:18, fontWeight:800, margin:0 }}>{order.customer_name}</h1>
          <p style={{ color:"#38bdf8", fontSize:13, margin:0 }}>{order.vehicle_info} · #{order.order_number}</p>
        </div>
      </div>

      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:16 }}>

        {/* ── TIMER CARD ── */}
        <div style={{
          background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
            <Clock style={{ width:16, height:16, color:"#a78bfa" }} />
            <span style={{ color:"#a78bfa", fontWeight:700, fontSize:14 }}>Job Timer</span>
          </div>

          {/* Elapsed vs Estimated */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:"#38bdf8", fontSize:36, fontWeight:800, fontVariantNumeric:"tabular-nums" }}>
                {formatTime(elapsed)}
              </div>
              <div style={{ color:"#64748b", fontSize:12 }}>Elapsed</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ color:"#a78bfa", fontSize:36, fontWeight:800 }}>
                {estimatedHours}h
              </div>
              <div style={{ color:"#64748b", fontSize:12 }}>Estimated</div>
            </div>
          </div>

          {/* Progress bar */}
          {estimatedHours > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ background:"#1e293b", borderRadius:6, height:8, overflow:"hidden" }}>
                <div style={{
                  width:`${progressPct}%`,
                  height:"100%",
                  background: progressPct >= 100 ? "#f87171" : "linear-gradient(90deg,#00aaff,#a78bfa)",
                  borderRadius:6, transition:"width 0.5s",
                }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ color:"#64748b", fontSize:11 }}>{elapsedHours}h used</span>
                <span style={{ color: progressPct >= 100 ? "#f87171" : "#64748b", fontSize:11 }}>{progressPct}%</span>
              </div>
            </div>
          )}

          {/* Timer controls */}
          <div style={{ display:"flex", gap:10 }}>
            {!timerRunning ? (
              <button onClick={() => setTimerRunning(true)} style={{
                flex:1, background:"linear-gradient(135deg,#166534,#15803d)",
                border:"none", borderRadius:12, padding:"12px",
                color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              }}>
                <Play style={{ width:16, height:16 }} /> Start Timer
              </button>
            ) : (
              <button onClick={() => setTimerRunning(false)} style={{
                flex:1, background:"linear-gradient(135deg,#92400e,#b45309)",
                border:"none", borderRadius:12, padding:"12px",
                color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              }}>
                <Pause style={{ width:16, height:16 }} /> Pause
              </button>
            )}
            <button onClick={() => { setTimerRunning(false); setElapsed(0); }} style={{
              background:"#1e293b", border:"1px solid #334155",
              borderRadius:12, padding:"12px 16px",
              color:"#64748b", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              <StopCircle style={{ width:16, height:16 }} />
            </button>
          </div>
        </div>

        {/* ── STATUS ── */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
          <p style={{ color:"#94a3b8", fontSize:13, fontWeight:700, marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Job Status</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {statusOptions.map(s => (
              <button key={s.value} onClick={() => setStatus(s.value)} style={{
                padding:"12px 10px", borderRadius:12,
                border:`2px solid ${status === s.value ? s.color : "#1e293b"}`,
                background: status === s.value ? `rgba(${s.color === "#fbbf24" ? "251,191,36" : s.color === "#38bdf8" ? "56,189,248" : s.color === "#a78bfa" ? "167,139,250" : "74,222,128"},0.1)` : "#0f172a",
                color: status === s.value ? s.color : "#475569",
                fontSize:13, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
              }}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── VIN ── */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Hash style={{ width:16, height:16, color:"#38bdf8" }} />
            <span style={{ color:"#94a3b8", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>VIN</span>
          </div>
          <input
            value={vin}
            onChange={e => {
              const v = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,"");
              setVin(v);
              if (v.length === 17) handleVinDecode(v);
            }}
            placeholder="Scan or type 17-digit VIN"
            style={{
              width:"100%", background:"#1e293b", border:"1px solid #334155",
              borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:15,
              fontFamily:"monospace", letterSpacing:1, boxSizing:"border-box",
            }}
          />
          {vinLoading && <p style={{ color:"#38bdf8", fontSize:12, marginTop:6 }}>Decoding VIN...</p>}
          {vinInfo && (
            <div style={{
              marginTop:10, background:"rgba(0,170,255,0.07)", border:"1px solid rgba(0,170,255,0.2)",
              borderRadius:10, padding:"10px 14px",
            }}>
              <p style={{ color:"#38bdf8", fontSize:14, fontWeight:700, margin:0 }}>
                {vinInfo.year} {vinInfo.make} {vinInfo.model}
              </p>
            </div>
          )}
          {/* Camera scan button */}
          <button onClick={() => cameraInputRef.current?.click()} style={{
            marginTop:10, width:"100%", background:"#1e293b", border:"1px solid #334155",
            borderRadius:10, padding:"10px", color:"#64748b", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontSize:13,
          }}>
            <Camera style={{ width:15, height:15 }} /> Scan VIN with Camera
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            style={{ display:"none" }} onChange={() => {}} />
        </div>

        {/* ── MILEAGE ── */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Gauge style={{ width:16, height:16, color:"#fb923c" }} />
            <span style={{ color:"#94a3b8", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Mileage (km)</span>
          </div>
          <input
            type="number" inputMode="numeric"
            value={mileage}
            onChange={e => setMileage(e.target.value)}
            placeholder="e.g. 145000"
            onFocus={e => e.target.select()}
            style={{
              width:"100%", background:"#1e293b", border:"1px solid #334155",
              borderRadius:10, padding:"14px", color:"#fff", fontSize:22,
              fontWeight:700, textAlign:"center", boxSizing:"border-box",
            }}
          />
        </div>

        {/* ── TECH NOTES ── */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <Wrench style={{ width:16, height:16, color:"#4ade80" }} />
            <span style={{ color:"#94a3b8", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>Tech Notes</span>
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what you found, what you did, parts replaced..."
            rows={5}
            style={{
              width:"100%", background:"#1e293b", border:"1px solid #334155",
              borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:14,
              resize:"vertical", boxSizing:"border-box", fontFamily:"inherit",
            }}
          />
        </div>

        {/* ── JOB DESCRIPTION (read-only) ── */}
        {order.description && (
          <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
            <p style={{ color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", marginBottom:8 }}>Job Description</p>
            <p style={{ color:"#94a3b8", fontSize:14, margin:0, lineHeight:1.6 }}>{order.description}</p>
          </div>
        )}

        {/* ── PHOTOS ── */}
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <Image style={{ width:16, height:16, color:"#38bdf8" }} />
              <span style={{ color:"#94a3b8", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" }}>
                Photos ({photos.length})
              </span>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <button onClick={() => cameraInputRef.current && (cameraInputRef.current.accept = "image/*", cameraInputRef.current.capture = "environment", cameraInputRef.current.onchange = handlePhoto, cameraInputRef.current.click())}
              style={{
                background:"#1e293b", border:"1px dashed #334155",
                borderRadius:12, padding:"16px 10px", color:"#64748b",
                cursor:"pointer", display:"flex", flexDirection:"column",
                alignItems:"center", gap:8, fontSize:13,
              }}>
              <Camera style={{ width:22, height:22 }} />
              Take Photo
            </button>
            <button onClick={() => fileInputRef.current?.click()} style={{
              background:"#1e293b", border:"1px dashed #334155",
              borderRadius:12, padding:"16px 10px", color:"#64748b",
              cursor:"pointer", display:"flex", flexDirection:"column",
              alignItems:"center", gap:8, fontSize:13,
            }}>
              <Upload style={{ width:22, height:22 }} />
              Upload
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple
            style={{ display:"none" }} onChange={handlePhoto} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
            style={{ display:"none" }} onChange={handlePhoto} />

          {photos.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {photos.map((p, i) => (
                <div key={i} style={{ position:"relative", borderRadius:12, overflow:"hidden", aspectRatio:"4/3", background:"#1e293b" }}>
                  <img src={p.data} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  <button onClick={() => setPhotos(prev => prev.filter((_,j) => j!==i))} style={{
                    position:"absolute", top:6, right:6,
                    background:"rgba(239,68,68,0.8)", border:"none",
                    borderRadius:6, padding:4, cursor:"pointer", color:"#fff",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    <Trash2 style={{ width:12, height:12 }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* ── STICKY SAVE BAR ── */}
      <div style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderTop:"1px solid rgba(0,170,255,0.2)",
        padding:"14px 20px",
        display:"flex", alignItems:"center", gap:12, zIndex:200,
      }}>
        <div style={{ flex:1 }}>
          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>Total Labor</p>
          <p style={{ color:"#a78bfa", fontSize:18, fontWeight:800, margin:0 }}>
            {estimatedHours}h est · {elapsedHours}h actual
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          background: savedOk ? "linear-gradient(135deg,#166534,#15803d)" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
          border:"none", borderRadius:14, padding:"14px 28px",
          color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer",
          display:"flex", alignItems:"center", gap:8,
          boxShadow: savedOk ? "0 4px 16px rgba(34,197,94,0.4)" : "0 4px 16px rgba(37,99,235,0.4)",
        }}>
          {saving ? "Saving..." : savedOk ? <><CheckCircle2 style={{ width:18, height:18 }} /> Saved!</> : "Save Job"}
        </button>
      </div>

    </div>
  );
}
