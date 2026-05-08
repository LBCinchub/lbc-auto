export function generateInvoiceHTML({ invoice, laborItems, partsItems, laborTotal, partsTotal, taxRate, taxAmount, grandTotal }) {
  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

  const isPaid = invoice.status === "paid";
  const isPartial = invoice.status === "partial";
  const badgeText = isPaid ? "✅ PAID" : isPartial ? "⏳ PARTIAL" : "❌ UNPAID";
  const badgeBg = isPaid ? "#dcfce7" : isPartial ? "#fff7ed" : "#fee2e2";
  const badgeColor = isPaid ? "#16a34a" : isPartial ? "#92400e" : "#991b1b";

  const invoiceDate = invoice.created_date
    ? new Date(invoice.created_date).toLocaleDateString("en-CA")
    : new Date().toLocaleDateString("en-CA");

  const laborRows = (laborItems || []).map(r => `
    <tr>
      <td>${r.description || "Labor"}</td>
      <td class="c">Labor</td>
      <td class="c">${parseFloat(r.hours) || 0}</td>
      <td class="r">${fmt(r.rate)}</td>
      <td class="r"><b>${fmt((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0))}</b></td>
    </tr>`).join("");

  const partRows = (partsItems || []).map(r => `
    <tr>
      <td>${r.name || "Part"}</td>
      <td class="c">Part</td>
      <td class="c">${parseFloat(r.quantity) || 1}</td>
      <td class="r">${fmt(r.unit_price)}</td>
      <td class="r"><b>${fmt((parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0))}</b></td>
    </tr>`).join("");

  const paymentRows = (invoice.payment_history || []).map(p => `
    <tr>
      <td>${p.date || ""}</td>
      <td>${p.method || ""}</td>
      <td class="r"><b>${fmt(p.amount)}</b></td>
      <td>${p.note || "—"}</td>
    </tr>`).join("");

  const paymentSection = paymentRows ? `
    <div class="sec" style="padding-top:0">
      <h3>Payment History</h3>
      <table class="pt">
        <thead><tr><th>Date</th><th>Method</th><th class="r">Amount</th><th>Note</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>
    </div>` : "";

  // Build individual paid rows for totals box
  const paidRows = (invoice.payment_history || []).map(p =>
    `<div class="tr"><span>Paid (${p.method || "Payment"})</span><span>– ${fmt(p.amount)}</span></div>`
  ).join("");

  const whatsappMsg = encodeURIComponent(
    `Hi ${invoice.customer_name || "Customer"}, your invoice ${invoice.invoice_number} from Belal Auto Services is ready.\nVehicle: ${invoice.vehicle_info || "N/A"}\nTotal: ${fmt(grandTotal)} — ${(invoice.status || "UNPAID").toUpperCase()}. Thank you! 🔧`
  );

  const customerNote = invoice.customer_note ? `
    <div class="note-box">
      <b>Note:</b> ${invoice.customer_note}
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${invoice.invoice_number} – Belal Auto Services</title>
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1a1a1a; background: #f9fafb; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Topbar */
    .topbar { display: flex; gap: 10px; padding: 10px 14px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .topbar .btn { display: inline-block; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; }
    @media print { .topbar { display: none !important; } }

    /* Page wrapper */
    .page { max-width: 720px; margin: 0 auto; padding: 16px; background: #fff; }
    @media print { body { background: #fff; } .page { max-width: 100%; padding: 0; margin: 0; } }

    /* Header */
    .hd { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 2px solid #1e40af; }
    .shop-name { font-size: 17px; font-weight: 800; color: #1e40af; }
    .shop-sub { font-size: 9px; color: #64748b; margin-top: 1px; }
    .shop-ct { font-size: 9px; color: #64748b; margin-top: 1px; }
    .inv-num { font-size: 14px; font-weight: 700; color: #1e40af; text-align: right; }
    .inv-dt { font-size: 9px; color: #64748b; text-align: right; margin-top: 2px; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 9px; font-weight: 700; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}33; margin-top: 5px; }

    /* Bill info */
    .bi { display: flex; justify-content: space-between; align-items: flex-start; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 9px 12px; margin-bottom: 10px; }
    .bi h4 { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #94a3b8; margin-bottom: 3px; letter-spacing: 0.4px; }
    .bi .val { font-size: 12px; font-weight: 700; color: #0f172a; }
    .bi .sub { font-size: 9px; color: #64748b; margin-top: 2px; }

    /* Section */
    .sec { padding-top: 8px; }
    h3 { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #1e40af; margin-bottom: 5px; letter-spacing: 0.4px; }

    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    thead tr { background: #1e40af; }
    th { padding: 4px 7px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: #fff; }
    td { padding: 4px 7px; border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .c { text-align: center; }
    .r { text-align: right; }
    table.pt td, table.pt th { font-size: 9px; }

    /* Totals */
    .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; margin-bottom: 8px; }
    .tbox { width: 240px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
    .tr { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 9.5px; border-bottom: 1px solid #f1f5f9; }
    .tr:last-child { border-bottom: none; }
    .tr.sep { border-top: 1px solid #e2e8f0; }
    .tr.tot { background: #1e40af; color: #fff; font-weight: 700; font-size: 11px; padding: 5px 10px; }
    .tr.bal { background: #fff7ed; color: #92400e; font-weight: 700; }
    .tr.paid-ok { background: #f0fdf4; color: #16a34a; font-weight: 600; }

    /* Note */
    .note-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 5px; padding: 6px 10px; font-size: 9px; color: #78350f; margin-top: 8px; }

    /* Footer */
    .footer { margin-top: 10px; padding-top: 6px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8px; color: #94a3b8; }
  </style>
</head>
<body>

  <!-- Action bar (hidden on print) -->
  <div class="topbar">
    <button class="btn" style="background:#1e293b;color:#fff" onclick="window.print()">🖨️ Print / Save PDF</button>
    <a class="btn" style="background:#25D366;color:#fff" href="https://wa.me/?text=${whatsappMsg}" target="_blank">💬 Send via WhatsApp</a>
  </div>

  <div class="page">

    <!-- HEADER -->
    <div class="hd">
      <div>
        <div class="shop-name">🔧 Belal Auto Services</div>
        <div class="shop-sub">Professional Automotive Repair</div>
        <div class="shop-ct">📧 belalautoservices@gmail.com</div>
      </div>
      <div>
        <div class="inv-num">${invoice.invoice_number || "—"}</div>
        <div class="inv-dt">Date: ${invoiceDate}</div>
        <div style="text-align:right"><div class="badge">${badgeText}</div></div>
      </div>
    </div>

    <!-- BILL TO -->
    <div class="bi">
      <div>
        <h4>Bill To</h4>
        <div class="val">${invoice.customer_name || "—"}</div>
        <div class="sub">🚗 ${invoice.vehicle_info || "—"}</div>
      </div>
      <div style="text-align:right">
        <h4>Status</h4>
        <div class="val" style="color:${badgeColor}">${isPaid ? "PAID IN FULL" : isPartial ? "PARTIALLY PAID" : "UNPAID"}</div>
        <div class="sub">Total: ${fmt(grandTotal)} &nbsp;·&nbsp; Balance: ${fmt(invoice.balance_due || 0)}</div>
      </div>
    </div>

    <!-- LINE ITEMS -->
    <div class="sec">
      <h3>Services &amp; Parts</h3>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="c">Type</th>
            <th class="c">Qty</th>
            <th class="r">Unit Price</th>
            <th class="r">Total</th>
          </tr>
        </thead>
        <tbody>
          ${laborRows || ""}
          ${partRows || ""}
          ${(!laborRows && !partRows) ? '<tr><td colspan="5" class="c" style="color:#94a3b8;padding:8px">No items</td></tr>' : ""}
        </tbody>
      </table>
    </div>

    <!-- TOTALS -->
    <div class="totals-wrap">
      <div class="tbox">
        <div class="tr sep"><span>Labor</span><span>${fmt(laborTotal)}</span></div>
        <div class="tr"><span>Parts</span><span>${fmt(partsTotal)}</span></div>
        <div class="tr"><span>Subtotal</span><span>${fmt(laborTotal + partsTotal)}</span></div>
        <div class="tr"><span>Tax (${taxRate}%)</span><span>${fmt(taxAmount)}</span></div>
        <div class="tr tot"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
        ${paidRows}
        ${invoice.balance_due > 0
          ? `<div class="tr bal"><span>Balance Due</span><span>${fmt(invoice.balance_due)}</span></div>`
          : `<div class="tr paid-ok"><span>Balance Due</span><span>$0.00</span></div>`}
      </div>
    </div>

    <!-- PAYMENT HISTORY -->
    ${paymentSection}

    <!-- CUSTOMER NOTE -->
    ${customerNote}

    <div class="footer">Thank you for choosing Belal Auto Services &nbsp;·&nbsp; belalautoservices@gmail.com</div>

  </div>

</body>
</html>`;
}