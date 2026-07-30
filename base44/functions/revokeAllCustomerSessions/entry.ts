import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { GENERIC_AUTH_ERROR, auditEvent, requireCustomerSession, revokeSessions, verifyPasscode } from "../../shared/customerPortalSecurity.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const auth = await requireCustomerSession(base44, req);
    const body = await req.json();
    const records = await auth.sr.entities.CustomerPasscode.filter({ customer_id: auth.session.customer_id, shop_owner_email: auth.session.shop_owner_email }, "-updated_at", 2);
    if (records.length !== 1 || !(await verifyPasscode(body.current_passcode, records[0].passcode_salt, records[0].passcode_hash))) return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    const count = await revokeSessions(auth.sr, auth.session.customer_id, auth.session.shop_owner_email, body.keep_current ? auth.session.session_id : "");
    await auditEvent(auth.sr, req, "session_revoked", { customerId: auth.session.customer_id, shopOwnerEmail: auth.session.shop_owner_email, sessionId: auth.session.session_id, metadata: { count } });
    return Response.json({ success: true, revoked: count });
  } catch {
    return Response.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
  }
}