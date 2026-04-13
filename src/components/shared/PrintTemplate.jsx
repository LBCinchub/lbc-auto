import React from "react";

export default function PrintTemplate({ type = "Invoice", docNumber, createdDate, user, customer, vehicle, lineItems = [], paymentHistory = [], financials = {}, notes }) {
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

  const handlePrint = () => {
    const content = document.getElementById("print-template-body");
    const win = window.open("", "_blank");
    win.document.write(`
      <html>
      <head>
        <title>${type} ${docNumber}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; background: white; }
          .page { max-width: 750px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; border-bottom: 2px solid #333; padding-bottom: 14px; }
          .logo-box { width: 70px; height: 70px; border: 2px solid #333; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; text-align: center; margin-right: 14px; }
          .biz-left { display: flex; align-items: flex-start; }
          .biz-info { }
          .biz-info .name { font-size: 15px; font-weight: bold; }
          .biz-info div { margin-top: 2px; color: #333; }
          .doc-info { text-align: right; }
          .doc-info .doc-title { font-size: 16px; font-weight: bold; }
          .doc-info div { margin-top: 3px; color: #444; }
          .customer-vehicle { display: flex; justify-content: space-between; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
          .customer-vehicle .col { flex: 1; }
          .customer-vehicle .col + .col { border-left: 1px solid #ccc; padding-left: 16px; }
          .col-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
          .col-value { font-size: 12px; font-weight: 600; }
          .col-sub { font-size: 11px; color: #444; margin-top: 1px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          table thead { background: #e8e8e8; }
          table th { padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border: 1px solid #ccc; }
          table td { padding: 6px 8px; border: 1px solid #ddd; vertical-align: top; }
          table tbody tr:nth-child(even) { background: #f9f9f9; }
          .items-table th:nth-child(1) { width: 4%; }
          .items-table th:nth-child(4) { width: 10%; }
          .items-table th:nth-child(5) { width: 10%; }
          .items-table th:nth-child(6) { width: 12%; }
          .bottom-section { display: flex; gap: 16px; margin-top: 8px; }
          .payment-history { flex: 1.2; }
          .summary-box { flex: 1; border: 1px solid #ccc; padding: 10px; }
          .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11px; }
          .summary-row.bold { font-weight: bold; font-size: 12px; border-top: 1px solid #aaa; margin-top: 4px; padding-top: 4px; }
          .summary-row.highlight { background: #222; color: white; padding: 4px 6px; margin-top: 4px; font-weight: bold; font-size: 12px; }
          .signature-section { margin-top: 30px; }
          .sig-line { border-bottom: 1px solid #555; width: 250px; margin-bottom: 4px; }
          .disclaimer { margin-top: 18px; font-size: 9px; color: #555; line-height: 1.5; }
          .disclaimer strong { display: block; margin-bottom: 4px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${content.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div>
      <div className="flex justify-end mb-3 no-print">
        <button onClick={handlePrint} className="bg-sky-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-sky-700 flex items-center gap-2">
          🖨️ Print / Save PDF
        </button>
      </div>

      <div id="print-template-body" style={{ fontFamily: "Arial, sans-serif", fontSize: "11px", color: "#111", background: "white" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, borderBottom: "2px solid #333", paddingBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ width: 70, height: 70, border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: 10, textAlign: "center", flexShrink: 0 }}>
              {user?.business_name?.[0] || "LBC"}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: "bold" }}>{user?.business_name || "LBC Auto Services"}</div>
              {user?.phone && <div style={{ marginTop: 2 }}>{user.phone}</div>}
              {user?.email && <div style={{ marginTop: 2 }}>{user.email}</div>}
              {user?.address && <div style={{ marginTop: 2 }}>{user.address}</div>}
              {user?.gst_number && <div style={{ marginTop: 2 }}>Company Business/GST number: {user.gst_number}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 16, fontWeight: "bold" }}>{type} # {docNumber}</div>
            <div style={{ marginTop: 4, color: "#444" }}>Created: {createdDate}</div>
          </div>
        </div>

        {/* Customer + Vehicle */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #ccc" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: "600", fontSize: 13 }}>{customer?.name || customer?.full_name},</div>
            <div style={{ marginTop: 4 }}>{customer?.phone}</div>
            {customer?.email && <div>{customer.email}</div>}
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            {vehicle?.info && <div style={{ fontWeight: "600", fontSize: 13 }}>{vehicle.info}</div>}
            {vehicle?.vin && <div style={{ marginTop: 3, color: "#444" }}>VIN: {vehicle.vin}</div>}
            {vehicle?.mileage && <div style={{ color: "#444" }}>Mileage: {vehicle.mileage}</div>}
            {vehicle?.license_plate && <div style={{ color: "#444" }}>License Plate: {vehicle.license_plate}</div>}
          </div>
        </div>

        {/* Line Items Table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14 }} className="items-table">
          <thead style={{ background: "#e8e8e8" }}>
            <tr>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc", width: "4%" }}>#</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Name</th>
              <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Description</th>
              <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc", width: "10%" }}>Price</th>
              <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc", width: "10%" }}>Qty/Hrs</th>
              <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc", width: "12%" }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i} style={{ background: i % 2 === 1 ? "#f9f9f9" : "white" }}>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{i + 1}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd", fontWeight: 600 }}>{item.name}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd", color: "#555" }}>{item.description}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "right" }}>${(item.unit_price || 0).toFixed(2)}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "center" }}>{item.qty}</td>
                <td style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "right" }}>${(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Bottom: Payment History + Summary */}
        <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "flex-start" }}>
          {/* Payment History */}
          <div style={{ flex: 1.2 }}>
            {paymentHistory && paymentHistory.length > 0 && (
              <>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "#e8e8e8" }}>
                    <tr>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Date and Time</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Receipt No</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Payment Method</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 10, textTransform: "uppercase", color: "#555", border: "1px solid #ccc" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((p, i) => (
                      <tr key={i}>
                        <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{p.date}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{p.receipt_number}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #ddd" }}>{p.method}</td>
                        <td style={{ padding: "6px 8px", border: "1px solid #ddd", textAlign: "right" }}>${(p.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>

          {/* Summary Box */}
          <div style={{ flex: 1, border: "1px solid #ccc", padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
              <span>Service Amount</span><span>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
              <span>Part</span><span>${partsTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
              <span>Labor</span><span>${laborTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11, borderTop: "1px solid #aaa", marginTop: 4, paddingTop: 4 }}>
              <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
            </div>
            {taxRate > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                <span>Taxes (Sales Tax - {taxRate}%)</span><span>${taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 12, borderTop: "1px solid #aaa", marginTop: 4, paddingTop: 4 }}>
              <span>Grand total</span><span>${grandTotal.toFixed(2)}</span>
            </div>
            {amountPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 11 }}>
                <span>Paid to date</span><span>${amountPaid.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", background: "#222", color: "white", padding: "5px 6px", marginTop: 6, fontWeight: "bold", fontSize: 12 }}>
              <span>Remaining Balance</span><span>${balanceDue.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {notes && (
          <div style={{ marginTop: 16, fontSize: 11, color: "#333" }}>
            <p>{notes}</p>
          </div>
        )}

        {/* Signature */}
        <div style={{ marginTop: 30 }}>
          <p style={{ fontSize: 10, color: "#555", marginBottom: 16 }}>By signing this document, you agree to the Terms and Conditions mentioned below.</p>
          <div style={{ borderBottom: "1px solid #555", width: 280, marginBottom: 6 }}></div>
          <p style={{ fontSize: 10 }}>Signature: ___________________________________</p>
        </div>

        {/* Disclaimer */}
        <div style={{ marginTop: 18, fontSize: 9, color: "#555", lineHeight: 1.5 }}>
          <strong style={{ display: "block", marginBottom: 4 }}>Disclaimer:</strong>
          <p style={{ marginBottom: 8 }}>I hereby authorize the above repair work to be done along with procurement of all necessary materials. {user?.business_name || "LBC Auto Services"} may operate the above vehicle for the purposes of testing, inspection or delivery at my risk. {user?.business_name || "LBC Auto Services"} will not be held responsible for any loss or damage to the vehicle or articles left in vehicle in case of fire, theft, accident or any other cause beyond the control of {user?.business_name || "LBC Auto Services"}.</p>
          <p>In the event legal action is necessary to enforce this contract, I understand that I am solely responsible for all costs.</p>
        </div>
      </div>
    </div>
  );
}