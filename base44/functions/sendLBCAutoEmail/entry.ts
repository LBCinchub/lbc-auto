import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ─── HTML Email Builder ────────────────────────────────────────────────────
function fmt(n: number) { return `$${(parseFloat(String(n)) || 0).toFixed(2)}`; }

function buildHTMLEmail(type: string, record: any, customerName: string, shopInfo: any) {
  const shopName    = shopInfo?.business_name || "Auto Shop";
  const shopPhone   = shopInfo?.phone   || "";
  const shopAddress = shopInfo?.address || "";
  const shopEmail   = shopInfo?.email   || "";
  const logoUrl     = shopInfo?.logo_url || "";
  const reviewLink  = shopInfo?.google_review_link || "";

  // ── Resolve date ──
  const docDate = (() => {
    const raw = record.invoice_date || record.estimate_date || record.created_date || record.date || "";
    if (!raw) return new Date().toLocaleDateString("en-CA");
    return new Date(raw.includes("T") ? raw : raw + "T00:00:00").toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric"
    });
  })();

  // ── Subject lines ──
  const subjects: Record<string, string> = {
    estimate:     `Estimate #${record.estimate_number} — ${shopName}`,
    invoice:      `Invoice #${record.invoice_number} — ${shopName}`,
    appointment:  `Appointment Confirmed — ${shopName}`,
    repair_order: `Repair Update — Order #${record.order_number} | ${shopName}`,
  };
  const subject = subjects[type] || `Message from ${shopName}`;

  // ── Opening line per type ──
  const openings: Record<string, string> = {
    estimate:     `We've prepared an estimate for your vehicle. Please review the details below.`,
    invoice:      `Thank you for trusting us with your vehicle. Your invoice is ready — please find the full details below.`,
    appointment:  `Your appointment has been confirmed. We look forward to seeing you!`,
    repair_order: `Here's an update on your vehicle repair. Our team is working hard to get you back on the road.`,
  };
  const opening = openings[type] || `Thank you for choosing ${shopName}.`;

  // ── Line items table ──
  const buildItemRows = () => {
    const rows: { desc: string; detail: string; qty: string; unit: number; total: number; isRec?: boolean }[] = [];

    if (type === "estimate") {
      (record.labor_items || []).filter((l: any) => l.description).forEach((l: any) => {
        rows.push({
          desc: l.description, detail: `${l.hours}h @ ${fmt(l.rate)}/hr`,
          qty: `${l.hours}h`, unit: parseFloat(l.rate) || 0,
          total: (parseFloat(l.hours)||0) * (parseFloat(l.rate)||0)
        });
      });
      (record.parts_items || []).filter((p: any) => p.name).forEach((p: any) => {
        const qty = parseFloat(p.quantity) || 0;
        const isRec = qty === 0;
        rows.push({
          desc: p.name, detail: p.part_number ? `Part #${p.part_number}` : "",
          qty: isRec ? "—" : `x${qty}`, unit: parseFloat(p.unit_price)||0,
          total: isRec ? 0 : qty * (parseFloat(p.unit_price)||0), isRec
        });
      });
    } else if (type === "invoice") {
      (record.labor_items || record.line_items?.filter((i: any) => i.type === "labor") || []).filter((l: any) => l.description).forEach((l: any) => {
        rows.push({
          desc: l.description, detail: l.hours ? `${l.hours}h @ ${fmt(l.rate)}/hr` : "",
          qty: l.hours ? `${l.hours}h` : "1", unit: parseFloat(l.rate || l.unit_price)||0,
          total: (parseFloat(l.hours||1)) * (parseFloat(l.rate || l.unit_price)||0)
        });
      });
      (record.parts_used || record.line_items?.filter((i: any) => i.type !== "labor") || []).filter((p: any) => p.name || p.description).forEach((p: any) => {
        const qty = parseFloat(p.quantity)||1;
        rows.push({
          desc: p.name || p.description, detail: p.part_number ? `Part #${p.part_number}` : "",
          qty: `x${qty}`, unit: parseFloat(p.unit_price)||0,
          total: qty * (parseFloat(p.unit_price)||0)
        });
      });
    } else if (type === "repair_order") {
      (record.labor_items || []).filter((l: any) => l.description).forEach((l: any) => {
        rows.push({ desc: l.description, detail: `${l.hours}h`, qty: `${l.hours}h`, unit: 0, total: 0 });
      });
      (record.parts_used || []).filter((p: any) => p.name).forEach((p: any) => {
        rows.push({ desc: p.name, detail: "", qty: `x${p.quantity||1}`, unit: parseFloat(p.unit_price)||0, total: (parseFloat(p.quantity)||1)*(parseFloat(p.unit_price)||0) });
      });
    }
    if (!rows.length) return `<tr><td colspan="4" style="padding:14px;text-align:center;color:#94a3b8;font-style:italic;">See attached for details</td></tr>`;
    return rows.map(r => `
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 12px;">
          <div style="font-weight:600;color:${r.isRec ? "#94a3b8" : "#0f172a"};font-size:13px;">${r.desc}${r.isRec ? ' <span style="font-size:10px;color:#f59e0b;font-weight:700;">RECOMMENDED</span>' : ''}</div>
          ${r.detail ? `<div style="font-size:11px;color:#64748b;margin-top:2px;">${r.detail}</div>` : ""}
        </td>
        <td style="padding:10px 12px;text-align:center;color:#64748b;font-size:12px;">${r.qty}</td>
        <td style="padding:10px 12px;text-align:right;color:#475569;font-size:12px;">${r.isRec ? "—" : fmt(r.unit)}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:${r.isRec ? "#94a3b8" : "#0f172a"};font-size:13px;">${r.isRec ? "—" : fmt(r.total)}</td>
      </tr>`).join("");
  };

  // ── Totals block ──
  const buildTotals = () => {
    if (type === "appointment") return "";
    const laborTotal  = parseFloat(record.labor_total  || record.labor_cost  || 0);
    const partsTotal  = parseFloat(record.parts_total  || record.parts_cost  || 0);
    const discount    = parseFloat(record.discount || 0);
    const tax         = parseFloat(record.tax_amount   || 0);
    const grand       = parseFloat(record.grand_total  || record.total || record.total_cost || 0);
    const paid        = parseFloat(record.amount_paid  || 0);
    const balance     = parseFloat(record.balance_due  || Math.max(0, grand - paid));
    const row = (label: string, val: string, bold = false, color = "#0f172a") =>
      `<tr><td style="padding:4px 0;color:#64748b;font-size:12px;">${label}</td><td style="padding:4px 0;text-align:right;font-weight:${bold ? 700 : 500};color:${color};font-size:${bold ? 14 : 12}px;">${val}</td></tr>`;
    return `
      <table style="width:100%;max-width:320px;margin-left:auto;margin-top:12px;">
        ${laborTotal ? row("Labor", fmt(laborTotal)) : ""}
        ${partsTotal ? row("Parts", fmt(partsTotal)) : ""}
        ${discount   ? row("Discount", `-${fmt(discount)}`, false, "#16a34a") : ""}
        ${tax        ? row("Tax", fmt(tax)) : ""}
        ${row(`<strong>Total</strong>`, fmt(grand), true)}
        ${paid       ? row("Amount Paid", fmt(paid), false, "#16a34a") : ""}
        ${(type === "invoice" && balance > 0) ? row("<strong>Balance Due</strong>", fmt(balance), true, "#dc2626") : ""}
        ${(type === "invoice" && balance <= 0) ? row("✅ Paid in Full", "", false, "#16a34a") : ""}
      </table>`;
  };

  // ── Service reason + notes ──
  const reasonBlock = (record.service_reason) ? `
    <div style="margin:16px 0;padding:12px 16px;background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1d4ed8;margin-bottom:4px;">Reason for Visit</div>
      <div style="color:#1e3a5f;font-size:13px;font-style:italic;">${record.service_reason}</div>
    </div>` : "";

  const notesBlock = (record.customer_note || record.notes) ? `
    <div style="margin:16px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#92400e;margin-bottom:4px;">Note</div>
      <div style="color:#78350f;font-size:13px;">${record.customer_note || record.notes}</div>
    </div>` : "";

  // ── Status badge ──
  const statusBadge = (() => {
    if (type !== "invoice") return "";
    const colors: Record<string, [string, string]> = {
      paid:    ["#dcfce7", "#16a34a"],
      partial: ["#fef9c3", "#b45309"],
      overdue: ["#fee2e2", "#dc2626"],
      unpaid:  ["#f1f5f9", "#475569"],
    };
    const [bg, text] = colors[record.status] || colors.unpaid;
    const labels: Record<string, string> = { paid: "PAID IN FULL", partial: "PARTIALLY PAID", overdue: "OVERDUE", unpaid: "UNPAID" };
    return `<span style="display:inline-block;padding:4px 12px;background:${bg};color:${text};font-size:11px;font-weight:700;border-radius:20px;letter-spacing:1px;margin-left:8px;">${labels[record.status] || record.status.toUpperCase()}</span>`;
  })();

  // ── Appointment details ──
  const appointmentBlock = type === "appointment" ? `
    <table style="width:100%;margin:16px 0;">
      <tr><td style="padding:6px 0;color:#64748b;font-size:12px;width:140px;">Date</td><td style="font-weight:600;color:#0f172a;">${record.date ? new Date(record.date + "T12:00:00").toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }) : "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Time</td><td style="font-weight:600;color:#0f172a;">${record.time_slot || "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Service</td><td style="font-weight:600;color:#0f172a;">${record.service_type || "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Vehicle</td><td style="font-weight:600;color:#0f172a;">${record.vehicle_info || "—"}</td></tr>
      ${record.mechanic_name ? `<tr><td style="padding:6px 0;color:#64748b;font-size:12px;">Technician</td><td style="font-weight:600;color:#0f172a;">${record.mechanic_name}</td></tr>` : ""}
    </table>` : "";

  // ── Review CTA ──
  const reviewBlock = reviewLink ? `
    <div style="margin:24px 0;text-align:center;">
      <div style="font-size:13px;color:#475569;margin-bottom:10px;">Satisfied with our service? Your review means the world to us 🌟</div>
      <a href="${reviewLink}" target="_blank" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#ffffff;font-size:13px;font-weight:700;border-radius:8px;text-decoration:none;letter-spacing:0.5px;">
        ⭐ Leave Us a Google Review
      </a>
    </div>` : `
    <div style="margin:24px 0;text-align:center;">
      <div style="font-size:13px;color:#475569;">Satisfied with our service? Your kind words help other drivers find us 🌟</div>
    </div>`;

  // ── Vehicle block ──
  const vehicleBlock = (record.vehicle_info) ? `
    <div style="background:#f8fafc;border-left:3px solid #6366f1;border-radius:6px;padding:10px 14px;margin:12px 0;">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:3px;">Vehicle</div>
      <div style="font-size:14px;font-weight:700;color:#0f172a;">${record.vehicle_info}</div>
      <div style="font-size:12px;color:#475569;margin-top:4px;line-height:1.7;">
        ${record.license_plate ? `<span style="background:#e0f2fe;padding:2px 8px;border-radius:4px;font-weight:700;letter-spacing:1px;margin-right:8px;">${String(record.license_plate).toUpperCase()}</span>` : ""}
        ${record.color ? `● ${record.color}` : ""}
        ${record.vin ? `<br><span style="font-family:monospace;font-size:11px;">VIN: ${String(record.vin).toUpperCase()}</span>` : ""}
      </div>
    </div>` : "";

  // ── Doc number + date ──
  const docRef = type === "estimate"
    ? `Estimate #${record.estimate_number}`
    : type === "invoice"
    ? `Invoice #${record.invoice_number}`
    : type === "repair_order"
    ? `Repair Order #${record.order_number}`
    : `Appointment`;

  // ── Items section (skip for appointment) ──
  const itemsSection = type !== "appointment" ? `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Unit</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>${buildItemRows()}</tbody>
    </table>
    ${buildTotals()}` : "";

  // ── Full HTML ──────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
  <tr><td align="center">
    <table width="100%" style="max-width:620px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:28px 32px;">
        <table width="100%">
          <tr>
            <td>
              ${logoUrl ? `<img src="${logoUrl}" alt="${shopName}" style="height:48px;object-fit:contain;margin-bottom:8px;display:block;">` : ""}
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${shopName}</div>
              <div style="font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.7;">
                ${shopPhone ? `📞 ${shopPhone}` : ""}
                ${shopPhone && shopAddress ? " &nbsp;|&nbsp; " : ""}
                ${shopAddress ? `📍 ${shopAddress}` : ""}
                ${shopEmail ? `<br>✉️ ${shopEmail}` : ""}
              </div>
            </td>
            <td align="right" valign="top">
              <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${type === "appointment" ? "Appointment" : type === "repair_order" ? "Repair Order" : type.charAt(0).toUpperCase()+type.slice(1)}</div>
              <div style="font-size:20px;font-weight:700;color:#0ea5e9;margin-top:4px;">${docRef}</div>
              ${statusBadge ? `<div style="margin-top:8px;">${statusBadge}</div>` : ""}
              <div style="font-size:12px;color:#64748b;margin-top:6px;">${docDate}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:28px 32px;">

        <!-- Greeting -->
        <p style="font-size:15px;color:#0f172a;margin:0 0 6px 0;">Hello <strong>${customerName}</strong>,</p>
        <p style="font-size:13px;color:#475569;margin:0 0 20px 0;line-height:1.6;">${opening}</p>

        <!-- Customer + Vehicle -->
        <table width="100%" style="margin-bottom:4px;">
          <tr>
            <td width="48%" style="vertical-align:top;">
              <div style="background:#f8fafc;border-left:3px solid #0ea5e9;border-radius:6px;padding:10px 14px;">
                <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:3px;">Billed To</div>
                <div style="font-size:14px;font-weight:700;color:#0f172a;">${customerName}</div>
              </div>
            </td>
            <td width="4%"></td>
            <td width="48%">${vehicleBlock}</td>
          </tr>
        </table>

        <!-- Reason for visit -->
        ${reasonBlock}

        <!-- Appointment block or Items -->
        ${appointmentBlock}
        ${itemsSection}

        <!-- Notes -->
        ${notesBlock}

        <!-- Divider -->
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

        <!-- Warm closing -->
        <p style="font-size:13px;color:#475569;line-height:1.7;margin:0 0 8px 0;">
          We truly appreciate your trust in <strong>${shopName}</strong>. Our goal is to keep your vehicle running safely and smoothly — if you have any questions about this ${type.replace("_", " ")}, please don't hesitate to reach out.
        </p>
        <p style="font-size:13px;color:#475569;line-height:1.7;margin:0 0 20px 0;">
          We look forward to serving you again. Drive safe! 🚗
        </p>

        <!-- Review CTA -->
        ${reviewBlock}

      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
        <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
          ${shopName}${shopAddress ? " · " + shopAddress : ""}${shopPhone ? " · " + shopPhone : ""}
          <br>Powered by <strong style="color:#0ea5e9;">LBC Auto</strong>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;

  return { subject, html };
}

// ─── RFC-2822 builder for HTML emails ─────────────────────────────────────
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
    `Please view this email in an HTML-compatible email client to see the full formatted version.`,
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

// ─── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { type, to, customer_name, record, shop_email } = await req.json();
    if (!to || !type || !record) {
      return Response.json({ error: "Missing required fields: type, to, record" }, { status: 400 });
    }

    // ── Tenant-aware shop info ──────────────────────────────────
    // If shop_email is provided and differs from the auth user, look up
    // the shop's profile by email (service role). Falls back to auth user.
    let shopUser: any = user;
    if (shop_email && shop_email !== user.email) {
      try {
        const matched = await base44.asServiceRole.entities.User.filter({ email: shop_email }, null, 1);
        if (matched && matched.length) shopUser = matched[0];
      } catch (e) { /* fall back to auth user */ }
    }

    const shopInfo = {
      business_name: shopUser.business_name || "",
      phone:         shopUser.phone         || "",
      address:       shopUser.address       || "",
      email:         shopUser.email         || "",
      logo_url:      shopUser.logo_url      || "",
      google_review_link: shopUser.google_review_link || "",
    };

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const fromEmail = profile.emailAddress;

    const { subject, html } = buildHTMLEmail(type, record, customer_name || "Valued Customer", shopInfo);
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
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});