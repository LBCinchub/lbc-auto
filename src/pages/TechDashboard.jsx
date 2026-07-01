import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Wrench, Clock, CheckCircle2, AlertCircle, LogOut, ChevronRight, Car } from "lucide-react";

export default function TechDashboard() {
  const [tech, setTech] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("tech_session");
    if (!saved) { window.location.href = "/TechPortal"; return; }
    const t = JSON.parse(saved);
    setTech(t);

    base44.auth.me().then(u => {
      setUser(u);
      // Use owner_email from session to scope orders to the right shop
      const ownerEmail = t.owner_email || (u ? u.email : null);
      if (ownerEmail) {
        base44.entities.RepairOrder.filter({ created_by: ownerEmail }, "-created_date", 200)
          .then(all => {
            // Show only ROs assigned to this specific tech
            const mine = all.filter(o =>
              (o.mechanic_name || "").toLowerCase().includes(t.name.toLowerCase()) ||
              o.mechanic_id === t.id
            );
            setOrders(mine);
          }).finally(() => setLoading(false));
      } else setLoading(false);
    });
  }, []);

  const logout = () => {
    sessionStorage.removeItem("tech_session");
    window.location.href = "/TechPortal";
  };

  const statusColor = (s) => ({
    pending: { bg:"rgba(251,191,36,0.1)", border:"rgba(251,191,36,0.3)", text:"#fbbf24" },
    "in-progress": { bg:"rgba(56,189,248,0.1)", border:"rgba(56,189,248,0.3)", text:"#38bdf8" },
    completed: { bg:"rgba(74,222,128,0.1)", border:"rgba(74,222,128,0.3)", text:"#4ade80" },
    waiting: { bg:"rgba(167,139,250,0.1)", border:"rgba(167,139,250,0.3)", text:"#a78bfa" },
  }[s] || { bg:"rgba(100,116,139,0.1)", border:"rgba(100,116,139,0.3)", text:"#94a3b8" });

  const inProgress = orders.filter(o => o.status === "in-progress").length;
  const pending = orders.filter(o => o.status === "pending" || o.status === "waiting").length;
  const done = orders.filter(o => o.status === "completed").length;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#020617", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ color:"#38bdf8", fontSize:18 }}>Loading your jobs...</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#020617", fontFamily:"inherit" }}>
      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#001f3f,#003366)",
        borderBottom:"1px solid rgba(0,170,255,0.2)",
        padding:"20px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:48, height:48, borderRadius:"50%",
            background:"rgba(0,170,255,0.2)", border:"2px solid #00aaff",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Wrench style={{ width:22, height:22, color:"#00aaff" }} />
          </div>
          <div>
            <p style={{ color:"#94a3b8", fontSize:12, margin:0 }}>Logged in as</p>
            <h1 style={{ color:"#fff", fontSize:22, fontWeight:800, margin:0 }}>{tech?.name}</h1>
            {tech?.specialty && <p style={{ color:"#38bdf8", fontSize:12, margin:0 }}>{tech.specialty}</p>}
          </div>
        </div>
        <button onClick={logout} style={{
          background:"transparent", border:"1px solid #334155",
          color:"#94a3b8", borderRadius:10, padding:"8px 14px",
          display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:13,
        }}>
          <LogOut style={{ width:14, height:14 }} /> Logout
        </button>
      </div>

      {/* Stats */}
      <div style={{ padding:"20px 24px 0", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        {[
          { label:"In Progress", value:inProgress, color:"#38bdf8" },
          { label:"Pending", value:pending, color:"#fbbf24" },
          { label:"Completed", value:done, color:"#4ade80" },
        ].map(s => (
          <div key={s.label} style={{
            background:"#0f172a", border:"1px solid #1e293b",
            borderRadius:14, padding:"14px 16px", textAlign:"center",
          }}>
            <div style={{ color:s.color, fontSize:30, fontWeight:800 }}>{s.value}</div>
            <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Jobs List */}
      <div style={{ padding:24 }}>
        <h2 style={{ color:"#94a3b8", fontSize:13, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:14 }}>
          Your Repair Orders ({orders.length})
        </h2>

        {orders.length === 0 ? (
          <div style={{
            background:"#0f172a", border:"1px solid #1e293b", borderRadius:16,
            padding:40, textAlign:"center",
          }}>
            <Wrench style={{ width:40, height:40, color:"#334155", margin:"0 auto 12px" }} />
            <p style={{ color:"#475569", fontSize:15 }}>No repair orders assigned to you yet.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {orders.map(order => {
              const sc = statusColor(order.status);
              // Parse total labor hours from labor_items
              let totalHours = 0;
              try {
                const items = typeof order.labor_items === "string"
                  ? JSON.parse(order.labor_items) : (order.labor_items || []);
                totalHours = items.reduce((sum, it) => sum + (parseFloat(it.hours) || 0), 0);
              } catch {}

              return (
                <div
                  key={order.id}
                  onClick={() => window.location.href = `/TechJobView?id=${order.id}`}
                  style={{
                    background:"#0f172a", border:"1px solid #1e293b",
                    borderRadius:16, padding:"16px 20px",
                    display:"flex", alignItems:"center", justifyContent:"space-between",
                    cursor:"pointer", transition:"all 0.15s",
                    gap:16,
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#00aaff80"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
                >
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                      <span style={{ color:"#fff", fontWeight:700, fontSize:16 }}>{order.customer_name}</span>
                      <span style={{
                        background:sc.bg, border:`1px solid ${sc.border}`,
                        color:sc.text, borderRadius:20, padding:"2px 10px",
                        fontSize:11, fontWeight:700, textTransform:"capitalize",
                      }}>{order.status || "pending"}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <Car style={{ width:13, height:13, color:"#38bdf8", flexShrink:0 }} />
                      <span style={{ color:"#38bdf8", fontSize:13 }}>{order.vehicle_info || "No vehicle"}</span>
                    </div>
                    {order.description && (
                      <p style={{ color:"#64748b", fontSize:13, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:400 }}>
                        {order.description}
                      </p>
                    )}
                    {totalHours > 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:6 }}>
                        <Clock style={{ width:12, height:12, color:"#a78bfa" }} />
                        <span style={{ color:"#a78bfa", fontSize:12, fontWeight:600 }}>{totalHours}h estimated</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight style={{ width:20, height:20, color:"#334155", flexShrink:0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
