import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { auditEvent, buildCustomerPortalData, requireCustomerSession } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    return Response.json(await buildCustomerPortalData(auth.sr, auth.customer, auth.session.shop_owner_email));
  } catch {
    try {
      const base44 = createClientFromRequest(req);
      await auditEvent(base44.asServiceRole, req, "authorization_denied", { shopOwnerEmail: "unknown@invalid.local" });
    } catch {}
    return Response.json({ error: "Session expired or unavailable" }, { status: 401, headers: { "Set-Cookie": "lbc_customer_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0" } });
  }
}