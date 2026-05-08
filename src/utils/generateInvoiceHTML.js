export function generateInvoiceHTML({ invoice, laborItems, partsItems, laborTotal, partsTotal, taxRate, taxAmount, grandTotal }) {
  const statusColor = invoice.status === "paid"
    ? { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }
    : invoice.status === "partial"
    ? { bg: "#fff7ed", text: "#92400e", border: "#fdba74" }
    : { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" };

  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

  const laborRows = laborItems.map(r => `
    <tr>
      <td>${r.description || "Labor"}</td>
      <td class="center">Labor</td>
      <td class="center">${parseFloat(r.hours) || 0} hr</td>
      <td class="right">${fmt(r.rate)}/hr</td>
      <td class="right">${fmt((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0))}</td>
    </tr>`).join("");

  const partRows = partsItems.map(r => `
    <tr>
      <td>${r.name || "Part"}</td>
      <td class="center">Part</td>
      <td class="center">${parseFloat(r.quantity) || 1}</td>
      <td class="right">${fmt(r.unit_price)}</td>
      <td class="right">${fmt((parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0))}</td>
    </tr>`).join("");

  const paymentRows = (invoice.payment_history || []).map(p => `
    <tr>
      <td>${p.date || ""}</td>
      <td>${p.method || ""}</td>
      <td class="right">${fmt(p.amount)}</td>
      <td>${p.note || ""}</td>
    </tr>`).join("");

  const paymentSection = paymentRows ? `
    <h3>Payment History</h3>
    <table>
      <thead><tr><th>Date</th><th>Method</th><th class="right">Amount</th><th>Note</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>` : "";

  const invoiceDate = invoice.created_date
    ? new Date(invoice.created_date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    : "";
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    : "N/A";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice #${invoice.invoice_number} – Belal Auto Services</title>
  <style>
    @page { size: letter portrait; margin: 14mm 14mm 12mm 14mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #1a1a1a; background: #fff; }
    .page { max-width: 680px; margin: 0 auto; padding: 18px 20px 14px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 2px solid #1e40af; }
    .shop-name { font-size: 18px; font-weight: 800; color: #1e40af; letter-spacing: -0.3px; }
    .shop-info { font-size: 9.5px; color: #555; margin-top: 3px; line-height: 1.5; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 15px; font-weight: 700; color: #1e40af; }
    .invoice-meta p { font-size: 9.5px; color: #555; margin-top: 2px; }

    /* Status badge */
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; background: ${statusColor.bg}; color: ${statusColor.text}; border: 1px solid ${statusColor.border}; }

    /* Info row */
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 7px 10px; }
    .info-box label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #94a3b8; display: block; margin-bottom: 2px; }
    .info-box span { font-size: 10.5px; font-weight: 600; color: #1a1a1a; }

    /* Tables */
    h3 { font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #1e40af; margin: 10px 0 5px; letter-spacing: 0.3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    thead tr { background: #1e40af; color: #fff; }
    th { padding: 5px 7px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
    td { padding: 5px 7px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .center { text-align: center; }
    .right { text-align: right; }

    /* Totals box */
    .totals-box { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-top: 10px; }
    .totals-box table { margin-bottom: 0; }
    .totals-box td { padding: 4px 10px; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
    .totals-box tr:last-child td { border-bottom: none; }
    .total-row td { font-weight: 700; font-size: 11.5px; background: #1e40af; color: #fff; padding: 6px 10px; }
    .paid-row td { color: #065f46; background: #f0fdf4; font-weight: 600; }
    .balance-row td { color: #92400e; background: #fff7ed; font-weight: 700; }
    .totals-box .right { text-align: right; }

    /* Footer */
    .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 8.5px; color: #94a3b8; }

    /* Print button */
    .print-btn { display: block; width: 160px; margin: 16px auto 0; padding: 9px 0; background: #1e40af; color: #fff; font-size: 11px; font-weight: 700; text-align: center; border: none; border-radius: 6px; cursor: pointer; letter-spacing: 0.3px; }
    @media print { .print-btn { display: none !important; } }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div>
      <div class="shop-name">Belal Auto Services</div>
      <div class="shop-info">belalautoservices@gmail.com</div>
    </div>
    <div class="invoice-meta">
      <h2>INVOICE #${invoice.invoice_number}</h2>
      <p>Date: ${invoiceDate}</p>
      <p>Due: ${dueDate}</p>
      <div style="margin-top:6px"><span class="status-badge">${(invoice.status || "unpaid").toUpperCase()}</span></div>
    </div>
  </div>

  <!-- Info -->
  <div class="info-grid">
    <div class="info-box">
      <label>Customer</label>
      <span>${invoice.customer_name || "—"}</span>
    </div>
    <div class="info-box">
      <label>Vehicle</label>
      <span>${invoice.vehicle_info || "—"}</span>
    </div>
  </div>

  <!-- Line Items -->
  <h3>Services &amp; Parts</h3>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="center">Type</th>
        <th class="center">Qty / Hrs</th>
        <th class="right">Unit Price</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${laborRows || ""}
      ${partRows || ""}
      ${(!laborRows && !partRows) ? '<tr><td colspan="5" class="center" style="color:#94a3b8;padding:10px">No items</td></tr>' : ""}
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals-box">
    <table>
      <tbody>
        <tr><td>Labor Subtotal</td><td class="right">${fmt(laborTotal)}</td></tr>
        <tr><td>Parts Subtotal</td><td class="right">${fmt(partsTotal)}</td></tr>
        <tr><td>Subtotal</td><td class="right">${fmt(laborTotal + partsTotal)}</td></tr>
        <tr><td>Tax (${taxRate}% — QST + GST)</td><td class="right">${fmt(taxAmount)}</td></tr>
        <tr class="total-row"><td>TOTAL</td><td class="right">${fmt(grandTotal)}</td></tr>
        ${invoice.amount_paid > 0 ? `<tr class="paid-row"><td>Amount Paid</td><td class="right">${fmt(invoice.amount_paid)}</td></tr>` : ""}
        ${invoice.balance_due > 0 ? `<tr class="balance-row"><td>Balance Due</td><td class="right">${fmt(invoice.balance_due)}</td></tr>` : ""}
      </tbody>
    </table>
  </div>

  <!-- Payment History -->
  ${paymentSection}

  <!-- Footer -->
  <div class="footer">Thank you for choosing Belal Auto Services &nbsp;·&nbsp; belalautoservices@gmail.com</div>
</div>

<button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
</body>
</html>`;
}