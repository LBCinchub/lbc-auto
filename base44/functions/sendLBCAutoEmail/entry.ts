import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Build RFC 2822 email as base64url for Gmail API
function buildRawEmail(to, from, subject, body) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");

  return btoa(unescape(encodeURIComponent(message)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function buildEmailBody(type, record, customerName) {
  switch (type) {
    case "estimate": {
      const laborLines = (record.labor_items || []).filter(l => l.description)
        .map(l => `  - ${l.description}: ${l.hours}h @ $${parseFloat(l.rate||0).toFixed(2)}/hr = $${((parseFloat(l.hours)||0)*(parseFloat(l.rate)||0)).toFixed(2)}`)
        .join("\n");
      const partsLines = (record.parts_items || []).filter(p => p.name)
        .map(p => `  - ${p.name}${p.part_number ? ` (${p.part_number})` : ""} x${p.quantity} @ $${parseFloat(p.unit_price||0).toFixed(2)} = $${((parseFloat(p.quantity)||0)*(parseFloat(p.unit_price)||0)).toFixed(2)}`)
        .join("\n");
      return {
        subject: `Your Estimate #${record.estimate_number}`,
        body: `Hello ${customerName},\n\nPlease find your estimate details below.\n\nEstimate #: ${record.estimate_number}\nVehicle: ${record.vehicle_info}\nDate: ${new Date(record.created_date).toLocaleDateString()}\nStatus: ${record.status}\n${record.valid_until ? `Valid Until: ${record.valid_until}\n` : ""}\n--- LABOR ---\n${laborLines || "  None"}\n\n--- PARTS ---\n${partsLines || "  None"}\n\n--- SUMMARY ---\nLabor Total:  $${(record.labor_total||0).toFixed(2)}\nParts Total:  $${(record.parts_total||0).toFixed(2)}\nTax:          $${(record.tax_amount||0).toFixed(2)}\nGrand Total:  $${(record.grand_total||0).toFixed(2)}\n${record.notes ? `\nNotes: ${record.notes}` : ""}\n\nThank you for your business!\nPlease contact us if you have any questions.`,
      };
    }
    case "invoice": {
      const lineItems = (record.line_items || []).filter(l => l.description)
        .map(l => `  - ${l.description}: ${l.quantity} x $${parseFloat(l.unit_price||0).toFixed(2)} = $${parseFloat(l.total||0).toFixed(2)}`)
        .join("\n");
      const statusLabel = { unpaid: "Unpaid", partial: "Partially Paid", paid: "Paid", overdue: "Overdue" }[record.status] || record.status;
      return {
        subject: `Your Invoice #${record.invoice_number}`,
        body: `Hello ${customerName},\n\nPlease find your invoice details below.\n\nInvoice #: ${record.invoice_number}\nVehicle: ${record.vehicle_info}\nDate: ${new Date(record.created_date).toLocaleDateString()}\nStatus: ${statusLabel}\n${record.due_date ? `Due Date: ${record.due_date}\n` : ""}${record.paid_date ? `Paid Date: ${record.paid_date}\n` : ""}\n--- LINE ITEMS ---\n${lineItems || "  (See invoice for details)"}\n\n--- SUMMARY ---\nLabor:         $${(record.labor_total||0).toFixed(2)}\nParts:         $${(record.parts_total||0).toFixed(2)}\nTax:           $${(record.tax_amount||0).toFixed(2)}\nTotal:         $${(record.total||0).toFixed(2)}\nAmount Paid:   $${(record.amount_paid||0).toFixed(2)}\nBalance Due:   $${(record.balance_due||0).toFixed(2)}\n${record.customer_note ? `\nNote: ${record.customer_note}` : ""}\n\nThank you for your business!\nPlease contact us if you have any questions about this invoice.`,
      };
    }
    case "appointment": {
      return {
        subject: `Appointment Confirmation — ${record.date} at ${record.time_slot}`,
        body: `Hello ${customerName},\n\nThis is a confirmation of your upcoming appointment.\n\n--- APPOINTMENT DETAILS ---\nDate:         ${new Date(record.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}\nTime:         ${record.time_slot}\nService:      ${record.service_type}\nVehicle:      ${record.vehicle_info}\n${record.mechanic_name ? `Technician:   ${record.mechanic_name}\n` : ""}Status:       ${record.status}\n${record.notes ? `\nNotes: ${record.notes}` : ""}\n\nPlease arrive on time. If you need to reschedule, contact us as soon as possible.\n\nSee you soon!`,
      };
    }
    case "repair_order": {
      const statusLabels = { waiting: "Waiting", in_progress: "In Progress", waiting_for_parts: "Waiting for Parts", completed: "Completed", delivered: "Delivered" };
      const partsLines = (record.parts_used || []).filter(p => p.name)
        .map(p => `  - ${p.name} x${p.quantity} @ $${parseFloat(p.unit_price||0).toFixed(2)}`)
        .join("\n");
      const laborLines = (record.labor_items || []).filter(l => l.description)
        .map(l => `  - ${l.description}: ${l.hours}h`)
        .join("\n");
      return {
        subject: `Repair Order Update — ${record.order_number}`,
        body: `Hello ${customerName},\n\nHere is an update on your vehicle repair.\n\n--- REPAIR ORDER DETAILS ---\nOrder #:      ${record.order_number}\nVehicle:      ${record.vehicle_info}\nStatus:       ${statusLabels[record.status] || record.status}\n${record.mechanic_name ? `Technician:   ${record.mechanic_name}\n` : ""}${record.estimated_completion ? `Est. Completion: ${record.estimated_completion}\n` : ""}\nDescription:  ${record.description}\n${laborLines ? `\n--- LABOR ---\n${laborLines}` : ""}${partsLines ? `\n\n--- PARTS ---\n${partsLines}` : ""}\n\n--- COST SUMMARY ---\nLabor:    $${(record.labor_cost||0).toFixed(2)}\nParts:    $${(record.parts_cost||0).toFixed(2)}\nTotal:    $${(record.total_cost||0).toFixed(2)}\n${record.notes ? `\nTechnician Notes: ${record.notes}` : ""}\n\nPlease contact us if you have any questions.\nThank you for choosing us!`,
      };
    }
    default:
      return { subject: "Message from LBC Auto", body: `Hello ${customerName},\n\nThank you for your business!` };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, to, customer_name, record } = await req.json();

    if (!to || !type || !record) {
      return Response.json({ error: "Missing required fields: type, to, record" }, { status: 400 });
    }

    // Get the authorized Gmail access token (shared connector)
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("gmail");

    // Get the sender's Gmail address via the Gmail profile API
    const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json();
    const fromEmail = profile.emailAddress;

    const { subject, body } = buildEmailBody(type, record, customer_name);
    const raw = buildRawEmail(to, fromEmail, subject, body);

    const sendRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      return Response.json({ error: err?.error?.message || "Gmail send failed" }, { status: 500 });
    }

    return Response.json({ success: true, from: fromEmail, to });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});