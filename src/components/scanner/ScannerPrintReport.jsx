import React from "react";

export default function ScannerPrintReport({
  customerName, vehicleInfo, selectedVehicle, adapterName, liveData, dtcCodes, analysis, notes,
}) {
  return (
    <div id="diag-print-report" style={{ display: "none" }}>
      <style>{`@media print { #diag-print-report { display: block !important; } }`}</style>

      <div style={{ borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>LBC AUTO AI SCANNER — Scan Report</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
          Generated {new Date().toLocaleString()}
        </p>
      </div>

      <table style={{ width: "100%", fontSize: 13, marginBottom: 16 }}>
        <tbody>
          <tr><td style={{ fontWeight: 700, width: 120, padding: "3px 0" }}>Customer:</td><td style={{ padding: "3px 0" }}>{customerName || "—"}</td></tr>
          <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Vehicle:</td><td style={{ padding: "3px 0" }}>{vehicleInfo || "—"}</td></tr>
          {selectedVehicle?.vin && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>VIN:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.vin}</td></tr>}
          {selectedVehicle?.license_plate && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Plate:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.license_plate}</td></tr>}
          {selectedVehicle?.mileage != null && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Mileage:</td><td style={{ padding: "3px 0" }}>{selectedVehicle.mileage?.toLocaleString()} km</td></tr>}
          {adapterName && <tr><td style={{ fontWeight: 700, padding: "3px 0" }}>Adapter:</td><td style={{ padding: "3px 0" }}>{adapterName}</td></tr>}
        </tbody>
      </table>

      {liveData && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>Live Data Snapshot</h2>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {liveData.rpm !== undefined && <tr><td style={{ padding: "2px 0", width: 180 }}>RPM</td><td style={{ padding: "2px 0" }}>{Math.round(liveData.rpm)}</td></tr>}
              {liveData.speed_kph !== undefined && <tr><td style={{ padding: "2px 0" }}>Speed</td><td style={{ padding: "2px 0" }}>{liveData.speed_kph} km/h</td></tr>}
              {liveData.coolant_temp_c !== undefined && <tr><td style={{ padding: "2px 0" }}>Coolant Temp</td><td style={{ padding: "2px 0" }}>{liveData.coolant_temp_c}°C</td></tr>}
              {liveData.intake_temp_c !== undefined && <tr><td style={{ padding: "2px 0" }}>Intake Temp</td><td style={{ padding: "2px 0" }}>{liveData.intake_temp_c}°C</td></tr>}
              {liveData.engine_load_pct !== undefined && <tr><td style={{ padding: "2px 0" }}>Engine Load</td><td style={{ padding: "2px 0" }}>{liveData.engine_load_pct}%</td></tr>}
              {liveData.fuel_level_pct !== undefined && <tr><td style={{ padding: "2px 0" }}>Fuel Level</td><td style={{ padding: "2px 0" }}>{liveData.fuel_level_pct}%</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {dtcCodes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>
            Trouble Codes ({dtcCodes.length})
          </h2>
          {dtcCodes.map((c, i) => {
            const finding = analysis?.findings?.find(f => f.code === c.code);
            return (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  {c.code} <span style={{ fontSize: 11, textTransform: "uppercase", color: "#666" }}>[{c.type}]</span>
                </div>
                {finding && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <p style={{ margin: "2px 0" }}>{finding.plain_english}</p>
                    {finding.urgency && <p style={{ margin: "2px 0" }}><strong>Urgency:</strong> {finding.urgency}</p>}
                    {finding.likely_causes?.length > 0 && (
                      <div style={{ margin: "4px 0" }}>
                        <strong>Likely causes:</strong>
                        <ol style={{ margin: "2px 0 2px 20px", padding: 0 }}>
                          {finding.likely_causes.map((cause, j) => <li key={j}>{cause}</li>)}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {analysis?.summary && (
        <div style={{ marginBottom: 16, padding: 12, border: "1px solid #ccc", fontSize: 13 }}>
          <strong>Summary:</strong> {analysis.summary}
        </div>
      )}

      {analysis?.root_cause_analysis && (
        <div style={{ marginBottom: 16, padding: 12, border: "2px solid #f59e0b", background: "#fffbeb", fontSize: 13 }}>
          <strong style={{ color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>⚡ Root Cause Analysis</strong>
          <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{analysis.root_cause_analysis}</p>
        </div>
      )}

      {notes && (
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, borderBottom: "1px solid #ccc", paddingBottom: 4, marginBottom: 8 }}>Technician Notes</h2>
          <p style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{notes}</p>
        </div>
      )}

      <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #ccc", fontSize: 11, color: "#999", textAlign: "center" }}>
        LBC Auto · LBC AUTO AI SCANNER Report
      </div>
    </div>
  );
}