import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function fmt(n: number) { return `$${(parseFloat(String(n)) || 0).toFixed(2)}`; }
function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d.includes("T") ? d : d + "T12:00:00");
  return dt.toLocaleDateString("en-CA");
}

function buildReportHTML(customer: any, vehicles: any[], invoices: any[], repairOrders: any[], vehiclePhotos: any[], shopInfo: any) {
  const shopName = shopInfo?.business_name || "LBC Auto";
  const shopLogo = shopInfo?.logo_url || "";
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Merge invoices + ROs into service history
  const serviceHistory = [
    ...invoices.map((inv: any) => ({
      date: inv.invoice_date || inv.created_date,
      service: inv.service_reason || inv.invoice_number || "Invoice",
      total: inv.total || 0,
      status: inv.status,
      vehicle: inv.vehicle_info || "—",
      number: inv.invoice_number || "",
    })),
    ...repairOrders.map((ro: any) => ({
      date: ro.created_date,
      service: ro.description || "Repair Order",
      total: ro.total_cost || 0,
      status: (ro.status || "").replace(/_/g, " "),
      vehicle: ro.vehicle_info || "—",
      number: ro.order_number || "",
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSpent = invoices.reduce((sum: number, inv: any) => sum + (parseFloat(inv.amount_paid) || 0), 0);
  const visits = serviceHistory.length;

  const openBalances = invoices.filter((inv: any) => {
    const balance = parseFloat(inv.balance_due) || Math.max(0, (parseFloat(inv.total) || 0) - (parseFloat(inv.amount_paid) || 0));
    return balance > 0;
  });

  const activeROs = repairOrders.filter((ro: any) => !["completed", "delivered"].includes(ro.status));

  const vehicleRows = vehicles.length === 0
    ? '<div style="font-size:12px;color:#64748b;">No vehicles on file.</div>'
    : vehicles.map((v: any, i: number) => `<div style="font-size:13px;margin-bottom:4px;">${i + 1}. ${[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown"}${v.vin ? ` — <span style="font-family:monospace;font-size:11px;color:#475569;">VIN: ${String(v.vin).toUpperCase()}</span>` : ""}${v.license_plate ? ` — Plate: ${String(v.license_plate).toUpperCase()}` : ""}</div>`).join("");

  const historyRows = serviceHistory.length === 0
    ? '<div style="font-size:12px;color:#64748b;padding:8px;">No service records found.</div>'
    : serviceHistory.map((r: any) => `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:5px 8px;">${fmtDate(r.date)}</td><td style="padding:5px 8px;font-size:11px;color:#475569;">${r.vehicle}</td><td style="padding:5px 8px;">${r.service}${r.number ? ` (#${r.number})` : ""}</td><td style="padding:5px 8px;text-align:right;font-weight:600;">${fmt(r.total)}</td><td style="padding:5px 8px;text-transform:capitalize;">${r.status}</td></tr>`).join("");

  const balanceRows = openBalances.length === 0 ? "" : openBalances.map((inv: any) => {
    const balance = parseFloat(inv.balance_due) || Math.max(0, (parseFloat(inv.total) || 0) - (parseFloat(inv.amount_paid) || 0));
    return `<div style="font-size:12px;margin-bottom:3px;">• ${inv.invoice_number || inv.id.slice(0, 8)} — ${fmt(balance)} remaining${inv.service_reason ? ` (${String(inv.service_reason).slice(0, 40)})` : ""}</div>`;
  }).join("");

  const photoRows = (vehiclePhotos || []).filter((p: any) => p.photo_url).length === 0
    ? ""
    : `<div style="border-top:2px solid #0f172a;padding-top:12px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Vehicle Photos & AI Diagnosis</div>
        <table width="100%"><tr>
        ${(vehiclePhotos || []).filter((p: any) => p.photo_url).map((p: any, i: number) => {
          if (i % 2 === 1) return "";
          const next = (vehiclePhotos || []).filter((p2: any) => p2.photo_url)[i + 1];
          return `<td style="vertical-align:top;width:50%;padding:6px;">
            <img src="${p.photo_url}" alt="${p.label || ""}" style="max-width:200px;width:100%;height:auto;border-radius:4px;" />
            <div style="font-size:11px;font-weight:600;margin-top:4px;">${p.label || "Untitled"}</div>
            <div style="font-size:10px;color:#64748b;">${fmtDate(p.taken_date || p.created_date)}</div>
            ${p.ai_analysis ? `<div style="font-size:10px;color:#475569;margin-top:2px;font-style:italic;">AI: ${String(p.ai_analysis).slice(0, 120)}${String(p.ai_analysis).length > 120 ? "…" : ""}</div>` : ""}
          </td>${next ? `<td style="vertical-align:top;width:50%;padding:6px;">
            <img src="${next.photo_url}" alt="${next.label || ""}" style="max-width:200px;width:100%;height:auto;border-radius:4px;" />
            <div style="font-size:11px;font-weight:600;margin-top:4px;">${next.label || "Untitled"}</div>
            <div style="font-size:10px;color:#64748b;">${fmtDate(next.taken_date || next.created_date)}</div>
            ${next.ai_analysis ? `<div style="font-size:10px;color:#475569;margin-top:2px;font-style:italic;">AI: ${String(next.ai_analysis).slice(0, 120)}${String(next.ai_analysis).length > 120 ? "…" : ""}</div>` : ""}
          </td>` : "<td></td>"}`;
        }).join("")}
        </tr></table>
      </div>`;

  const activeRORows = activeROs.length === 0 ? "" : `<div style="border-top:2px solid #0f172a;padding-top:12px;margin-bottom:16px;">
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Active Repair Orders</div>
    ${activeROs.map((ro: any) => `<div style="font-size:12px;margin-bottom:3px;">• ${ro.order_number || ro.id.slice(0, 8)} — ${ro.description || "—"} — <span style="text-transform:capitalize;">${(ro.status || "").replace(/_/g, " ")}</span></div>`).join("")}
  </div>`;

  const subject = `Vehicle History Report — ${customer?.full_name || "Customer"}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="100%" style="max-width:680px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;text-align:center;">
    ${shopLogo ? `<img src="${shopLogo}" alt="${shopName}" style="height:48px;object-fit:contain;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;" />` : ""}
    <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${shopName}</div>
    <div style="font-size:14px;font-weight:600;color:#94a3b8;margin-top:4px;">VEHICLE HISTORY REPORT</div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px 32px;">

    <!-- Customer info -->
    <table width="100%" style="margin-bottom:16px;font-size:13px;">
      <tr>
        <td style="vertical-align:top;width:50%;">
          <strong>CUSTOMER:</strong> ${customer?.full_name || "—"}<br />
          <strong>PHONE:</strong> ${customer?.phone || "—"}<br />
          <strong>EMAIL:</strong> ${customer?.email || "—"}
        </td>
        <td style="vertical-align:top;text-align:right;width:50%;">
          <strong>DATE:</strong> ${today}<br />
          <strong>SHOP:</strong> ${shopName}
        </td>
      </tr>
    </table>

    <!-- Vehicles -->
    <div style="border-top:2px solid #0f172a;padding-top:12px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Vehicles</div>
      ${vehicleRows}
    </div>

    <!-- Service history -->
    <div style="border-top:2px solid #0f172a;padding-top:12px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Service History</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;">
            <th style="text-align:left;padding:6px 8px;">Date</th>
            <th style="text-align:left;padding:6px 8px;">Vehicle</th>
            <th style="text-align:left;padding:6px 8px;">Service</th>
            <th style="text-align:right;padding:6px 8px;">Total</th>
            <th style="text-align:left;padding:6px 8px;">Status</th>
          </tr>
        </thead>
        <tbody>${historyRows}</tbody>
      </table>
      <div style="margin-top:8px;font-size:13px;font-weight:700;">TOTAL SPENT: ${fmt(totalSpent)} &nbsp;&nbsp; VISITS: ${visits}</div>
    </div>

    ${openBalances.length > 0 ? `<div style="border-top:2px solid #0f172a;padding-top:12px;margin-bottom:16px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Open Balances</div>
      ${balanceRows}
    </div>` : ""}

    ${photoRows}
    ${activeRORows}

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
    <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
      Powered by <strong style="color:#0ea5e9;">LBC Auto</strong>
      <br>lbchub.tech | lbc.network
      <br>Generated ${today}
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  return { subject, html };
}

function buildRawHtmlEmail(to: string, from: string, subject: string, html: string) {
  const boundary = "----=_LBCAuto_" + Date.now();
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    `Please view this email in an HTML-compatible email client to see the full vehicle history report.`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    html,
    ``,
    `--${boundary}--`,
  ].join("\r\n");
  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { customer_id, to } = await req.json();
    if (!customer_id || !to) {
      return Response.json({ error: "Missing customer_id or to" }, { status: 400 });
    }

    const [customers, vehicles, invoices, repairOrders, vehiclePhotos] = await Promise.all([
      base44.entities.Customer.filter({ id: customer_id }),
      base44.entities.Vehicle.filter({ customer_id }),
      base44.entities.Invoice.filter({ customer_id }),
      base44.entities.RepairOrder.filter({ customer_id }),
      base44.entities.VehiclePhoto.filter({ customer_id }),
    ]);

    const customer = customers[0];
    if (!customer) return Response.json({ error: "Customer not found" }, { status: 404 });

    const shopInfo = {
      business_name: user.business_name || "",
      phone: user.phone || "",
      address: user.address || "",
      email: user.email || "",
      logo_url: user.logo_url || "",
    };

    const { subject, html } = buildReportHTML(customer, vehicles, invoices, repairOrders, vehiclePhotos, shopInfo);

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const fromEmail = profile.emailAddress;

    const raw = buildRawHtmlEmail(to, `${shopInfo.business_name || "LBC Auto"} <${fromEmail}>`, subject, html);

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      return Response.json({ error: err?.error?.message || "Gmail send failed" }, { status: 500 });
    }

    return Response.json({ success: true, from: fromEmail, to, subject });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});