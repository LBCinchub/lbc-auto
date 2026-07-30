import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    const text = String(body.message || "").trim().slice(0, 4000);
    if (!text) return Response.json({ error: "Message is required" }, { status: 400 });
    const now = new Date().toISOString();
    const message = await auth.sr.entities.CustomerMessage.create({ shop_owner_email: auth.session.shop_owner_email, customer_id: auth.session.customer_id, customer_phone: auth.customer.phone || "", customer_name: auth.customer.full_name || "Customer", sender: "customer", message: text, sent_at: now, read_by_shop: false, read_by_customer: true });
    await auth.sr.entities.CustomerNotification.create({ shop_owner_email: auth.session.shop_owner_email, customer_id: auth.session.customer_id, customer_phone: auth.customer.phone || "", type: "message", title: "Message sent to your shop", body: text.slice(0, 120), is_read: true, sent_at: now });
    await auditEvent(auth.sr, req, "message_sent", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id, metadata: { length: text.length } });
    return Response.json({ success: true, message: { id: message.id, sender: "customer", message: text, sent_at: now, read_by_customer: true, read_by_shop: false } });
  } catch {
    return Response.json({ error: "Session expired or unavailable" }, { status: 401 });
  }
}