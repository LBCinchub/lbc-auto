import { formatPhone } from "@/utils/formatPhone";
import { normalizeDiscountType } from "@/utils/discount";

function buildPrintHTML(contentHTML, title, isWorker) {
  return `
    <html>
    <head>
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: white; }
        .page { max-width: 900px; margin: 0 auto; padding: 16px; }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #0f172a; }
        thead th { padding: 6px 8px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
        tbody tr { border-bottom: 1px solid #f1f5f9; }
        tbody tr:nth-child(even) { background: #fafbff; }
        tbody td { padding: 6px 8px; font-size: 10px; color: #334155; vertical-align: top; }
        @media print {
          html { zoom: 1; }
          body { padding: 0; }
          .page { padding: 10px; }
          @page { margin: 10mm; size: letter; }
        }
      </style>
    </head>
    <body>
      <div class="page">
        ${contentHTML}
        ${isWorker ? `<div style="margin-top:24px;padding:10px 16px;background:#fef9c3;border:1px solid #fde047;border-radius:8px;text-align:center;font-size:12px;color:#854d0e;font-weight:700;letter-spacing:1px;text-transform:uppercase;">⚠ WORKER COPY — PRICES HIDDEN</div>` : ""}
      </div>
    </body>
    </html>
  `;
}

export default function PrintTemplate({ type = "Invoice", docNumber, createdDate, user, customer, vehicle, lineItems = [], paymentHistory = [], financials = {}, notes, serviceReason, onNavigateCustomer, onNavigateVehicle }) {
  const {
    partsTotal = 0,
    laborTotal = 0,
    subtotal = 0,
    discount = 0,
    discountType = "$",
    taxRate = 0,
    taxAmount = 0,
    taxAppliesTo = null,
    grandTotal = 0,
    amountPaid = 0,
    balanceDue = 0,
  } = financials;

  const bizName = user?.business_name || "LBC Auto Services";

  // BUG 1: Normalize discount type — handles '$', 'fixed', '%', 'percent', null
  const normDiscountType = normalizeDiscountType(discountType);
  // Recalculate the actual discount dollar amount for display
  const discountDisplayAmount = normDiscountType === "percent"
    ? Math.round(subtotal * (parseFloat(discount) || 0) / 100 * 100) / 100
    : normDiscountType === "fixed"
    ? Math.round((parseFloat(discount) || 0) * 100) / 100
    : 0;

  const openPrint = (hidePrice) => {
    const id = hidePrice ? "print-worker-body" : "print-full-body";
    const content = document.getElementById(id);
    if (!content) {
      alert("Print template not ready. Please wait a moment and try again.");
      return;
    }
    const title = hidePrice ? `${type} ${docNumber} - Worker Copy` : `${type} ${docNumber}`;
    const html = buildPrintHTML(content.innerHTML, title, hidePrice);

    // Use a hidden iframe so browser popup blocker cannot block it
    let iframe = document.getElementById("lbc-print-iframe");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "lbc-print-iframe";
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
      document.body.appendChild(iframe);
    }
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch(e) {
        // Fallback: open in new tab
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          setTimeout(() => win.print(), 400);
        } else {
          alert("Could not open print dialog. Please allow popups for this site.");
        }
      }
    }, 400);
  };

  const headerBlock = (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {user?.business_logo && (
            <div style={{ width: 120, height: 70, flexShrink: 0, background: "white", borderRadius: 6, border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <img src={user.business_logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", letterSpacing: -0.5 }}>{bizName}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: 2, marginTop: 1 }}>Auto Services</div>
            <div style={{ marginTop: 5, fontSize: 10, color: "#475569", lineHeight: 1.6 }}>
              {user?.phone && <div>{formatPhone(user.phone)}</div>}
              {user?.email && <div>{user.email}</div>}
              {user?.address && <div>{user.address}</div>}
              {user?.gst_number && <div>GST/Business #: {user.gst_number}</div>}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#0ea5e9", letterSpacing: -1, textTransform: "uppercase" }}>{type}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 2 }}># {docNumber}</div>
          <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>Date: {createdDate}</div>
        </div>
      </div>

      {/* Gradient Divider */}
      <div style={{ height: 2, background: "linear-gradient(to right, #0ea5e9, #6366f1, #ec4899)", borderRadius: 2, marginBottom: 6 }} />

      {/* Bill To + Vehicle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, background: "#f8fafc", borderRadius: 6, padding: "6px 10px", borderLeft: "3px solid #0ea5e9" }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>Bill To</div>
          {onNavigateCustomer ? (
            <button onClick={onNavigateCustomer} style={{ fontSize: 12, fontWeight: 700, color: "#0ea5e9", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 1, textDecoration: "underline", textAlign: "left", display: "block" }}>
              {customer?.name || customer?.full_name || "—"} →
            </button>
          ) : (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 1 }}>{customer?.name || customer?.full_name || "—"}</div>
          )}
          <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.6 }}>
            {customer?.phone && <div>{formatPhone(customer.phone)}</div>}
            {customer?.email && <div>{customer.email}</div>}
            {customer?.address && <div>{customer.address}</div>}
          </div>
        </div>
        {vehicle?.info && (
          <div style={{ flex: 1, background: "#f0f9ff", borderRadius: 8, padding: "10px 12px", borderLeft: "4px solid #6366f1" }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Vehicle Information</div>

            {/* Main vehicle title */}
            {onNavigateVehicle ? (
              <button onClick={onNavigateVehicle} style={{ fontSize: 13, fontWeight: 800, color: "#6366f1", background: "none", border: "none", padding: 0, cursor: "pointer", marginBottom: 6, textDecoration: "underline", textAlign: "left", display: "block" }}>
                {vehicle.info} →
              </button>
            ) : (
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{vehicle.info}</div>
            )}

            {/* Grid of vehicle details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", fontSize: 10, color: "#334155" }}>
              {vehicle?.make && (
                <div><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Make</span><br/><span style={{ fontWeight: 700, color: "#0f172a" }}>{vehicle.make}</span></div>
              )}
              {vehicle?.model && (
                <div><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Model</span><br/><span style={{ fontWeight: 700, color: "#0f172a" }}>{vehicle.model}</span></div>
              )}
              {vehicle?.year && (
                <div><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Year</span><br/><span style={{ fontWeight: 700, color: "#0f172a" }}>{vehicle.year}</span></div>
              )}
              {vehicle?.color && (
                <div><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Color</span><br/><span style={{ fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>{vehicle.color}</span></div>
              )}
              {vehicle?.engine_type && (
                <div style={{ gridColumn: "span 2" }}><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Engine</span><br/><span style={{ fontWeight: 700, color: "#0f172a" }}>{vehicle.engine_type}</span></div>
              )}
              {vehicle?.mileage && (
                <div><span style={{ color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", fontSize: 8, letterSpacing: 0.8 }}>Mileage</span><br/><span style={{ fontWeight: 700, color: "#0f172a" }}>{Number(vehicle.mileage).toLocaleString()} km</span></div>
              )}
            </div>

            {/* License plate badge + VIN below grid */}
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {vehicle?.license_plate && (
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 11, background: "#dbeafe", borderRadius: 5, padding: "3px 10px", letterSpacing: 2, border: "1px solid #93c5fd", fontFamily: "monospace" }}>
                  🪪 {vehicle.license_plate.toUpperCase()}
                </span>
              )}
            </div>
            {vehicle?.vin && (
              <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 9, color: "#64748b", letterSpacing: 0.8, background: "#f1f5f9", borderRadius: 4, padding: "3px 8px", display: "inline-block" }}>
                VIN: <strong style={{ color: "#0f172a", textTransform: "uppercase" }}>{vehicle.vin.toUpperCase()}</strong>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  const serviceReasonBlock = serviceReason && (
    <div style={{ marginTop: 6, marginBottom: 6, background: "#eff6ff", borderRadius: 6, borderLeft: "4px solid #3b82f6", padding: "7px 12px" }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>
        🔧 Reason for Visit / Customer Complaint
      </div>
      <div style={{ fontSize: 10.5, color: "#1e3a5f", lineHeight: 1.6, fontStyle: "italic" }}>{serviceReason}</div>
    </div>
  );

  const notesBlock = notes && (
    <div style={{ marginTop: 5, background: "#fffbeb", borderRadius: 6, borderLeft: "3px solid #f59e0b", padding: "6px 10px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>Note</div>
      <div style={{ fontSize: 10, color: "#78350f", lineHeight: 1.5 }}>{notes}</div>
    </div>
  );

  const signatureBlock = (
    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div style={{ height: 20, borderBottom: "1.5px solid #cbd5e1", width: 180, marginBottom: 3 }}></div>
        <div style={{ fontSize: 8.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>Customer Signature</div>
        <div style={{ fontSize: 8.5, color: "#cbd5e1", marginTop: 1 }}>By signing, you agree to the terms below.</div>
      </div>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px dashed #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 7, color: "#e2e8f0", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Stamp</span>
      </div>
    </div>
  );

  const disclaimerBlock = (
    <div style={{ marginTop: 6, paddingTop: 5, borderTop: "1px solid #f1f5f9" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>Disclaimer</div>
      <div style={{ fontSize: 9, color: "#94a3b8", lineHeight: 1.6 }}>
        I hereby authorize the above repair work to be done along with procurement of all necessary materials. {bizName} may operate the above vehicle for purposes of testing, inspection or delivery at my risk. {bizName} will not be held responsible for any loss or damage to the vehicle or articles left in the vehicle in case of fire, theft, accident or any other cause beyond its control. In the event legal action is necessary to enforce this contract, I understand I am solely responsible for all costs.
      </div>
      <div style={{ textAlign: "center", marginTop: 5, fontSize: 9, color: "#cbd5e1", fontStyle: "italic" }}>
        Thank you for choosing {bizName} — we appreciate your trust and business.
      </div>
      <div style={{ marginTop: 6, fontSize: 9, color: "#94a3b8", fontStyle: "italic", lineHeight: 1.5 }}>
        * Items marked as <em>Recommended</em> are future services identified during inspection. They are not included in today's charges.
      </div>
      <div style={{ textAlign: "center", marginTop: 5, paddingTop: 5, borderTop: "1px solid #f1f5f9", fontSize: 8, color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase" }}>
        Powered by <span style={{ fontWeight: 700, color: "#0ea5e9" }}>LBC.NETWORK</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Print Buttons */}
      <div className="flex justify-end gap-2 mb-4 no-print">
        <button onClick={() => openPrint(true)} className="bg-amber-500 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 flex items-center gap-2 shadow">
          🔧 Print Worker Copy
        </button>
        <button onClick={() => openPrint(false)} className="bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 flex items-center gap-2 shadow">
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* Full copy (with prices) — shown on screen */}
      <div id="print-full-body" style={{ fontFamily: "'Inter', Arial, sans-serif", fontSize: 12, color: "#1a1a2e", background: "white", maxWidth: "900px", margin: "0 auto", padding: "16px" }}>
        {headerBlock}

        {serviceReasonBlock}
        {/* Line Items Table — full */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={{ padding: "5px 7px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "4%" }}>#</th>
              <th style={{ padding: "5px 7px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Item</th>
              <th style={{ padding: "5px 7px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Description</th>
              <th style={{ padding: "5px 7px", textAlign: "right", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "11%" }}>Unit Price</th>
              <th style={{ padding: "5px 7px", textAlign: "center", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "9%" }}>Qty</th>
              <th style={{ padding: "5px 7px", textAlign: "right", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "12%" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => {
              const rawQty = parseFloat(item.qty ?? item.quantity);
              const isRecommended = !rawQty || rawQty === 0;
              const qty = isRecommended ? 0 : rawQty;
              const unitPrice = parseFloat(item.unit_price) || 0;
              const total = isRecommended ? 0 : unitPrice * qty;
              const displayName = item.name || item.description || "—";
              const displayDesc = item.name ? item.description : "";
              return (
                <tr key={i} style={{ background: i % 2 === 1 ? "#fafbff" : "white", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "4px 7px", fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{i + 1}</td>
                  <td style={{ padding: "4px 7px", fontSize: 10, fontWeight: 700, color: "#0f172a" }}>
                    {displayName}
                    {isRecommended && (
                      <span style={{ marginLeft: 6, fontSize: 8, fontStyle: "italic", color: "#94a3b8", fontWeight: 400 }}>Recommended</span>
                    )}
                  </td>
                  <td style={{ padding: "4px 7px", fontSize: 9, color: "#64748b" }}>{displayDesc}</td>
                  <td style={{ padding: "4px 7px", fontSize: 9, color: "#334155", textAlign: "right" }}>${unitPrice.toFixed(2)}</td>
                  <td style={{ padding: "4px 7px", fontSize: 9, color: isRecommended ? "#94a3b8" : "#334155", textAlign: "center" }}>{isRecommended ? "—" : qty}</td>
                  <td style={{ padding: "4px 7px", fontSize: 10, fontWeight: 700, color: isRecommended ? "#94a3b8" : "#0f172a", textAlign: "right" }}>{isRecommended ? "$0.00" : `$${total.toFixed(2)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Bottom: Payment History + Summary */}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 4 }}>
          <div style={{ flex: 1.3 }}>
            {paymentHistory && paymentHistory.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>Payment History</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 8.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Date</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 8.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Receipt #</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 8.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Method</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 8.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #e2e8f0" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((p, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px", fontSize: 9, color: "#475569" }}>{p.date}</td>
                        <td style={{ padding: "6px 8px", fontSize: 9, color: "#475569" }}>{p.receipt_number}</td>
                        <td style={{ padding: "6px 8px", fontSize: 9, color: "#475569" }}>{p.method}</td>
                        <td style={{ padding: "6px 8px", fontSize: 9, fontWeight: 600, color: "#0f172a", textAlign: "right" }}>${(p.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: 10, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#475569" }}>
                <span>Parts</span><span>${partsTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#475569" }}>
                <span>Labor</span><span>${laborTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 10, color: "#475569", borderTop: "1px solid #e2e8f0", marginTop: 4 }}>
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {/* Discount — BUG 1: Show whenever discount > 0, regardless of type name stored */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: discountDisplayAmount > 0 ? "#ef4444" : "#94a3b8", fontWeight: discountDisplayAmount > 0 ? 600 : 400 }}>
                <span>Discount{normDiscountType === "percent" && discountDisplayAmount > 0 ? ` (${parseFloat(discount).toFixed(0)}%)` : ""}</span>
                <span>{discountDisplayAmount > 0 ? `-$${discountDisplayAmount.toFixed(2)}` : "$0.00"}</span>
              </div>
              {taxRate > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#475569" }}>
                  <span>Tax ({taxRate}%{taxAppliesTo && taxAppliesTo !== "both" ? ` · ${taxAppliesTo === "labor" ? "Labor only" : "Parts only"}` : ""})</span><span>${taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#0f172a", borderTop: "2px solid #0f172a", marginTop: 4, paddingTop: 5 }}>
                <span>Grand Total</span><span>${grandTotal.toFixed(2)}</span>
              </div>
              {amountPaid > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 10, color: "#10b981" }}>
                  <span>Paid</span><span>-${amountPaid.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div style={{ background: "#0f172a", borderRadius: 6, padding: "10px 14px", marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#94a3b8", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>Balance Due</span>
              <span style={{ color: "#0ea5e9", fontSize: 18, fontWeight: 700 }}>${balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {notesBlock}
        {signatureBlock}
        {disclaimerBlock}
      </div>

      {/* Worker copy (no prices) — hidden off-screen, used only for printing */}
      <div id="print-worker-body" style={{ position: "absolute", left: -9999, top: 0, fontFamily: "'Inter', Arial, sans-serif", fontSize: 12, color: "#1a1a2e", background: "white", width: 900 }}>
        {headerBlock}

        {serviceReasonBlock}
        {/* Line Items Table — NO prices */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "5%" }}>#</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Item</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>Description</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", width: "12%" }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => {
              const rawQty = parseFloat(item.qty ?? item.quantity);
              const isRecommended = !rawQty || rawQty === 0;
              const qty = isRecommended ? 0 : rawQty;
              const displayName = item.name || item.description || "—";
              const displayDesc = item.name ? item.description : "";
              return (
                <tr key={i} style={{ background: i % 2 === 1 ? "#fafbff" : "white", borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "6px 8px", fontSize: 9, fontWeight: 600, color: "#94a3b8" }}>{i + 1}</td>
                  <td style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "#0f172a" }}>
                    {displayName}
                    {isRecommended && (
                      <span style={{ marginLeft: 6, fontSize: 8, fontStyle: "italic", color: "#94a3b8", fontWeight: 400 }}>Recommended</span>
                    )}
                  </td>
                  <td style={{ padding: "6px 8px", fontSize: 9, color: "#64748b" }}>{displayDesc}</td>
                  <td style={{ padding: "6px 8px", fontSize: 9, color: isRecommended ? "#94a3b8" : "#334155", textAlign: "center" }}>{isRecommended ? "—" : qty}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {notesBlock}
        {signatureBlock}
        {disclaimerBlock}
      </div>
    </div>
  );
}