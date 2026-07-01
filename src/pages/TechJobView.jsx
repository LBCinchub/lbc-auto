import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, Camera, Upload, Clock, CheckCircle2,
  Wrench, Car, Hash, Gauge, Play, Pause, StopCircle,
  Image, Trash2, ChevronDown, ChevronUp, Zap, Fuel,
  RotateCcw, AlertCircle
} from "lucide-react";

function parseTotalHours(order) {
  let total = 0;
  try {
    const items = typeof order.labor_items === "string"
      ? JSON.parse(order.labor_items) : (order.labor_items || []);
    items.forEach(it => { total += parseFloat(it.hours) || 0; });
  } catch {}
  const desc = (order.description || "") + " " + (order.notes || "");
  const matches = desc.match(/(\d+\.?\d*)\s*h(?:ours?|rs?)?/gi) || [];
  matches.forEach(m => { const n = parseFloat(m); if (n && n < 24) total += n; });
  return Math.round(total * 10) / 10;
}

const INTAKE_SLOTS = [
  { key: "front",     label: "Front",     icon: "⬆️", desc: "Face front of vehicle" },
  { key: "back",      label: "Back",      icon: "⬇️", desc: "Face rear of vehicle" },
  { key: "driver",    label: "Driver Side",   icon: "⬅️", desc: "Left side of vehicle" },
  { key: "passenger", label: "Passenger Side", icon: "➡️", desc: "Right side of vehicle" },
  { key: "dashboard", label: "Dashboard",  icon: "🎛️", desc: "Shows odometer reading" },
];

export default function TechJobView() {
  const [order, setOrder] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [tech, setTech] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [activeSection, setActiveSection] = useState("intake"); // intake | timer | job

  // Timer
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Form fields
  const [notes, setNotes] = useState("");
  const [mileage, setMileage] = useState("");
  const [vin, setVin] = useState("");
  const [status, setStatus] = useState("pending");
  const [techPhotos, setTechPhotos] = useState([]);
  const [vinLoading, setVinLoading] = useState(false);
  const [vinInfo, setVinInfo] = useState(null);

  // Intake photos: {front, back, driver, passenger, dashboard}
  const [intakePhotos, setIntakePhotos] = useState({});
  const [activeSlot, setActiveSlot] = useState(null);
  const cameraRef = useRef(null);
  const uploadRef = useRef(null);

  const orderId = new URLSearchParams(window.location.search).get("id");

  useEffect(() => {
    const saved = sessionStorage.getItem("tech_session");
    if (!saved) { window.location.href = "/TechPortal"; return; }
    setTech(JSON.parse(saved));

    base44.auth.me().then(u => {
      if (u && orderId) {
        base44.entities.RepairOrder.get(orderId).then(async o => {
          setOrder(o);
          setNotes(o.tech_notes || "");
          setMileage(o.mileage || "");
          setVin(o.vin || "");
          setStatus(o.status || "pending");
          if (o.tech_elapsed_seconds) setElapsed(o.tech_elapsed_seconds);
          if (o.tech_photos) {
            try { setTechPhotos(JSON.parse(o.tech_photos)); } catch {}
          }
          // Load vehicle
          if (o.vehicle_id) {
            try {
              const v = await base44.entities.Vehicle.get(o.vehicle_id);
              setVehicle(v);
              if (v.intake_photos) setIntakePhotos(v.intake_photos);
              if (v.vin && !o.vin) { setVin(v.vin); handleVinDecode(v.vin); }
              if (v.mileage && !o.mileage) setMileage(String(v.mileage));
            } catch {}
          }
        }).finally(() => setLoading(false));
      } else setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (timerRunning) {
      startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else clearInterval(timerRef.current);
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
    if (!vinVal || vinVal.length !== 17) return;
    setVinLoading(true);
    try {
      const res = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vinVal}?format=json`);
      const data = await res.json();
      const get = (variable) => data.Results?.find(r => r.Variable === variable)?.Value || "";
      const info = {
        year: get("Model Year"), make: get("Make"), model: get("Model"),
        trim: get("Trim"), engine: get("Displacement (L)") ? `${get("Displacement (L)")}L ${get("Engine Number of Cylinders")}-Cyl` : get("Engine Model"),
        fuel: get("Fuel Type - Primary"), drive: get("Drive Type"),
        transmission: get("Transmission Style"),
      };
      if (info.year && info.make) setVinInfo(info);
    } catch {}
    setVinLoading(false);
  };

  const handleIntakePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeSlot) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setIntakePhotos(prev => ({ ...prev, [activeSlot]: ev.target.result }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleTechPhoto = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTechPhotos(prev => [...prev, { data: ev.target.result, name: f.name, time: new Date().toISOString() }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const openCamera = (slot) => {
    setActiveSlot(slot);
    setTimeout(() => cameraRef.current?.click(), 50);
  };

  const openUpload = (slot) => {
    setActiveSlot(slot);
    setTimeout(() => uploadRef.current?.click(), 50);
  };

  const handleSave = async () => {
    if (!order) return;
    setSaving(true);
    try {
      // Save RO
      await base44.entities.RepairOrder.update(order.id, {
        tech_notes: notes, mileage, vin, status,
        tech_elapsed_seconds: elapsed,
        tech_photos: JSON.stringify(techPhotos),
        updated_by_tech: tech?.name,
        updated_by_tech_at: new Date().toISOString(),
      });

      // Update Vehicle record with new mileage + intake photos
      if (vehicle) {
        const newMileage = Number(mileage) || vehicle.mileage;
        const existingHistory = vehicle.mileage_history || [];
        const newEntry = {
          mileage: newMileage,
          date: new Date().toISOString().split("T")[0],
          ro_id: order.id,
          note: `Visit — ${tech?.name || "Tech"}`,
        };
        // Only add if mileage changed
        const lastEntry = existingHistory[existingHistory.length - 1];
        const historyUpdate = (!lastEntry || lastEntry.mileage !== newMileage)
          ? [...existingHistory, newEntry] : existingHistory;

        await base44.entities.Vehicle.update(vehicle.id, {
          mileage: newMileage,
          mileage_history: historyUpdate,
          intake_photos: intakePhotos,
          last_service_date: new Date().toISOString().split("T")[0],
          last_service_mileage: newMileage,
          ...(vinInfo ? {
            engine_type: vinInfo.engine,
            fuel_type: vinInfo.fuel,
            drive_type: vinInfo.drive,
            transmission: vinInfo.transmission,
            trim: vinInfo.trim,
          } : {}),
        });
      }

      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const estimatedHours = order ? parseTotalHours(order) : 0;
  const elapsedHours = Math.round((elapsed / 3600) * 10) / 10;
  const progressPct = estimatedHours > 0 ? Math.min(100, Math.round((elapsedHours / estimatedHours) * 100)) : 0;
  const intakeComplete = INTAKE_SLOTS.filter(s => intakePhotos[s.key]).length;

  const S = { // shared styles
    card: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:18, padding:20, marginBottom:14 },
    label: { color:"#64748b", fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10, display:"block" },
    input: { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:15, boxSizing:"border-box", fontFamily:"inherit" },
  };

  if (loading) return <div style={{minHeight:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#38bdf8"}}>Loading job...</div></div>;
  if (!order) return <div style={{minHeight:"100vh",background:"#020617",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:"#f87171"}}>Job not found.</div></div>;

  const statusOptions = [
    {value:"pending",label:"Pending",color:"#fbbf24"},
    {value:"in-progress",label:"In Progress",color:"#38bdf8"},
    {value:"waiting",label:"Waiting Parts",color:"#a78bfa"},
    {value:"completed",label:"Completed",color:"#4ade80"},
  ];

  return (
    <div style={{minHeight:"100vh", background:"#020617", fontFamily:"inherit", paddingBottom:130}}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderBottom:"1px solid rgba(0,170,255,0.2)",
        padding:"16px 20px", display:"flex", alignItems:"center", gap:14,
        position:"sticky", top:0, zIndex:100,
      }}>
        <button onClick={() => window.location.href="/TechDashboard"} style={{background:"transparent",border:"none",color:"#38bdf8",cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontSize:14,fontWeight:600,padding:0}}>
          <ArrowLeft style={{width:18,height:18}}/> Back
        </button>
        <div style={{flex:1}}>
          <h1 style={{color:"#fff",fontSize:18,fontWeight:800,margin:0}}>{order.customer_name}</h1>
          <p style={{color:"#38bdf8",fontSize:13,margin:0}}>{order.vehicle_info} · #{order.order_number}</p>
        </div>
        {/* Intake badge */}
        <div style={{
          background: intakeComplete === 5 ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.15)",
          border: `1px solid ${intakeComplete === 5 ? "rgba(74,222,128,0.4)" : "rgba(251,191,36,0.4)"}`,
          borderRadius:20, padding:"4px 10px", fontSize:11, fontWeight:700,
          color: intakeComplete === 5 ? "#4ade80" : "#fbbf24",
        }}>
          {intakeComplete}/5 photos
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex", background:"#0a0f1a", borderBottom:"1px solid #1e293b", position:"sticky", top:68, zIndex:90}}>
        {[
          {id:"intake", label:"🚗 Vehicle Intake"},
          {id:"timer",  label:"⏱ Timer"},
          {id:"job",    label:"🔧 Job Notes"},
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{
            flex:1, padding:"14px 8px", background:"transparent",
            border:"none", borderBottom: activeSection===tab.id ? "2px solid #00aaff" : "2px solid transparent",
            color: activeSection===tab.id ? "#00aaff" : "#475569",
            fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s",
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{padding:16}}>

        {/* ══════════ INTAKE TAB ══════════ */}
        {activeSection === "intake" && (
          <>
            {/* VIN */}
            <div style={S.card}>
              <span style={S.label}><Hash style={{width:12,height:12,display:"inline",marginRight:4}}/>VIN Number</span>
              <input
                value={vin}
                onChange={e => {
                  const v = e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g,"");
                  setVin(v);
                  if (v.length === 17) handleVinDecode(v);
                }}
                placeholder="Type or scan 17-digit VIN"
                style={{...S.input, fontFamily:"monospace", letterSpacing:1}}
              />
              {vinLoading && <p style={{color:"#38bdf8",fontSize:12,marginTop:6}}>🔍 Decoding VIN...</p>}

              {/* Decoded vehicle info */}
              {vinInfo && (
                <div style={{marginTop:12, background:"rgba(0,170,255,0.06)", border:"1px solid rgba(0,170,255,0.2)", borderRadius:12, padding:14}}>
                  <p style={{color:"#38bdf8",fontSize:16,fontWeight:800,margin:"0 0 10px"}}>
                    {vinInfo.year} {vinInfo.make} {vinInfo.model}
                    {vinInfo.trim && <span style={{color:"#64748b",fontSize:13,fontWeight:400}}> · {vinInfo.trim}</span>}
                  </p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[
                      {icon:"⚙️", label:"Engine", val: vinInfo.engine},
                      {icon:"⛽", label:"Fuel",   val: vinInfo.fuel},
                      {icon:"🔄", label:"Drive",  val: vinInfo.drive},
                      {icon:"🔧", label:"Trans",  val: vinInfo.transmission},
                    ].filter(i => i.val).map(item => (
                      <div key={item.label} style={{background:"#0f172a",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{color:"#64748b",fontSize:10,margin:"0 0 2px"}}>{item.icon} {item.label}</p>
                        <p style={{color:"#fff",fontSize:13,fontWeight:600,margin:0}}>{item.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Also show stored vehicle info */}
              {vehicle && !vinInfo && (
                <div style={{marginTop:10,background:"rgba(56,189,248,0.06)",border:"1px solid rgba(56,189,248,0.15)",borderRadius:10,padding:12}}>
                  <p style={{color:"#38bdf8",fontSize:14,fontWeight:700,margin:"0 0 6px"}}>
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {vehicle.engine_type && <span style={{color:"#64748b",fontSize:12}}>⚙️ {vehicle.engine_type}</span>}
                    {vehicle.fuel_type   && <span style={{color:"#64748b",fontSize:12}}>⛽ {vehicle.fuel_type}</span>}
                    {vehicle.drive_type  && <span style={{color:"#64748b",fontSize:12}}>🔄 {vehicle.drive_type}</span>}
                    {vehicle.color       && <span style={{color:"#64748b",fontSize:12}}>🎨 {vehicle.color}</span>}
                  </div>
                </div>
              )}
            </div>

            {/* Mileage */}
            <div style={S.card}>
              <span style={S.label}><Gauge style={{width:12,height:12,display:"inline",marginRight:4}}/>Current Mileage (km)</span>
              {vehicle?.mileage_history?.length > 0 && (
                <div style={{marginBottom:10,display:"flex",gap:8,flexWrap:"wrap"}}>
                  {vehicle.mileage_history.slice(-3).reverse().map((h,i) => (
                    <div key={i} style={{background:"#1e293b",borderRadius:8,padding:"4px 10px",fontSize:11,color:"#64748b"}}>
                      {h.date}: <span style={{color:"#94a3b8",fontWeight:600}}>{Number(h.mileage).toLocaleString()} km</span>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="number" inputMode="numeric"
                value={mileage}
                onChange={e => setMileage(e.target.value)}
                placeholder="e.g. 145000"
                onFocus={e => e.target.select()}
                style={{...S.input, fontSize:28, fontWeight:800, textAlign:"center", padding:"16px"}}
              />
            </div>

            {/* 4-way + Dashboard Photos */}
            <div style={S.card}>
              <span style={S.label}><Camera style={{width:12,height:12,display:"inline",marginRight:4}}/>Vehicle Intake Photos</span>
              <p style={{color:"#475569",fontSize:12,margin:"0 0 14px"}}>Take all 5 photos before receiving the keys from the customer.</p>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {INTAKE_SLOTS.map(slot => (
                  <div key={slot.key} style={{
                    borderRadius:14, overflow:"hidden",
                    border: intakePhotos[slot.key] ? "2px solid #4ade80" : "2px dashed #334155",
                    background:"#1e293b", aspectRatio: slot.key === "dashboard" ? "auto" : "4/3",
                    gridColumn: slot.key === "dashboard" ? "span 2" : "span 1",
                    position:"relative",
                  }}>
                    {intakePhotos[slot.key] ? (
                      <>
                        <img src={intakePhotos[slot.key]} alt={slot.label}
                          style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                        <div style={{position:"absolute",top:6,left:8,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"2px 8px",fontSize:11,color:"#4ade80",fontWeight:700}}>
                          ✓ {slot.label}
                        </div>
                        <button onClick={() => setIntakePhotos(p => ({...p,[slot.key]:null}))}
                          style={{position:"absolute",top:6,right:6,background:"rgba(239,68,68,0.8)",border:"none",borderRadius:6,padding:4,cursor:"pointer",color:"#fff",display:"flex"}}>
                          <Trash2 style={{width:12,height:12}}/>
                        </button>
                      </>
                    ) : (
                      <div style={{padding:16,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:90,gap:6}}>
                        <span style={{fontSize:24}}>{slot.icon}</span>
                        <p style={{color:"#64748b",fontSize:12,fontWeight:700,margin:0}}>{slot.label}</p>
                        <p style={{color:"#334155",fontSize:10,margin:0,textAlign:"center"}}>{slot.desc}</p>
                        <div style={{display:"flex",gap:6,marginTop:6}}>
                          <button onClick={() => openCamera(slot.key)} style={{
                            background:"#0f172a",border:"1px solid #334155",borderRadius:8,
                            padding:"6px 10px",color:"#64748b",cursor:"pointer",
                            display:"flex",alignItems:"center",gap:4,fontSize:11,
                          }}>
                            <Camera style={{width:12,height:12}}/> Camera
                          </button>
                          <button onClick={() => openUpload(slot.key)} style={{
                            background:"#0f172a",border:"1px solid #334155",borderRadius:8,
                            padding:"6px 10px",color:"#64748b",cursor:"pointer",
                            display:"flex",alignItems:"center",gap:4,fontSize:11,
                          }}>
                            <Upload style={{width:12,height:12}}/> Upload
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Hidden inputs */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleIntakePhoto}/>
              <input ref={uploadRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleIntakePhoto}/>
            </div>

            {/* Status */}
            <div style={S.card}>
              <span style={S.label}>Job Status</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {statusOptions.map(s => (
                  <button key={s.value} onClick={() => setStatus(s.value)} style={{
                    padding:"12px 10px",borderRadius:12,
                    border:`2px solid ${status===s.value ? s.color : "#1e293b"}`,
                    background: status===s.value ? `${s.color}15` : "#0f172a",
                    color: status===s.value ? s.color : "#475569",
                    fontSize:13,fontWeight:700,cursor:"pointer",transition:"all 0.15s",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══════════ TIMER TAB ══════════ */}
        {activeSection === "timer" && (
          <div style={S.card}>
            <span style={S.label}><Clock style={{width:12,height:12,display:"inline",marginRight:4}}/>Job Timer</span>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
              <div style={{textAlign:"center",background:"#020617",borderRadius:14,padding:16}}>
                <div style={{color:"#38bdf8",fontSize:40,fontWeight:800,fontVariantNumeric:"tabular-nums"}}>{formatTime(elapsed)}</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:4}}>Elapsed</div>
              </div>
              <div style={{textAlign:"center",background:"#020617",borderRadius:14,padding:16}}>
                <div style={{color:"#a78bfa",fontSize:40,fontWeight:800}}>{estimatedHours}h</div>
                <div style={{color:"#64748b",fontSize:12,marginTop:4}}>Estimated</div>
              </div>
            </div>

            {estimatedHours > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{background:"#1e293b",borderRadius:6,height:10,overflow:"hidden"}}>
                  <div style={{
                    width:`${progressPct}%`,height:"100%",
                    background: progressPct>=100 ? "#f87171" : "linear-gradient(90deg,#00aaff,#a78bfa)",
                    borderRadius:6,transition:"width 0.5s",
                  }}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                  <span style={{color:"#64748b",fontSize:12}}>{elapsedHours}h used</span>
                  <span style={{color:progressPct>=100?"#f87171":"#64748b",fontSize:12,fontWeight:600}}>{progressPct}%</span>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:10}}>
              {!timerRunning ? (
                <button onClick={() => setTimerRunning(true)} style={{
                  flex:1,background:"linear-gradient(135deg,#166534,#15803d)",
                  border:"none",borderRadius:12,padding:"14px",
                  color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                }}>
                  <Play style={{width:16,height:16}}/> Start Timer
                </button>
              ) : (
                <button onClick={() => setTimerRunning(false)} style={{
                  flex:1,background:"linear-gradient(135deg,#92400e,#b45309)",
                  border:"none",borderRadius:12,padding:"14px",
                  color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                }}>
                  <Pause style={{width:16,height:16}}/> Pause
                </button>
              )}
              <button onClick={() => {setTimerRunning(false);setElapsed(0);}} style={{
                background:"#1e293b",border:"1px solid #334155",borderRadius:12,padding:"14px 16px",
                color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
              }}>
                <StopCircle style={{width:16,height:16}}/>
              </button>
            </div>

            {/* Labor breakdown */}
            {order.labor_items && (() => {
              try {
                const items = typeof order.labor_items==="string" ? JSON.parse(order.labor_items) : order.labor_items;
                if (!items?.length) return null;
                return (
                  <div style={{marginTop:20}}>
                    <p style={{color:"#64748b",fontSize:11,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>Labor Breakdown</p>
                    {items.map((it,i) => (
                      <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1e293b"}}>
                        <span style={{color:"#94a3b8",fontSize:13}}>{it.description || it.name || "Labor"}</span>
                        <span style={{color:"#a78bfa",fontSize:13,fontWeight:700}}>{it.hours}h</span>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:"2px solid #334155",marginTop:4}}>
                      <span style={{color:"#fff",fontSize:14,fontWeight:700}}>Total</span>
                      <span style={{color:"#a78bfa",fontSize:14,fontWeight:800}}>{estimatedHours}h</span>
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
        )}

        {/* ══════════ JOB NOTES TAB ══════════ */}
        {activeSection === "job" && (
          <>
            {/* Job description */}
            {order.description && (
              <div style={{...S.card, background:"rgba(0,170,255,0.04)", border:"1px solid rgba(0,170,255,0.15)"}}>
                <span style={{...S.label, color:"#38bdf8"}}>📋 Job Description</span>
                <p style={{color:"#94a3b8",fontSize:14,margin:0,lineHeight:1.7}}>{order.description}</p>
              </div>
            )}

            {/* Tech notes */}
            <div style={S.card}>
              <span style={S.label}><Wrench style={{width:12,height:12,display:"inline",marginRight:4}}/>Tech Notes</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="What did you find? What did you do? Parts replaced, issues noticed..."
                rows={6}
                style={{...S.input, resize:"vertical"}}
              />
            </div>

            {/* Extra photos */}
            <div style={S.card}>
              <span style={S.label}><Image style={{width:12,height:12,display:"inline",marginRight:4}}/>Job Photos ({techPhotos.length})</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <button onClick={() => { uploadRef.current.onchange=handleTechPhoto; uploadRef.current.accept="image/*"; uploadRef.current.capture="environment"; uploadRef.current.click(); }}
                  style={{background:"#1e293b",border:"1px dashed #334155",borderRadius:12,padding:"14px",color:"#64748b",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontSize:12}}>
                  <Camera style={{width:20,height:20}}/> Camera
                </button>
                <button onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept="image/*"; i.multiple=true; i.onchange=handleTechPhoto; i.click(); }}
                  style={{background:"#1e293b",border:"1px dashed #334155",borderRadius:12,padding:"14px",color:"#64748b",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:6,fontSize:12}}>
                  <Upload style={{width:20,height:20}}/> Upload
                </button>
              </div>
              {techPhotos.length > 0 && (
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {techPhotos.map((p,i) => (
                    <div key={i} style={{position:"relative",borderRadius:10,overflow:"hidden",aspectRatio:"4/3",background:"#1e293b"}}>
                      <img src={p.data} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                      <button onClick={() => setTechPhotos(prev => prev.filter((_,j)=>j!==i))}
                        style={{position:"absolute",top:4,right:4,background:"rgba(239,68,68,0.85)",border:"none",borderRadius:6,padding:4,cursor:"pointer",color:"#fff",display:"flex"}}>
                        <Trash2 style={{width:11,height:11}}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={S.card}>
              <span style={S.label}>Job Status</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {statusOptions.map(s => (
                  <button key={s.value} onClick={() => setStatus(s.value)} style={{
                    padding:"12px",borderRadius:12,
                    border:`2px solid ${status===s.value ? s.color : "#1e293b"}`,
                    background: status===s.value ? `${s.color}15` : "#0f172a",
                    color: status===s.value ? s.color : "#475569",
                    fontSize:13,fontWeight:700,cursor:"pointer",
                  }}>{s.label}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky save bar */}
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderTop:"1px solid rgba(0,170,255,0.2)",
        padding:"14px 20px",display:"flex",alignItems:"center",gap:12,zIndex:200,
      }}>
        <div style={{flex:1}}>
          <p style={{color:"#64748b",fontSize:11,margin:0}}>Total Labor</p>
          <p style={{color:"#a78bfa",fontSize:17,fontWeight:800,margin:0}}>
            {estimatedHours}h est · {elapsedHours}h actual
          </p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,marginRight:8}}>
          <div style={{
            width:8,height:8,borderRadius:"50%",
            background: intakeComplete===5 ? "#4ade80" : "#fbbf24",
            boxShadow: intakeComplete===5 ? "0 0 6px #4ade80" : "0 0 6px #fbbf24",
          }}/>
          <span style={{color:intakeComplete===5?"#4ade80":"#fbbf24",fontSize:11,fontWeight:600}}>
            {intakeComplete}/5
          </span>
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          background: savedOk ? "linear-gradient(135deg,#166534,#15803d)" : "linear-gradient(135deg,#1d4ed8,#2563eb)",
          border:"none",borderRadius:14,padding:"14px 28px",
          color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",
          display:"flex",alignItems:"center",gap:8,
          boxShadow: savedOk ? "0 4px 16px rgba(34,197,94,0.4)" : "0 4px 16px rgba(37,99,235,0.4)",
        }}>
          {saving ? "Saving..." : savedOk ? <><CheckCircle2 style={{width:18,height:18}}/> Saved!</> : "Save Job"}
        </button>
      </div>

    </div>
  );
}
