import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, MapPin, Car, Wrench, FileText,
  Clock, Bell, BellOff, Send, CheckCircle2, TrendingUp,
  Calendar, Gauge, Image, ChevronRight, Plus, Edit2,
  MessageSquare, AlertCircle, RefreshCw, X
} from "lucide-react";

function RetentionDot({ lastVisit }) {
  if (!lastVisit) return <span style={{ color:"#64748b", fontSize:11 }}>No visits</span>;
  const days = Math.floor((Date.now() - new Date(lastVisit)) / 86400000);
  const color = days < 30 ? "#4ade80" : days < 90 ? "#fbbf24" : "#f87171";
  const label = days < 30 ? "Recent" : days < 90 ? `${days}d ago` : `${days}d ago`;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:color, boxShadow:`0 0 6px ${color}` }}/>
      <span style={{ color, fontSize:11, fontWeight:600 }}>{label}</span>
    </div>
  );
}

function MileageChart({ history }) {
  if (!history?.length) return null;
  const sorted = [...history].sort((a,b) => new Date(a.date) - new Date(b.date));
  const max = Math.max(...sorted.map(h => h.mileage));
  const min = Math.min(...sorted.map(h => h.mileage));
  const range = max - min || 1;

  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:60 }}>
        {sorted.map((h, i) => {
          const pct = ((h.mileage - min) / range) * 100;
          const barH = Math.max(8, (pct / 100) * 52);
          return (
            <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ color:"#64748b", fontSize:9 }}>{Number(h.mileage).toLocaleString()}</span>
              <div style={{
                width:"100%", height:barH,
                background:"linear-gradient(to top,#1d4ed8,#38bdf8)",
                borderRadius:4, minHeight:8,
              }}/>
              <span style={{ color:"#334155", fontSize:8 }}>{h.date?.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [estimates, setEstimates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [savingReminder, setSavingReminder] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    service_interval_km: "",
    service_interval_months: "",
    reminder_email: true,
    reminder_sms: false,
  });

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (!id || !u) { setLoading(false); return; }

      Promise.all([
        base44.entities.Customer.get(id),
        base44.entities.Vehicle.filter({ customer_id: id }, "-created_date", 20),
        base44.entities.RepairOrder.filter({ customer_id: id }, "-created_date", 50),
        base44.entities.Invoice.filter({ customer_id: id }, "-created_date", 50),
        base44.entities.Estimate.filter({ customer_id: id }, "-created_date", 50),
      ]).then(([c, v, o, inv, est]) => {
        setCustomer(c);
        setVehicles(v);
        setOrders(o);
        setInvoices(inv);
        setEstimates(est);
        if (v.length > 0) {
          setSelectedVehicle(v[0]);
          setReminderForm({
            service_interval_km: v[0].service_interval_km || "",
            service_interval_months: v[0].service_interval_months || "",
            reminder_email: v[0].reminder_email ?? true,
            reminder_sms: v[0].reminder_sms ?? false,
          });
        }
      }).finally(() => setLoading(false));
    });
  }, [id]);

  const selectVehicle = (v) => {
    setSelectedVehicle(v);
    setReminderForm({
      service_interval_km: v.service_interval_km || "",
      service_interval_months: v.service_interval_months || "",
      reminder_email: v.reminder_email ?? true,
      reminder_sms: v.reminder_sms ?? false,
    });
  };

  const totalSpend = invoices.reduce((s, inv) => s + (inv.amount_paid || 0), 0);
  const lastOrder = orders[0];
  const nextServiceKm = selectedVehicle
    ? (selectedVehicle.last_service_mileage || 0) + (selectedVehicle.service_interval_km || 0)
    : null;
  const kmUntilService = nextServiceKm && selectedVehicle?.mileage
    ? nextServiceKm - selectedVehicle.mileage : null;

  const saveReminderSettings = async () => {
    if (!selectedVehicle) return;
    setSavingReminder(true);
    await base44.entities.Vehicle.update(selectedVehicle.id, {
      service_interval_km: Number(reminderForm.service_interval_km) || null,
      service_interval_months: Number(reminderForm.service_interval_months) || null,
      reminder_email: reminderForm.reminder_email,
      reminder_sms: reminderForm.reminder_sms,
    });
    setSelectedVehicle(prev => ({ ...prev, ...reminderForm }));
    setSavingReminder(false);
  };

  const sendReminderEmail = async () => {
    if (!customer?.email || !selectedVehicle) return;
    setSendingEmail(true);
    try {
      const vehicleStr = `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
      const km = selectedVehicle.service_interval_km;
      const months = selectedVehicle.service_interval_months;
      const subject = `Service Reminder — Your ${vehicleStr}`;
      const body = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0f1a;color:#fff;padding:32px;border-radius:12px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="color:#38bdf8;font-size:22px;margin:0;">🔧 Service Reminder</h1>
          </div>
          <p style="color:#94a3b8;">Hi ${customer.full_name},</p>
          <p style="color:#94a3b8;">Your <strong style="color:#fff;">${vehicleStr}</strong> is due for its next service.</p>
          ${km ? `<div style="background:#1e293b;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#64748b;font-size:12px;">SERVICE DUE</p>
            <p style="margin:4px 0 0;color:#38bdf8;font-size:20px;font-weight:bold;">Every ${Number(km).toLocaleString()} km</p>
            ${selectedVehicle.mileage ? `<p style="margin:4px 0 0;color:#64748b;font-size:13px;">Current: ${Number(selectedVehicle.mileage).toLocaleString()} km</p>` : ""}
          </div>` : ""}
          ${months ? `<p style="color:#94a3b8;">Also recommended every <strong style="color:#fff;">${months} months</strong>.</p>` : ""}
          <p style="color:#94a3b8;">Call us to schedule your appointment.</p>
          <div style="text-align:center;margin-top:28px;">
            <a href="tel:${customer.phone}" style="background:#1d4ed8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
              📞 Book Now
            </a>
          </div>
          <p style="color:#334155;font-size:11px;text-align:center;margin-top:24px;">Powered by LBC Auto</p>
        </div>`;

      await base44.functions.invoke("sendEmail", {
        to: customer.email,
        subject,
        html: body,
      });

      await base44.entities.Vehicle.update(selectedVehicle.id, {
        reminder_sent_date: new Date().toISOString().split("T")[0],
      });

      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (e) { console.error(e); }
    setSendingEmail(false);
  };

  const S = {
    card: { background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:18, marginBottom:14 },
    label: { color:"#64748b", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" },
    val: { color:"#fff", fontSize:14, fontWeight:600, marginTop:2 },
    input: { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:14, boxSizing:"border-box" },
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0a0f1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#38bdf8" }}>Loading customer...</div>
    </div>
  );

  if (!customer) return (
    <div style={{ minHeight:"100vh", background:"#0a0f1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#f87171" }}>Customer not found.</div>
    </div>
  );

  const tabs = [
    { id:"overview", label:"Overview" },
    { id:"vehicles", label:`Vehicles (${vehicles.length})` },
    { id:"history",  label:`History (${orders.length})` },
    { id:"reminders",label:"Reminders" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1a", fontFamily:"inherit", paddingBottom:40 }}>

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#0f172a,#1e293b)",
        borderBottom:"1px solid #1e293b", padding:"20px 20px 0",
      }}>
        <button onClick={() => navigate(-1)} style={{
          background:"transparent", border:"none", color:"#38bdf8",
          cursor:"pointer", display:"flex", alignItems:"center", gap:6,
          fontSize:13, fontWeight:600, marginBottom:16, padding:0,
        }}>
          <ArrowLeft style={{ width:16, height:16 }}/> Back
        </button>

        {/* Customer hero */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:16, marginBottom:20 }}>
          <div style={{
            width:64, height:64, borderRadius:"50%", flexShrink:0,
            background:"linear-gradient(135deg,#1d4ed8,#7c3aed)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:24, fontWeight:800, color:"#fff",
            border:"3px solid rgba(56,189,248,0.3)",
          }}>
            {customer.full_name?.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:"0 0 4px" }}>{customer.full_name}</h1>
            {customer.phone && (
              <a href={`tel:${customer.phone}`} style={{ color:"#38bdf8", fontSize:14, display:"flex", alignItems:"center", gap:5, marginBottom:3, textDecoration:"none" }}>
                <Phone style={{ width:13, height:13 }}/> {customer.phone}
              </a>
            )}
            {customer.email && (
              <p style={{ color:"#64748b", fontSize:13, display:"flex", alignItems:"center", gap:5, margin:"2px 0" }}>
                <Mail style={{ width:12, height:12 }}/> {customer.email}
              </p>
            )}
            <div style={{ marginTop:6 }}>
              <RetentionDot lastVisit={customer.last_visit} />
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
          {[
            { label:"Total Visits", val: orders.length + invoices.length, color:"#38bdf8" },
            { label:"Total Spent", val: `$${totalSpend.toFixed(0)}`, color:"#4ade80" },
            { label:"Vehicles", val: vehicles.length, color:"#a78bfa" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
              <div style={{ color:s.color, fontSize:22, fontWeight:800 }}>{s.val}</div>
              <div style={{ color:"#475569", fontSize:10, marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, marginBottom:0, overflowX:"auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex:1, padding:"12px 8px", background:"transparent",
              border:"none", borderBottom:`2px solid ${activeTab===t.id ? "#38bdf8" : "transparent"}`,
              color: activeTab===t.id ? "#38bdf8" : "#475569",
              fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:16 }}>

        {/* ══════ OVERVIEW ══════ */}
        {activeTab === "overview" && (
          <>
            {/* Last vehicle worked on */}
            {customer.last_vehicle_info && (
              <div style={{ ...S.card, background:"rgba(0,170,255,0.05)", border:"1px solid rgba(0,170,255,0.2)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                  <Car style={{ width:16, height:16, color:"#38bdf8" }}/>
                  <span style={{ color:"#38bdf8", fontSize:13, fontWeight:700 }}>Last Vehicle</span>
                </div>
                <p style={{ color:"#fff", fontSize:16, fontWeight:700, margin:0 }}>{customer.last_vehicle_info}</p>
                {customer.last_visit && <p style={{ color:"#64748b", fontSize:12, margin:"4px 0 0" }}>Last visit: {customer.last_visit}</p>}
              </div>
            )}

            {/* Vehicle quick cards */}
            {vehicles.length > 0 && vehicles.map(v => {
              const history = v.mileage_history || [];
              const lastKm = v.mileage ? Number(v.mileage).toLocaleString() : "—";
              const nextKm = v.service_interval_km && v.last_service_mileage
                ? Number(v.last_service_mileage + v.service_interval_km).toLocaleString() : null;
              const overdue = v.service_interval_km && v.mileage && v.last_service_mileage
                ? v.mileage >= (v.last_service_mileage + v.service_interval_km) : false;

              return (
                <div key={v.id} style={S.card}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
                    <div>
                      <p style={{ color:"#fff", fontSize:16, fontWeight:800, margin:0 }}>
                        {v.year} {v.make} {v.model}
                        {v.trim && <span style={{ color:"#64748b", fontWeight:400, fontSize:13 }}> {v.trim}</span>}
                      </p>
                      {v.color && <p style={{ color:"#64748b", fontSize:12, margin:"3px 0 0" }}>🎨 {v.color}</p>}
                    </div>
                    {overdue && (
                      <div style={{ background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:20, padding:"3px 10px", fontSize:11, color:"#f87171", fontWeight:700 }}>
                        ⚠️ Service Due
                      </div>
                    )}
                  </div>

                  {/* Specs row */}
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                    {[
                      v.engine_type && `⚙️ ${v.engine_type}`,
                      v.fuel_type && `⛽ ${v.fuel_type}`,
                      v.drive_type && `🔄 ${v.drive_type}`,
                      v.transmission && `🔧 ${v.transmission}`,
                    ].filter(Boolean).map((spec, i) => (
                      <span key={i} style={{ background:"#1e293b", borderRadius:6, padding:"4px 8px", fontSize:11, color:"#94a3b8" }}>{spec}</span>
                    ))}
                  </div>

                  {/* Mileage row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
                    <div style={{ background:"#1e293b", borderRadius:10, padding:"10px 12px" }}>
                      <p style={{ ...S.label, margin:0 }}>Current KM</p>
                      <p style={{ color:"#38bdf8", fontSize:18, fontWeight:800, margin:"3px 0 0" }}>{lastKm}</p>
                    </div>
                    <div style={{ background:"#1e293b", borderRadius:10, padding:"10px 12px" }}>
                      <p style={{ ...S.label, margin:0 }}>Next Service</p>
                      <p style={{ color: overdue ? "#f87171" : "#4ade80", fontSize:18, fontWeight:800, margin:"3px 0 0" }}>
                        {nextKm ? `${nextKm} km` : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Mileage chart */}
                  {history.length > 1 && (
                    <>
                      <p style={{ ...S.label, margin:"0 0 4px" }}>Mileage History</p>
                      <MileageChart history={history} />
                    </>
                  )}

                  {/* VIN */}
                  {v.vin && (
                    <p style={{ color:"#334155", fontSize:10, fontFamily:"monospace", marginTop:10, margin:"10px 0 0" }}>
                      VIN: {v.vin}
                    </p>
                  )}

                  {/* Intake photos preview */}
                  {v.intake_photos && Object.keys(v.intake_photos).some(k => v.intake_photos[k]) && (
                    <div style={{ marginTop:12 }}>
                      <p style={{ ...S.label, marginBottom:6 }}>Intake Photos</p>
                      <div style={{ display:"flex", gap:6, overflowX:"auto" }}>
                        {["front","back","driver","passenger","dashboard"].map(k => v.intake_photos[k] && (
                          <img key={k} src={v.intake_photos[k]} alt={k}
                            style={{ width:70, height:52, objectFit:"cover", borderRadius:8, flexShrink:0, border:"1px solid #1e293b" }}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Recent activity */}
            {lastOrder && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:10 }}>Last Repair Order</p>
                <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{lastOrder.description || "Service"}</p>
                <p style={{ color:"#64748b", fontSize:12, margin:"4px 0 0" }}>{lastOrder.created_date?.slice(0,10)} · #{lastOrder.order_number}</p>
                {lastOrder.status && (
                  <span style={{
                    display:"inline-block", marginTop:6,
                    background: lastOrder.status==="completed" ? "rgba(74,222,128,0.1)" : "rgba(251,191,36,0.1)",
                    color: lastOrder.status==="completed" ? "#4ade80" : "#fbbf24",
                    border: `1px solid ${lastOrder.status==="completed" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)"}`,
                    borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, textTransform:"capitalize",
                  }}>{lastOrder.status}</span>
                )}
              </div>
            )}
          </>
        )}

        {/* ══════ VEHICLES TAB ══════ */}
        {activeTab === "vehicles" && (
          <>
            {vehicles.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Car style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No vehicles linked yet.</p>
              </div>
            ) : vehicles.map(v => (
              <div key={v.id} style={S.card}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                  <p style={{ color:"#fff", fontSize:16, fontWeight:800, margin:0 }}>
                    {v.year} {v.make} {v.model}
                  </p>
                  <button onClick={() => selectVehicle(v) & setActiveTab("reminders")} style={{
                    background:"rgba(56,189,248,0.1)", border:"1px solid rgba(56,189,248,0.3)",
                    color:"#38bdf8", borderRadius:8, padding:"4px 10px", fontSize:11, cursor:"pointer",
                  }}>Set Reminder</button>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                  {[
                    { l:"Engine", v:v.engine_type },
                    { l:"Fuel",   v:v.fuel_type },
                    { l:"Drive",  v:v.drive_type },
                    { l:"Trans",  v:v.transmission },
                    { l:"Color",  v:v.color },
                    { l:"Plate",  v:v.license_plate },
                  ].filter(f=>f.v).map(f => (
                    <div key={f.l} style={{ background:"#1e293b", borderRadius:8, padding:"8px 10px" }}>
                      <p style={{ ...S.label, margin:0 }}>{f.l}</p>
                      <p style={{ color:"#fff", fontSize:13, fontWeight:600, margin:"2px 0 0" }}>{f.v}</p>
                    </div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div style={{ background:"#1e293b", borderRadius:8, padding:"8px 10px" }}>
                    <p style={{ ...S.label, margin:0 }}>Current KM</p>
                    <p style={{ color:"#38bdf8", fontSize:15, fontWeight:700, margin:"2px 0 0" }}>
                      {v.mileage ? Number(v.mileage).toLocaleString() : "—"}
                    </p>
                  </div>
                  <div style={{ background:"#1e293b", borderRadius:8, padding:"8px 10px" }}>
                    <p style={{ ...S.label, margin:0 }}>Last Service</p>
                    <p style={{ color:"#4ade80", fontSize:15, fontWeight:700, margin:"2px 0 0" }}>
                      {v.last_service_date || "—"}
                    </p>
                  </div>
                </div>

                {/* Full mileage history */}
                {v.mileage_history?.length > 0 && (
                  <div style={{ marginTop:12 }}>
                    <p style={{ ...S.label, marginBottom:8 }}>Mileage History</p>
                    <MileageChart history={v.mileage_history} />
                    <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:6 }}>
                      {[...v.mileage_history].reverse().map((h,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:"1px solid #1e293b" }}>
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
                  </div>
                )}

                {/* Intake photos */}
                {v.intake_photos && Object.values(v.intake_photos).some(Boolean) && (
                  <div style={{ marginTop:12 }}>
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
              </div>
            ))}
          </>
        )}

        {/* ══════ HISTORY TAB ══════ */}
        {activeTab === "history" && (
          <>
            {orders.length === 0 && invoices.length === 0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:40 }}>
                <Wrench style={{ width:36, height:36, color:"#334155", margin:"0 auto 12px" }}/>
                <p style={{ color:"#475569" }}>No service history yet.</p>
              </div>
            ) : (
              <>
                {/* Repair Orders */}
                {orders.map(o => (
                  <div key={o.id} style={S.card}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                      <div>
                        <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>{o.description || "Repair Order"}</p>
                        <p style={{ color:"#64748b", fontSize:12, margin:"3px 0 0" }}>{o.created_date?.slice(0,10)} · RO #{o.order_number}</p>
                      </div>
                      <span style={{
                        background: o.status==="completed" ? "rgba(74,222,128,0.1)" : "rgba(56,189,248,0.1)",
                        color: o.status==="completed" ? "#4ade80" : "#38bdf8",
                        border: `1px solid ${o.status==="completed" ? "rgba(74,222,128,0.3)" : "rgba(56,189,248,0.3)"}`,
                        borderRadius:20, padding:"2px 10px", fontSize:10, fontWeight:700, textTransform:"capitalize", whiteSpace:"nowrap",
                      }}>{o.status || "pending"}</span>
                    </div>
                    {o.vehicle_info && <p style={{ color:"#38bdf8", fontSize:12 }}>🚗 {o.vehicle_info}</p>}
                    {o.mileage && <p style={{ color:"#64748b", fontSize:12 }}>📍 {Number(o.mileage).toLocaleString()} km</p>}
                  </div>
                ))}

                {/* Invoices */}
                {invoices.map(inv => (
                  <div key={inv.id} style={S.card}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <p style={{ color:"#fff", fontSize:14, fontWeight:700, margin:0 }}>Invoice #{inv.invoice_number}</p>
                        <p style={{ color:"#64748b", fontSize:12, margin:"3px 0 0" }}>{inv.created_date?.slice(0,10)}</p>
                      </div>
                      <p style={{ color:"#4ade80", fontSize:16, fontWeight:800, margin:0 }}>
                        ${(inv.amount_paid || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ══════ REMINDERS TAB ══════ */}
        {activeTab === "reminders" && (
          <>
            {/* Vehicle selector */}
            {vehicles.length > 1 && (
              <div style={S.card}>
                <p style={{ ...S.label, marginBottom:10 }}>Select Vehicle</p>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {vehicles.map(v => (
                    <button key={v.id} onClick={() => selectVehicle(v)} style={{
                      background: selectedVehicle?.id===v.id ? "rgba(56,189,248,0.1)" : "#1e293b",
                      border: `1px solid ${selectedVehicle?.id===v.id ? "rgba(56,189,248,0.4)" : "#334155"}`,
                      borderRadius:10, padding:"10px 14px", cursor:"pointer",
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      color: selectedVehicle?.id===v.id ? "#38bdf8" : "#94a3b8",
                      fontSize:13, fontWeight:600,
                    }}>
                      <span>{v.year} {v.make} {v.model}</span>
                      {selectedVehicle?.id===v.id && <CheckCircle2 style={{ width:16, height:16 }}/>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedVehicle && (
              <>
                {/* Service interval */}
                <div style={S.card}>
                  <p style={{ ...S.label, marginBottom:14 }}>
                    <Bell style={{ width:12, height:12, display:"inline", marginRight:4 }}/>
                    Service Intervals — {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}
                  </p>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
                    <div>
                      <p style={{ ...S.label, marginBottom:6 }}>Every X km</p>
                      <input
                        type="number" inputMode="numeric"
                        value={reminderForm.service_interval_km}
                        onChange={e => setReminderForm(f => ({...f, service_interval_km: e.target.value}))}
                        placeholder="e.g. 5000"
                        onFocus={e => e.target.select()}
                        style={S.input}
                      />
                    </div>
                    <div>
                      <p style={{ ...S.label, marginBottom:6 }}>Every X months</p>
                      <input
                        type="number" inputMode="numeric"
                        value={reminderForm.service_interval_months}
                        onChange={e => setReminderForm(f => ({...f, service_interval_months: e.target.value}))}
                        placeholder="e.g. 6"
                        onFocus={e => e.target.select()}
                        style={S.input}
                      />
                    </div>
                  </div>

                  {/* Status */}
                  {selectedVehicle.mileage && reminderForm.service_interval_km && (
                    <div style={{
                      background: kmUntilService <= 0 ? "rgba(239,68,68,0.1)" : "rgba(74,222,128,0.1)",
                      border: `1px solid ${kmUntilService <= 0 ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.3)"}`,
                      borderRadius:10, padding:"10px 14px", marginBottom:14,
                    }}>
                      {kmUntilService <= 0 ? (
                        <p style={{ color:"#f87171", fontSize:13, fontWeight:700, margin:0 }}>
                          ⚠️ Service overdue by {Math.abs(kmUntilService).toLocaleString()} km
                        </p>
                      ) : (
                        <p style={{ color:"#4ade80", fontSize:13, fontWeight:700, margin:0 }}>
                          ✅ {kmUntilService.toLocaleString()} km until next service
                        </p>
                      )}
                    </div>
                  )}

                  {/* Reminder channels */}
                  <p style={{ ...S.label, marginBottom:10 }}>Reminder Channels</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                    {/* Email */}
                    <div style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      background:"#1e293b", borderRadius:10, padding:"12px 14px",
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <Mail style={{ width:16, height:16, color:"#38bdf8" }}/>
                        <div>
                          <p style={{ color:"#fff", fontSize:13, fontWeight:600, margin:0 }}>Email</p>
                          <p style={{ color:"#64748b", fontSize:11, margin:0 }}>{customer.email || "No email saved"}</p>
                        </div>
                      </div>
                      <button onClick={() => setReminderForm(f => ({...f, reminder_email: !f.reminder_email}))} style={{
                        width:44, height:24, borderRadius:12,
                        background: reminderForm.reminder_email ? "#1d4ed8" : "#334155",
                        border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s",
                      }}>
                        <div style={{
                          width:18, height:18, borderRadius:"50%", background:"#fff",
                          position:"absolute", top:3,
                          left: reminderForm.reminder_email ? 22 : 3,
                          transition:"left 0.2s",
                        }}/>
                      </button>
                    </div>

                    {/* SMS */}
                    <div style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      background:"#1e293b", borderRadius:10, padding:"12px 14px",
                      opacity:0.6,
                    }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <MessageSquare style={{ width:16, height:16, color:"#a78bfa" }}/>
                        <div>
                          <p style={{ color:"#fff", fontSize:13, fontWeight:600, margin:0 }}>SMS</p>
                          <p style={{ color:"#fbbf24", fontSize:11, margin:0 }}>⚡ Coming Soon — Twilio</p>
                        </div>
                      </div>
                      <div style={{
                        background:"#334155", border:"1px solid #475569",
                        borderRadius:20, padding:"3px 10px", fontSize:10, color:"#64748b", fontWeight:700,
                      }}>Soon</div>
                    </div>
                  </div>

                  <button onClick={saveReminderSettings} disabled={savingReminder} style={{
                    width:"100%",
                    background:"linear-gradient(135deg,#1d4ed8,#2563eb)",
                    border:"none", borderRadius:10, padding:"12px",
                    color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  }}>
                    {savingReminder ? "Saving..." : <><CheckCircle2 style={{ width:15, height:15 }}/> Save Settings</>}
                  </button>
                </div>

                {/* Send reminder now */}
                {customer.email && reminderForm.reminder_email && (
                  <div style={{ ...S.card, background:"rgba(74,222,128,0.04)", border:"1px solid rgba(74,222,128,0.2)" }}>
                    <p style={{ ...S.label, color:"#4ade80", marginBottom:6 }}>
                      <Send style={{ width:12, height:12, display:"inline", marginRight:4 }}/>
                      Send Reminder Now
                    </p>
                    <p style={{ color:"#64748b", fontSize:12, marginBottom:14, lineHeight:1.5 }}>
                      Sends a branded service reminder email to <strong style={{ color:"#94a3b8" }}>{customer.email}</strong> for their {selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}.
                    </p>
                    <button onClick={sendReminderEmail} disabled={sendingEmail} style={{
                      width:"100%",
                      background: emailSent ? "linear-gradient(135deg,#166534,#15803d)" : "linear-gradient(135deg,#166534,#15803d)",
                      border:"none", borderRadius:10, padding:"12px",
                      color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                      opacity: sendingEmail ? 0.7 : 1,
                    }}>
                      {sendingEmail ? "Sending..." : emailSent
                        ? <><CheckCircle2 style={{ width:15, height:15 }}/> Email Sent!</>
                        : <><Send style={{ width:15, height:15 }}/> Send Email Reminder</>
                      }
                    </button>
                    {selectedVehicle.reminder_sent_date && (
                      <p style={{ color:"#334155", fontSize:11, textAlign:"center", marginTop:8 }}>
                        Last sent: {selectedVehicle.reminder_sent_date}
                      </p>
                    )}
                  </div>
                )}

                {!customer.email && (
                  <div style={{ ...S.card, background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.2)" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <AlertCircle style={{ width:16, height:16, color:"#f87171" }}/>
                      <p style={{ color:"#f87171", fontSize:13, margin:0 }}>No email on file — add customer email to send reminders.</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
