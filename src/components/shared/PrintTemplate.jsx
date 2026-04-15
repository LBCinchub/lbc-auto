import React from "react";

export default function PrintTemplate({ type = "Invoice", docNumber, createdDate, user, customer, vehicle, lineItems = [], paymentHistory = [], financials = {}, notes, workerCopy = false }) {
  const {
    partsTotal = 0,
    laborTotal = 0,
    subtotal = 0,
    taxRate = 0,
    taxAmount = 0,
    grandTotal = 0,
    amountPaid = 0,
    balanceDue = 0,
  } = financials;

  const bizName = user?.business_name || "LBC Auto Services";

  const handlePrint = (hidePrice = false) => {
    const content = document.getElementById(`print-template-body${hidePrice ? "-worker" : ""}`);
    const win = window.open("", "_blank");
    const printTitle = hidePrice ? `${type} ${docNumber} - Worker Copy` : `${type} ${docNumber}`;
    win.document.write(`
      <html>
      <head>
        <title>${printTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: white; }
          .page { max-width: 780px; margin: 0 auto; padding: 36px; }

          /* Header */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .brand-block { display: flex; flex-direction: column; gap: 6px; }
          .brand-name { font-size: 22px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; }
          .brand-tag { font-size: 9px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
          .brand-details { margin-top: 8px; font-size: 10px; color: #475569; line-height: 1.8; }
          .doc-block { text-align: right; }
          .doc-type { font-size: 28px; font-weight: 700; color: #0ea5e9; letter-spacing: -1px; text-transform: uppercase; }
          .doc-number { font-size: 12px; font-weight: 600; color: #0f172a; margin-top: 4px; }
          .doc-date { font-size: 10px; color: #64748b; margin-top: 2px; }

          /* Divider */
          .divider { height: 3px; background: linear-gradient(to right, #0ea5e9, #6366f1, #ec4899); border-radius: 2px; margin-bottom: 24px; }

          /* Bill To / Vehicle */
          .info-row { display: flex; gap: 24px; margin-bottom: 28px; }
          .info-card { flex: 1; background: #f8fafc; border-radius: 10px; padding: 14px 16px; border-left: 3px solid #0ea5e9; }
          .info-card.vehicle { border-left-color: #6366f1; }
          .info-card-label { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
          .info-card-name { font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
          .info-card-sub { font-size: 10px; color: #475569; line-height: 1.7; }

          /* Table */
          .table-wrap { margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; }
          thead tr { background: #0f172a; }
          thead th { padding: 10px 12px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
          thead th:last-child, thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }
          thead th:nth-child(5) { text-align: center; }
          tbody tr { border-bottom: 1px solid #f1f5f9; }
          tbody tr:nth-child(even) { background: #fafbff; }
          tbody td { padding: 10px 12px; font-size: 10.5px; color: #334155; vertical-align: top; }
          tbody td:first-child { font-weight: 600; color: #64748b; font-size: 9px; }
          tbody td:nth-child(2) { font-weight: 600; color: #0f172a; }
          tbody td:nth-child(4) { text-align: right; }
          tbody td:nth-child(5) { text-align: center; }
          tbody td:last-child { text-align: right; font-weight: 600; color: #0f172a; }
          tfoot td { padding: 8px 12px; }

          /* Bottom */
          .bottom { display: flex; gap: 20px; align-items: flex-start; margin-top: 8px; }
          .payment-section { flex: 1.3; }
          .payment-title { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; }
          .pay-table { width: 100%; border-collapse: collapse; }
          .pay-table th { padding: 8px 10px; background: #f1f5f9; font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          .pay-table td { padding: 8px 10px; font-size: 10px; color: #475569; border-bottom: 1px solid #f1f5f9; }
          .pay-table td:last-child { text-align: right; font-weight: 600; }

          /* Summary */
          .summary { flex: 1; }
          .summary-inner { background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0; }
          .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 10.5px; color: #475569; }
          .summary-row.divider-row { border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px; }
          .summary-row.grand { font-size: 13px; font-weight: 700; color: #0f172a; border-top: 2px solid #0f172a; margin-top: 6px; padding-top: 8px; }
          .balance-box { background: #0f172a; border-radius: 8px; padding: 10px 14px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; }
          .balance-box .label { color: #94a3b8; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
          .balance-box .amount { color: #0ea5e9; font-size: 16px; font-weight: 700; }

          /* Notes */
          .notes-box { margin-top: 24px; background: #fffbeb; border-radius: 8px; border-left: 3px solid #f59e0b; padding: 12px 14px; }
          .notes-label { font-size: 8px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px; }
          .notes-text { font-size: 10px; color: #78350f; line-height: 1.6; }

          /* Signature */
          .sig-section { margin-top: 32px; display: flex; justify-content: space-between; align-items: flex-end; }
          .sig-block { }
          .sig-line { border-bottom: 1.5px solid #cbd5e1; width: 240px; margin-bottom: 6px; height: 32px; }
          .sig-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
          .stamp-box { width: 90px; height: 90px; border-radius: 50%; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; }
          .stamp-text { font-size: 9px; color: #cbd5e1; text-align: center; text-transform: uppercase; letter-spacing: 1px; }

          /* Footer */
          .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
          .disclaimer-title { font-size: 8px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
          .disclaimer-text { font-size: 8.5px; color: #94a3b8; line-height: 1.7; }
          .thank-you { text-align: center; margin-top: 18px; font-size: 11px; color: #cbd5e1; font-style: italic; }

          @media print { body { padding: 0; } .page { padding: 24px; } }
        </style>
      </head>
      <body>
        <div class="page">
          ${content.innerHTML}
          ${hidePrice ? `<div style="margin-top:24px;padding:12px 16px;background:#f1f5f9;border-radius:8px;text-align:center;font-size:10px;color:#64748b;font-weight:600;letter-spacing:1px;text-transform:uppercase;">WORKER COPY — NO PRICES</div>` : ""}
        </div>
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div>
      <div className="flex justify-end mb-4 no-print gap-2">
        <button onClick={() => handlePrint(true)} className="bg-gray-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-gray-700 flex items-center gap-2 shadow">
          🔧 Print Worker Copy
        </button>
        <button onClick={() => handlePrint(false)} className="bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 flex items-center gap-2 shadow">
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* Hidden worker copy (no prices) */}
      <div id="print-template-body-worker" style={{ display: "none" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>{bizName}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>Auto Services</div>
            <div style={{ marginTop: 10, fontSize: 10, color: "#475569", lineHeight: 1.8 }}>
              {user?.phone && <div>{user.phone}</div>}
              {user?.email && <div>{user.email}</div>}
              {user?.address && <div>{user.address}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0ea5e9", letterSpacing: -1, textTransform: "uppercase" }}>{type}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 4 }}># {docNumber}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Date: {createdDate}</div>
            <div style={{ marginTop: 8, padding: "4px 10px", background: "#fef3c7", borderRadius: 6, fontSize: 10, fontWeight: 700, color: "#92400e", display: "inline-block" }}>WORKER COPY</div>
          </div>
        </div>
        <div style={{ height: 3, background: "linear-gradient(to right, #0ea5e9, #6366f1, #ec4899)", borderRadius: 2, marginBottom: 24 }} />
        {/* Bill To + Vehicle */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #0ea5e9" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Customer</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{customer?.name || customer?.full_name}</div>
            <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.7 }}>
              {customer?.phone && <div>{customer.phone}</div>}
            </div>
          </div>
          {vehicle?.info && (
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #6366f1" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Vehicle</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{vehicle.info}</div>
              <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.7 }}>
                {vehicle?.vin && <div>VIN: {vehicle.vin}</div>}
                {vehicle?.mileage && <div>Mileage: {vehicle.mileage.toLocaleString()} km</div>}
                {vehicle?.license_plate && <div>Plate: {vehicle.license_plate}</div>}
              </div>
            </div>
          )}
        </div>
        {/* Work Items — no prices */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "5%" }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Item / Task</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Details</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "12%" }}>Qty</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "14%" }}>Done ✓</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? "#fafbff" : "white", borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "12px 12px", fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ padding: "12px 12px", fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{item.name}</td>
                <td style={{ padding: "12px 12px", fontSize: 10, color: "#64748b" }}>{item.description}</td>
                <td style={{ padding: "12px 12px", fontSize: 10.5, color: "#334155", textAlign: "center" }}>{item.qty}</td>
                <td style={{ padding: "12px 12px", textAlign: "center" }}>
                  <div style={{ width: 20, height: 20, border: "2px solid #cbd5e1", borderRadius: 4, margin: "0 auto" }}></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {notes && (
          <div style={{ marginTop: 24, background: "#fffbeb", borderRadius: 8, borderLeft: "3px solid #f59e0b", padding: "12px 14px" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Notes</div>
            <div style={{ fontSize: 10, color: "#78350f", lineHeight: 1.6 }}>{notes}</div>
          </div>
        )}
        {/* Mechanic sign-off */}
        <div style={{ marginTop: 36, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ height: 36, borderBottom: "1.5px solid #cbd5e1", width: 240, marginBottom: 6 }}></div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Mechanic Signature</div>
          </div>
          <div>
            <div style={{ height: 36, borderBottom: "1.5px solid #cbd5e1", width: 160, marginBottom: 6 }}></div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Date Completed</div>
          </div>
        </div>
      </div>

      <div id="print-template-body" style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: 11, color: "#1a1a2e", background: "white" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>{bizName}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 2, marginTop: 2 }}>Auto Services</div>
            <div style={{ marginTop: 10, fontSize: 10, color: "#475569", lineHeight: 1.8 }}>
              {user?.phone && <div>{user.phone}</div>}
              {user?.email && <div>{user.email}</div>}
              {user?.address && <div>{user.address}</div>}
              {user?.gst_number && <div>GST/Business #: {user.gst_number}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0ea5e9", letterSpacing: -1, textTransform: "uppercase" }}>{type}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 4 }}># {docNumber}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>Date: {createdDate}</div>
          </div>
        </div>

        {/* Gradient Divider */}
        <div style={{ height: 3, background: "linear-gradient(to right, #0ea5e9, #6366f1, #ec4899)", borderRadius: 2, marginBottom: 24 }} />

        {/* Bill To + Vehicle */}
        <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
          <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #0ea5e9" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Bill To</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{customer?.name || customer?.full_name}</div>
            <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.7 }}>
              {customer?.phone && <div>{customer.phone}</div>}
              {customer?.email && <div>{customer.email}</div>}
            </div>
          </div>
          {vehicle?.info && (
            <div style={{ flex: 1, background: "#f8fafc", borderRadius: 10, padding: "14px 16px", borderLeft: "3px solid #6366f1" }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Vehicle</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{vehicle.info}</div>
              <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.7 }}>
                {vehicle?.vin && <div>VIN: {vehicle.vin}</div>}
                {vehicle?.mileage && <div>Mileage: {vehicle.mileage.toLocaleString()} km</div>}
                {vehicle?.license_plate && <div>Plate: {vehicle.license_plate}</div>}
              </div>
            </div>
          )}
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "4%" }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Item</th>
              <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Description</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "11%" }}>Unit Price</th>
              <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "9%" }}>Qty</th>
              <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "12%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? "#fafbff" : "white", borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "10px 12px", fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#0f172a" }}>{item.name}</td>
                <td style={{ padding: "10px 12px", fontSize: 10, color: "#64748b" }}>{item.description}</td>
                <td style={{ padding: "10px 12px", fontSize: 10.5, color: "#334155", textAlign: "right" }}>${(item.unit_price || 0).toFixed(2)}</td>
                <td style={{ padding: "10px 12px", fontSize: 10.5, color: "#334155", textAlign: "center" }}>{item.qty}</td>
                <td style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#0f172a", textAlign: "right" }}>${(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom: Payment History + Summary */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginTop: 8 }}>
          {/* Payment History */}
          <div style={{ flex: 1.3 }}>
            {paymentHistory && paymentHistory.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Payment History</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Date</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Receipt #</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Method</th>
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "8px 10px", fontSize: 10, color: "#475569" }}>{p.date}</td>
                        <td style={{ padding: "8px 10px", fontSize: 10, color: "#475569" }}>{p.receipt_number}</td>
                        <td style={{ padding: "8px 10px", fontSize: 10, color: "#475569" }}>{p.method}</td>
                        <td style={{ padding: "8px 10px", fontSize: 10, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>${(p.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Summary */}
          <div style={{ flex: 1 }}>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10.5, color: "#475569" }}>
                <span>Parts</span><span>${partsTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10.5, color: "#475569" }}>
                <span>Labor</span><span>${laborTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 10.5, color: "#475569", borderTop: "1px solid #e2e8f0", marginTop: 6 }}>
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {taxRate > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10.5, color: "#475569" }}>
                  <span>Tax ({taxRate}%)</span><span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#0f172a", borderTop: "2px solid #0f172a", marginTop: 6, paddingTop: 8 }}>
                <span>Grand Total</span><span>${grandTotal.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10.5, color: "#10b981" }}>
                  <span>Paid</span><span>-${amountPaid.toFixed(2)}</span>
                </div>
              )}
            </div>
            {/* Balance Due */}
            <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px", marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Balance Due</span>
              <span style={{ color: "#0ea5e9", fontSize: 18, fontWeight: 700 }}>${balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div style={{ marginTop: 24, background: "#fffbeb", borderRadius: 8, borderLeft: "3px solid #f59e0b", padding: "12px 14px" }}>
            <div style={{ fontSize: 8, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Note</div>
            <div style={{ fontSize: 10, color: "#78350f", lineHeight: 1.6 }}>{notes}</div>
          </div>
        )}

        {/* Signature */}
        <div style={{ marginTop: 36, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ height: 36, borderBottom: "1.5px solid #cbd5e1", width: 240, marginBottom: 6 }}></div>
            <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Customer Signature</div>
            <div style={{ fontSize: 8, color: "#cbd5e1", marginTop: 3 }}>By signing, you agree to the terms below.</div>
          </div>
          <div style={{ width: 90, height: 90, borderRadius: "50%", border: "2px dashed #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, color: "#e2e8f0", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Stamp</span>
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
          <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Disclaimer</div>
          <div style={{ fontSize: 8.5, color: "#94a3b8", lineHeight: 1.7 }}>
            I hereby authorize the above repair work to be done along with procurement of all necessary materials. {bizName} may operate the above vehicle for purposes of testing, inspection or delivery at my risk. {bizName} will not be held responsible for any loss or damage to the vehicle or articles left in the vehicle in case of fire, theft, accident or any other cause beyond its control. In the event legal action is necessary to enforce this contract, I understand I am solely responsible for all costs.
          </div>
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#cbd5e1", fontStyle: "italic" }}>
            Thank you for choosing {bizName} — we appreciate your trust and business.
          </div>
        </div>
      </div>
    </div>
  );
}