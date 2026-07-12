import React from "react";

export default function VehicleHistoryReport({ customer, vehicles, invoices, repairOrders, vehiclePhotos, shopName, shopLogo }) {
  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;
  const fmtDate = (d) => d ? new Date(d.includes("T") ? d : d + "T12:00:00").toLocaleDateString("en-CA") : "—";
  const today = new Date().toLocaleDateString("en-CA");

  // Merge invoices + repair orders into service history
  const serviceHistory = [
    ...invoices.map(inv => ({
      date: inv.invoice_date || inv.created_date,
      service: inv.service_reason || inv.invoice_number || "Invoice",
      total: inv.total || 0,
      status: inv.status,
      vehicle: inv.vehicle_info || "—",
      number: inv.invoice_number || "",
      type: "invoice",
    })),
    ...repairOrders.map(ro => ({
      date: ro.created_date,
      service: ro.description || "Repair Order",
      total: ro.total_cost || 0,
      status: (ro.status || "").replace(/_/g, " "),
      vehicle: ro.vehicle_info || "—",
      number: ro.order_number || "",
      type: "ro",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalSpent = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount_paid) || 0), 0);
  const visits = serviceHistory.length;

  const openBalances = invoices.filter(inv => {
    const balance = parseFloat(inv.balance_due) || Math.max(0, (parseFloat(inv.total) || 0) - (parseFloat(inv.amount_paid) || 0));
    return balance > 0;
  });

  const activeROs = repairOrders.filter(ro => !["completed", "delivered"].includes(ro.status));
  const sortedPhotos = [...(vehiclePhotos || [])].sort((a, b) =>
    new Date(b.taken_date || b.created_date) - new Date(a.taken_date || a.created_date)
  );

  return (
    <>
      <style>{`
        #vehicle-history-report { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #vehicle-history-report { display: block !important; visibility: visible !important; position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          #vehicle-history-report * { visibility: visible !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div id="vehicle-history-report" style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", color: "#0f172a", maxWidth: 800 }}>
        {/* Header */}
        <div style={{ textAlign: "center", borderBottom: "3px solid #0f172a", paddingBottom: 16, marginBottom: 20 }}>
          {shopLogo && <img src={shopLogo} alt={shopName} style={{ height: 50, objectFit: "contain", marginBottom: 8 }} />}
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{shopName || "LBC AUTO"}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginTop: 4 }}>VEHICLE HISTORY REPORT</div>
        </div>

        {/* Customer info */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13 }}>
          <div>
            <strong>CUSTOMER:</strong> {customer?.full_name || "—"}<br />
            <strong>PHONE:</strong> {customer?.phone || "—"}<br />
            <strong>EMAIL:</strong> {customer?.email || "—"}
          </div>
          <div style={{ textAlign: "right" }}>
            <strong>DATE:</strong> {today}<br />
            <strong>SHOP:</strong> {shopName || "—"}
          </div>
        </div>

        {/* Vehicles */}
        <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Vehicles</div>
          {vehicles.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>No vehicles on file.</div>
          ) : vehicles.map((v, i) => (
            <div key={i} style={{ fontSize: 13, marginBottom: 4 }}>
              {i + 1}. {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown"}
              {v.vin && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#475569" }}> — VIN: {v.vin.toUpperCase()}</span>}
              {v.license_plate && <span> — Plate: {v.license_plate.toUpperCase()}</span>}
            </div>
          ))}
        </div>

        {/* Service history */}
        <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Service History</div>
          {serviceHistory.length === 0 ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>No service records found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f1f5f9", borderBottom: "2px solid #cbd5e1" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Vehicle</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Service</th>
                  <th style={{ textAlign: "right", padding: "6px 8px" }}>Total</th>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {serviceHistory.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "5px 8px" }}>{fmtDate(row.date)}</td>
                    <td style={{ padding: "5px 8px", fontSize: 11, color: "#475569" }}>{row.vehicle}</td>
                    <td style={{ padding: "5px 8px" }}>{row.service}{row.number ? ` (#${row.number})` : ""}</td>
                    <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt(row.total)}</td>
                    <td style={{ padding: "5px 8px", textTransform: "capitalize" }}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700 }}>
            TOTAL SPENT: {fmt(totalSpent)} &nbsp;&nbsp; VISITS: {visits}
          </div>
        </div>

        {/* Open balances */}
        {openBalances.length > 0 && (
          <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Open Balances</div>
            {openBalances.map((inv, i) => {
              const balance = parseFloat(inv.balance_due) || Math.max(0, (parseFloat(inv.total) || 0) - (parseFloat(inv.amount_paid) || 0));
              return (
                <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                  • {inv.invoice_number || inv.id.slice(0, 8)} — {fmt(balance)} remaining
                  {inv.service_reason ? ` (${inv.service_reason.slice(0, 40)})` : ""}
                </div>
              );
            })}
          </div>
        )}

        {/* Vehicle photos */}
        {sortedPhotos.length > 0 && (
          <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Vehicle Photos & AI Diagnosis</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {sortedPhotos.map((photo, i) => {
                const src = photo.photo_url || photo.photo_base64;
                if (!src) return null;
                return (
                  <div key={i} style={{ breakInside: "avoid" }}>
                    <img src={src} alt={photo.label} style={{ width: "100%", maxWidth: 200, height: "auto", borderRadius: 4 }} />
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4 }}>{photo.label || "Untitled"}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{fmtDate(photo.taken_date || photo.created_date)}</div>
                    {photo.ai_analysis && (
                      <div style={{ fontSize: 10, color: "#475569", marginTop: 2, fontStyle: "italic" }}>
                        AI: {photo.ai_analysis.slice(0, 120)}{photo.ai_analysis.length > 120 ? "…" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Active repair orders */}
        {activeROs.length > 0 && (
          <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Active Repair Orders</div>
            {activeROs.map((ro, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>
                • {ro.order_number || ro.id.slice(0, 8)} — {ro.description || "—"} — <span style={{ textTransform: "capitalize" }}>{ro.status?.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div style={{ borderTop: "2px solid #0f172a", paddingTop: 12, textAlign: "center", fontSize: 11, color: "#64748b" }}>
          Powered by <strong style={{ color: "#0f172a" }}>LBC AUTO</strong>
          <br />
          lbchub.tech | lbc.network
          <br />
          Generated {today}
        </div>
      </div>
    </>
  );
}