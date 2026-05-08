export function generateInvoiceHTML({ invoice, laborItems, partsItems, laborTotal, partsTotal, taxRate, taxAmount, grandTotal, shopInfo = {} }) {
  const fmt = (n) => `$${(parseFloat(n) || 0).toFixed(2)}`;

  const isPaid = invoice.status === "paid";
  const isPartial = invoice.status === "partial";
  const badgeColor = isPaid ? "#16a34a" : isPartial ? "#b45309" : "#dc2626";
  const badgeText = isPaid ? "PAID IN FULL" : isPartial ? "PARTIALLY PAID" : "UNPAID";

  const invoiceDate = invoice.created_date
    ? new Date(invoice.created_date).toLocaleDateString("en-CA")
    : new Date().toLocaleDateString("en-CA");

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-CA")
    : "—";

  const shopName = shopInfo.business_name || invoice.shop_name || "Belal Auto Services";
  const shopAddress = shopInfo.address || invoice.shop_address || "";
  const shopPhone = shopInfo.phone || invoice.shop_phone || "";
  const shopEmail = shopInfo.email || invoice.shop_email || "belalautoservices@gmail.com";

  const allItems = [
    ...(laborItems || []).map(r => ({
      description: r.description || "Labor",
      type: "Labor",
      qty: parseFloat(r.hours) || 0,
      unit: parseFloat(r.rate) || 0,
      total: (parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0),
    })),
    ...(partsItems || []).map(r => ({
      description: r.name || "Part",
      type: "Part",
      qty: parseFloat(r.quantity) || 1,
      unit: parseFloat(r.unit_price) || 0,
      total: (parseFloat(r.quantity) || 1) * (parseFloat(r.unit_price) || 0),
    })),
  ];

  const itemRows = allItems.length > 0
    ? allItems.map(r => `
      <tr>
        <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;">${r.description}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b;">${r.type}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;text-align:center;">${r.qty}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;text-align:right;">${fmt(r.unit)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${fmt(r.total)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" style="padding:8px;text-align:center;color:#94a3b8;">No items</td></tr>`;

  const paymentHistorySection = (invoice.payment_history || []).length > 0 ? `
    <div style="margin-top:10px;">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#1e40af;letter-spacing:0.5px;margin-bottom:4px;">Payment History</div>
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:3px 6px;text-align:left;font-weight:700;color:#475569;">Date</th>
            <th style="padding:3px 6px;text-align:left;font-weight:700;color:#475569;">Method</th>
            <th style="padding:3px 6px;text-align:right;font-weight:700;color:#475569;">Amount</th>
            <th style="padding:3px 6px;text-align:left;font-weight:700;color:#475569;">Note</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.payment_history || []).map(p => `
            <tr>
              <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;">${p.date || ""}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;">${p.method || ""}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${fmt(p.amount)}</td>
              <td style="padding:3px 6px;border-bottom:1px solid #f1f5f9;color:#64748b;">${p.note || "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const customerNoteSection = invoice.customer_note ? `
    <div style="margin-top:10px;background:#fffbeb;border:1px solid #fde68a;border-radius:4px;padding:6px 10px;font-size:9px;color:#78350f;">
      <strong>Note:</strong> ${invoice.customer_note}
    </div>` : "";

  const whatsappMsg = encodeURIComponent(
    `Hi ${invoice.customer_name || "Customer"}, your invoice ${invoice.invoice_number} from ${shopName} is ready.\nVehicle: ${invoice.vehicle_info || "N/A"}\nTotal: ${fmt(grandTotal)} — ${(invoice.status || "UNPAID").toUpperCase()}. Thank you!`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Invoice ${invoice.invoice_number || ""} – ${shopName}</title>
  <style>
    @page { size: letter portrait; margin: 0.5in; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      color: #1a1a1a;
      background: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { background: #fff; font-size: 11px; }
      .no-print { display: none !important; }
      .page { max-width: 100% !important; padding: 0 !important; box-shadow: none !important; }
    }
    .no-print { display: flex; gap: 10px; padding: 10px 14px; background: #1e293b; }
    .no-print button, .no-print a {
      display: inline-block; padding: 6px 14px; border-radius: 5px;
      font-size: 12px; font-weight: 600; text-decoration: none; border: none; cursor: pointer;
    }
    .page {
      max-width: 720px; margin: 16px auto; padding: 20px 24px;
      background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    }
    hr.div { border: none; border-top: 1.5px solid #1e40af; margin: 10px 0; }
    hr.light { border: none; border-top: 1px solid #e2e8f0; margin: 8px 0; }
  </style>
</head>
<body>

  <!-- Action bar (hidden on print) -->
  <div class="no-print">
    <button style="background:#3b82f6;color:#fff;" onclick="window.print()">🖨️ Print / Save PDF</button>
    <a style="background:#25D366;color:#fff;" href="https://wa.me/?text=${whatsappMsg}" target="_blank">💬 WhatsApp</a>
  </div>

  <div class="page">

    <!-- TOP: Shop info + Invoice meta -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:16px;font-weight:800;color:#1e40af;">${shopName}</div>
        ${shopAddress ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">${shopAddress}</div>` : ""}
        ${shopPhone ? `<div style="font-size:9px;color:#64748b;margin-top:1px;">📞 ${shopPhone}</div>` : ""}
        <div style="font-size:9px;color:#64748b;margin-top:1px;">✉️ ${shopEmail}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:15px;font-weight:800;color:#1e40af;">Invoice #${invoice.invoice_number || "—"}</div>
        <div style="font-size:9px;color:#64748b;margin-top:3px;">Date: ${invoiceDate}</div>
        ${invoice.due_date ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">Due: ${dueDate}</div>` : ""}
        <div style="margin-top:5px;display:inline-block;padding:2px 10px;border-radius:20px;font-size:9px;font-weight:700;background:${isPaid ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2"};color:${badgeColor};border:1px solid ${badgeColor}33;">
          ${badgeText}
        </div>
      </div>
    </div>

    <hr class="div"/>

    <!-- CUSTOMER INFO + VEHICLE -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
      <div>
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;margin-bottom:3px;">Bill To</div>
        <div style="font-size:12px;font-weight:700;color:#0f172a;">${invoice.customer_name || "—"}</div>
        ${invoice.customer_phone ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">📞 ${invoice.customer_phone}</div>` : ""}
        ${invoice.customer_email ? `<div style="font-size:9px;color:#64748b;margin-top:1px;">✉️ ${invoice.customer_email}</div>` : ""}
      </div>
      <div style="text-align:right;">
        <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;margin-bottom:3px;">Vehicle</div>
        <div style="font-size:11px;font-weight:700;color:#0f172a;">${invoice.vehicle_info || "—"}</div>
        ${invoice.license_plate ? `<div style="font-size:9px;color:#64748b;margin-top:2px;">Plate: ${invoice.license_plate}</div>` : ""}
        ${invoice.vin ? `<div style="font-size:9px;color:#64748b;margin-top:1px;">VIN: ${invoice.vin}</div>` : ""}
      </div>
    </div>

    <hr class="div"/>

    <!-- LINE ITEMS TABLE -->
    <div style="margin-bottom:8px;">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#1e40af;letter-spacing:0.5px;margin-bottom:5px;">Services &amp; Parts</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
        <thead>
          <tr style="background:#1e40af;">
            <th style="padding:4px 6px;text-align:left;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;">Description</th>
            <th style="padding:4px 6px;text-align:center;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;">Type</th>
            <th style="padding:4px 6px;text-align:center;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;">Qty</th>
            <th style="padding:4px 6px;text-align:right;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;">Unit Price</th>
            <th style="padding:4px 6px;text-align:right;color:#fff;font-size:8px;font-weight:700;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>
    </div>

    <!-- TOTALS (right-aligned) -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
      <div style="width:240px;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;font-size:9.5px;">
        <div style="display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #f1f5f9;"><span>Labor</span><span>${fmt(laborTotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #f1f5f9;"><span>Parts</span><span>${fmt(partsTotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #e2e8f0;"><span>Subtotal</span><span>${fmt(laborTotal + partsTotal)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #f1f5f9;"><span>Tax (${taxRate}%)</span><span>${fmt(taxAmount)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:5px 10px;background:#1e40af;color:#fff;font-weight:700;font-size:11px;"><span>TOTAL</span><span>${fmt(grandTotal)}</span></div>
        ${(invoice.amount_paid > 0) ? `<div style="display:flex;justify-content:space-between;padding:4px 10px;background:#f0fdf4;color:#16a34a;font-weight:600;border-bottom:1px solid #dcfce7;"><span>Amount Paid</span><span>– ${fmt(invoice.amount_paid)}</span></div>` : ""}
        ${(invoice.balance_due > 0)
          ? `<div style="display:flex;justify-content:space-between;padding:4px 10px;background:#fff7ed;color:#92400e;font-weight:700;"><span>Balance Due</span><span>${fmt(invoice.balance_due)}</span></div>`
          : `<div style="display:flex;justify-content:space-between;padding:4px 10px;background:#f0fdf4;color:#16a34a;font-weight:600;"><span>Balance Due</span><span>$0.00</span></div>`}
      </div>
    </div>

    ${paymentHistorySection}
    ${customerNoteSection}

    <!-- FOOTER -->
    <hr class="light" style="margin-top:12px;"/>
    <div style="text-align:center;font-size:8px;color:#94a3b8;padding-top:5px;">
      Thank you for your business! &nbsp;·&nbsp; ${shopName} &nbsp;·&nbsp; ${shopEmail}${shopPhone ? ` &nbsp;·&nbsp; ${shopPhone}` : ""}
    </div>

  </div>
</body>
</html>`;
}