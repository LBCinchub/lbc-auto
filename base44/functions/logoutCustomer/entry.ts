import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const now = new Date().toISOString();
    await auth.sr.entities.CustomerPortalSession.update(auth.session.id, { revoked: true, revoked_at: now });
    await auditEvent(auth.sr, req, "session_revoked", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id });
    return Response.json({ success: true }, { headers: { "Set-Cookie": "lbc_customer_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" } });
  } catch {
    return Response.json({ success: true }, { headers: { "Set-Cookie": "lbc_customer_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" } });
  }
}